const assert = require('node:assert/strict');
const engine = require('../tournament-engine.js');

function names(ids) {
  return Object.fromEntries(ids.map(id => [id, `Participant ${id}`]));
}

function makeStage(id, order, type, overrides = {}) {
  return {
    id,
    competitionId: 'competition:test',
    order,
    name: `Stage ${order}`,
    type,
    role: '',
    level: '',
    scoringProfile: 'sets',
    allowDraws: type !== 'knockout',
    pointsRules: { win: 3, draw: 1, loss: 0 },
    tieBreakOrder: ['points', 'wins', 'setsWon', 'setDifference', 'pointsFor', 'pointDifference', 'headToHead'],
    groupConfig: null,
    qualificationRule: null,
    status: 'draft',
    participantIds: [],
    groups: [],
    ...overrides
  };
}

function makeCompetition(participantIds, stages) {
  return {
    id: 'competition:test',
    name: 'Competition test',
    kind: 'tournament',
    sport: 'tenis',
    participantType: 'player',
    status: 'ongoing',
    participantIds,
    stages,
    finalClassification: []
  };
}

function winHomeResult() {
  return {
    score: '2:0',
    sets: '21:15, 21:17'
  };
}

function winAwayResult() {
  return {
    score: '0:2',
    sets: '17:21, 18:21'
  };
}

function completeAvailableStage(competition, matches, stageId, options = {}) {
  let guard = 0;
  while (!engine.isStageComplete(
    competition.stages.find(stage => stage.id === stageId),
    matches
  )) {
    const pending = engine.competitionStageMatches(matches, stageId)
      .filter(match => match.status === 'scheduled' && match.homeId && match.awayId);
    assert.ok(pending.length > 0, `Stage ${stageId} has no playable match`);
    pending.forEach((match, index) => {
      engine.applyCompetitionResult(
        competition,
        matches,
        match.id,
        index % 2 === 0 ? winHomeResult() : winAwayResult(),
        options
      );
    });
    guard += 1;
    assert.ok(guard < 10, `Stage ${stageId} did not finish`);
  }
}

function testSingleRoundRobinStage() {
  const ids = ['p1', 'p2', 'p3', 'p4'];
  const stage = makeStage('stage:round-robin', 1, 'round_robin', {
    groupConfig: { matchesPerPair: 1 }
  });
  const competition = makeCompetition(ids, [stage]);
  const matches = [];

  const generated = engine.generateCompetitionStructure(competition, matches, {
    names: names(ids)
  });
  assert.equal(generated.length, 6);
  assert.equal(stage.groups.length, 1);
  assert.deepEqual(stage.participantIds, ids);
  assert.equal(competition.finalClassification.length, 0);

  completeAvailableStage(competition, matches, stage.id, { names: names(ids) });
  assert.equal(stage.status, 'completed');
  assert.equal(competition.status, 'completed');
  assert.equal(competition.finalClassification.length, 4);
  assert.deepEqual(
    competition.finalClassification.map(row => row.place),
    [1, 2, 3, 4]
  );

  const completedMatch = engine.competitionStageMatches(matches, stage.id)[0];
  engine.clearCompetitionMatchResult(competition, matches, completedMatch.id);
  assert.equal(completedMatch.status, 'scheduled');
  assert.equal(competition.status, 'ongoing');
  assert.equal(competition.finalClassification.length, 0);
}

function testGroupsToKnockout() {
  const ids = Array.from({ length: 8 }, (_, index) => `p${index + 1}`);
  const groupStage = makeStage('stage:groups', 1, 'groups', {
    groupConfig: {
      groupCount: 2,
      participantsPerGroup: 4,
      matchesPerPair: 1
    }
  });
  const knockoutStage = makeStage('stage:playoff', 2, 'knockout', {
    qualificationRule: {
      type: 'places_per_group',
      count: 2,
      pairingRule: 'cross_groups'
    }
  });
  const competition = makeCompetition(ids, [groupStage, knockoutStage]);
  const matches = [];
  engine.generateCompetitionStructure(competition, matches, {
    names: names(ids),
    manualGroups: {
      [groupStage.id]: [
        ['p1', 'p2', 'p3', 'p4'],
        ['p5', 'p6', 'p7', 'p8']
      ]
    }
  });

  assert.throws(
    () => engine.generateNextStage(competition, matches, groupStage.id),
    /zakończeniem/
  );

  completeAvailableStage(competition, matches, groupStage.id, { names: names(ids) });
  const playoffMatches = engine.competitionStageMatches(matches, knockoutStage.id);
  assert.equal(knockoutStage.participantIds.length, 4);
  assert.equal(playoffMatches.filter(match => !match.isThirdPlace).length, 3);
  assert.equal(new Set(
    playoffMatches
      .filter(match => match.roundNumber === 1)
      .flatMap(match => [match.homeId, match.awayId])
  ).size, 4);

  completeAvailableStage(competition, matches, knockoutStage.id, { names: names(ids) });
  assert.equal(competition.finalClassification.length, 4);
  assert.equal(competition.finalClassification[0].participantId, playoffMatches
    .find(match => match.roundLabel === 'Finał').winnerId);
}

function testThreeStageCompetition() {
  const ids = Array.from({ length: 12 }, (_, index) => `p${index + 1}`);
  const opening = makeStage('stage:opening', 1, 'groups', {
    groupConfig: {
      groupCount: 4,
      participantsPerGroup: 3,
      matchesPerPair: 1
    }
  });
  const finalGroup = makeStage('stage:final-group', 2, 'round_robin', {
    qualificationRule: {
      type: 'group_winners'
    },
    groupConfig: { matchesPerPair: 1 }
  });
  const medalStage = makeStage('stage:medals', 3, 'knockout', {
    thirdPlaceMatch: true,
    qualificationRule: {
      type: 'stage_positions',
      positions: [1, 2, 3, 4],
      pairingRule: 'high_low'
    }
  });
  const competition = makeCompetition(ids, [opening, finalGroup, medalStage]);
  const matches = [];

  engine.generateCompetitionStructure(competition, matches, { names: names(ids) });
  assert.equal(opening.groups.length, 4);
  assert.ok(opening.groups.every(group => group.participantIds.length === 3));

  completeAvailableStage(competition, matches, opening.id, { names: names(ids) });
  assert.equal(finalGroup.participantIds.length, 4);
  assert.equal(engine.competitionStageMatches(matches, finalGroup.id).length, 6);

  completeAvailableStage(competition, matches, finalGroup.id, { names: names(ids) });
  assert.equal(medalStage.participantIds.length, 4);
  assert.equal(
    engine.competitionStageMatches(matches, medalStage.id).filter(match => match.isThirdPlace).length,
    1
  );

  completeAvailableStage(competition, matches, medalStage.id, { names: names(ids) });
  assert.equal(competition.finalClassification.length, 4);
  assert.equal(competition.status, 'completed');
}

function createCompletedGroupsForQualification() {
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  const stage = makeStage('stage:qualification', 1, 'groups', {
    groupConfig: {
      groupCount: 2,
      participantsPerGroup: 3,
      matchesPerPair: 1
    }
  });
  const competition = makeCompetition(ids, [stage]);
  const matches = [];
  engine.generateCompetitionStructure(competition, matches, {
    manualGroups: {
      [stage.id]: [
        ['p1', 'p2', 'p3'],
        ['p4', 'p5', 'p6']
      ]
    }
  });
  completeAvailableStage(competition, matches, stage.id);
  return { competition, stage, matches, ids };
}

function testQualificationRules() {
  const { competition, stage, matches, ids } = createCompletedGroupsForQualification();
  const winnersStage = makeStage('stage:winners', 2, 'round_robin', {
    qualificationRule: { type: 'group_winners' }
  });
  competition.stages.push(winnersStage);
  assert.equal(
    engine.resolveQualifiedParticipants(stage, winnersStage, matches).length,
    2
  );

  winnersStage.qualificationRule = { type: 'best_overall', count: 3 };
  assert.equal(
    engine.resolveQualifiedParticipants(stage, winnersStage, matches).length,
    3
  );

  winnersStage.qualificationRule = {
    type: 'manual',
    participantIds: ['p2', 'p5']
  };
  assert.deepEqual(
    engine.resolveQualifiedParticipants(stage, winnersStage, matches),
    ['p2', 'p5']
  );

  winnersStage.qualificationRule = {
    type: 'places_per_group',
    count: 2,
    pairingRule: 'high_low'
  };
  const highLow = engine.resolveQualifiedParticipants(stage, {
    ...winnersStage,
    type: 'knockout'
  }, matches);
  assert.equal(highLow.length, 4);
  assert.equal(new Set(highLow).size, 4);
  assert.ok(highLow.every(id => ids.includes(id)));
}

function testKnockoutByesAndPromotion() {
  const ids = Array.from({ length: 6 }, (_, index) => `p${index + 1}`);
  const stage = makeStage('stage:bye-playoff', 1, 'knockout');
  const competition = makeCompetition(ids, [stage]);
  const matches = [];
  engine.generateCompetitionStructure(competition, matches, { names: names(ids) });

  assert.equal(matches.filter(match => match.status === 'bye').length, 2);
  completeAvailableStage(competition, matches, stage.id, { names: names(ids) });
  const final = matches.find(match => match.roundLabel === 'Finał');
  assert.ok(final.winnerId);
  assert.equal(competition.finalClassification[0].participantId, final.winnerId);
}

function createGroupsAndScheduledPlayoff() {
  const ids = Array.from({ length: 8 }, (_, index) => `p${index + 1}`);
  const groups = makeStage('stage:dependency-groups', 1, 'groups', {
    groupConfig: {
      groupCount: 2,
      participantsPerGroup: 4,
      matchesPerPair: 1
    }
  });
  const playoff = makeStage('stage:dependency-playoff', 2, 'knockout', {
    qualificationRule: {
      type: 'places_per_group',
      count: 2,
      pairingRule: 'cross_groups'
    }
  });
  const competition = makeCompetition(ids, [groups, playoff]);
  const matches = [];
  engine.generateCompetitionStructure(competition, matches);
  completeAvailableStage(competition, matches, groups.id);
  return { competition, matches, groups, playoff, ids };
}

function testDependencyResetAndBlock() {
  const scheduled = createGroupsAndScheduledPlayoff();
  const groupMatch = engine.competitionStageMatches(scheduled.matches, scheduled.groups.id)[0];
  const changedResult = groupMatch.score === '2:0' ? winAwayResult() : winHomeResult();
  const inspection = engine.inspectMatchChange(
    scheduled.competition,
    scheduled.matches,
    groupMatch.id,
    changedResult
  );
  assert.equal(inspection.requiresReset, true);
  assert.equal(inspection.blocked, false);
  const reset = engine.applyCompetitionResult(
    scheduled.competition,
    scheduled.matches,
    groupMatch.id,
    changedResult
  );
  assert.ok(reset.resetMatchIds.length > 0);
  assert.ok(reset.generatedMatches.length > 0);

  const playoffMatch = engine.competitionStageMatches(scheduled.matches, scheduled.playoff.id)
    .find(match => match.status === 'scheduled' && match.homeId && match.awayId);
  engine.applyCompetitionResult(
    scheduled.competition,
    scheduled.matches,
    playoffMatch.id,
    winHomeResult()
  );
  const anotherGroupMatch = engine.competitionStageMatches(scheduled.matches, scheduled.groups.id)[1];
  const anotherChange = anotherGroupMatch.score === '2:0' ? winAwayResult() : winHomeResult();
  assert.throws(
    () => engine.applyCompetitionResult(
      scheduled.competition,
      scheduled.matches,
      anotherGroupMatch.id,
      anotherChange
    ),
    error => error.code === 'DOWNSTREAM_COMPLETED'
  );

  const forced = engine.applyCompetitionResult(
    scheduled.competition,
    scheduled.matches,
    anotherGroupMatch.id,
    anotherChange,
    { forceResetDownstream: true }
  );
  assert.ok(forced.resetMatchIds.includes(playoffMatch.id));
  assert.ok(forced.generatedMatches.length > 0);
}

function testCompletedKnockoutDependencyBlock() {
  const ids = ['p1', 'p2', 'p3', 'p4'];
  const stage = makeStage('stage:dependency-knockout', 1, 'knockout');
  const competition = makeCompetition(ids, [stage]);
  const matches = [];
  engine.generateCompetitionStructure(competition, matches);
  const semifinals = matches.filter(match => match.roundNumber === 1);
  semifinals.forEach(match => {
    engine.applyCompetitionResult(competition, matches, match.id, winHomeResult());
  });
  const final = matches.find(match => match.roundLabel === 'Finał');
  engine.applyCompetitionResult(competition, matches, final.id, winHomeResult());

  assert.throws(
    () => engine.applyCompetitionResult(
      competition,
      matches,
      semifinals[0].id,
      winAwayResult()
    ),
    error => error.code === 'DOWNSTREAM_COMPLETED'
  );

  const forced = engine.applyCompetitionResult(
    competition,
    matches,
    semifinals[0].id,
    winAwayResult(),
    { forceResetDownstream: true }
  );
  assert.ok(forced.resetMatchIds.includes(final.id));
  assert.equal(final.status, 'scheduled');
  assert.equal(final.score, '');
  assert.equal(final.homeId, semifinals[0].winnerId);
  assert.equal(competition.finalClassification.length, 0);
}

function testInvalidStageContracts() {
  assert.throws(
    () => engine.validateCompetitionStages({ stages: [] }),
    /jednego do trzech/
  );
  assert.throws(
    () => engine.validateCompetitionStages({
      stages: [
        makeStage('s1', 1, 'groups'),
        makeStage('s2', 2, 'knockout')
      ]
    }),
    /reguły awansu/
  );
}

testSingleRoundRobinStage();
testGroupsToKnockout();
testThreeStageCompetition();
testQualificationRules();
testKnockoutByesAndPromotion();
testDependencyResetAndBlock();
testCompletedKnockoutDependencyBlock();
testInvalidStageContracts();

console.log('competition stage engine V3 tests passed');
