const assert = require('node:assert/strict');
const engine = require('../tournament-engine.js');

function names(ids) {
  return Object.fromEntries(ids.map(id => [id, `Participant ${id}`]));
}

function deterministicRandom() {
  const values = [0.71, 0.12, 0.89, 0.34, 0.56, 0.03, 0.45, 0.22];
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

function completeGroup(group, results) {
  group.matches.forEach((match, index) => {
    const result = results[index % results.length];
    engine.recordGroupResult(group, match.id, result);
  });
}

function testKnockoutSizes() {
  [4, 8, 12].forEach(count => {
    const ids = Array.from({ length: count }, (_, index) => `p${index + 1}`);
    const bracket = engine.createKnockoutBracket(ids, {
      tournamentId: count,
      names: names(ids),
      seeding: 'random',
      random: deterministicRandom(),
      thirdPlaceMatch: true
    });
    const mainMatches = bracket.filter(match => !match.isThirdPlace);
    assert.equal(mainMatches.length, engine.nextPowerOfTwo(count) - 1);
    assert.equal(bracket.filter(match => match.isThirdPlace).length, 1);
    const firstRoundIds = mainMatches
      .filter(match => match.roundIndex === 0)
      .flatMap(match => [match.homeId, match.awayId])
      .filter(Boolean);
    assert.equal(new Set(firstRoundIds).size, count);
    assert.equal(firstRoundIds.length, count);
    assert.ok(mainMatches.every(match => match.homeId !== match.awayId || !match.homeId));
    if (count === 12) {
      assert.equal(mainMatches.filter(match => match.status === 'bye').length, 4);
    }
  });
}

function testKnockoutProgression() {
  const ids = ['p1', 'p2', 'p3', 'p4'];
  const participantNames = names(ids);
  const bracket = engine.createKnockoutBracket(ids, {
    tournamentId: 1,
    names: participantNames,
    seeding: 'manual',
    thirdPlaceMatch: true
  });
  const semifinals = bracket.filter(match => match.round === 'Półfinał');
  const final = bracket.find(match => match.round === 'Finał');
  const thirdPlace = bracket.find(match => match.isThirdPlace);

  engine.recordKnockoutResult(bracket, semifinals[0].id, {
    score: '2:0',
    sets: '21:15, 21:18'
  }, { names: participantNames });
  engine.recordKnockoutResult(bracket, semifinals[1].id, {
    score: '2:1',
    sets: '21:17, 18:21, 21:19'
  }, { names: participantNames });

  assert.ok(final.homeId && final.awayId);
  assert.ok(thirdPlace.homeId && thirdPlace.awayId);
  assert.throws(() => engine.recordKnockoutResult(bracket, final.id, {
    score: '1:1',
    sets: '21:18, 17:21'
  }), /remisem/);

  engine.recordKnockoutResult(bracket, thirdPlace.id, {
    score: '2:0',
    sets: '21:17, 21:16'
  }, { names: participantNames });
  assert.throws(() => engine.recordKnockoutResult(bracket, semifinals[1].id, {
    score: '0:2',
    sets: '18:21, 17:21'
  }, { names: participantNames }), /trzecie miejsce/);

  engine.recordKnockoutResult(bracket, final.id, {
    score: '2:0',
    sets: '21:18, 21:19'
  }, { names: participantNames });
  assert.throws(() => engine.recordKnockoutResult(bracket, semifinals[0].id, {
    score: '0:2',
    sets: '17:21, 18:21'
  }, { names: participantNames }), /kolejna runda/);
}

function testRoundRobinSchedule() {
  const ids = ['p1', 'p2', 'p3', 'p4'];
  const groups = engine.createGroupStage(ids, {
    groupCount: 1,
    matchesPerPair: 2
  }, {
    tournamentId: 2,
    names: names(ids),
    seeding: 'manual',
    allowDraws: true,
    pointsRules: { win: 3, draw: 1, loss: 0 }
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].matches.length, 12);
  const pairCounts = new Map();
  groups[0].matches.forEach(match => {
    assert.notEqual(match.homeId, match.awayId);
    const key = [match.homeId, match.awayId].sort().join('|');
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  });
  assert.ok([...pairCounts.values()].every(count => count === 2));
}

function testFourGroupsOfThreeWithReturnMatches() {
  const ids = Array.from({ length: 12 }, (_, index) => `p${index + 1}`);
  const groups = engine.createGroupStage(ids, {
    groupCount: 4,
    participantsPerGroup: 3,
    matchesPerPair: 2
  }, {
    tournamentId: 22,
    names: names(ids),
    seeding: 'random',
    random: deterministicRandom(),
    allowDraws: true,
    pointsRules: { win: 3, draw: 1, loss: 0 }
  });
  assert.equal(groups.length, 4);
  assert.ok(groups.every(group => group.participantIds.length === 3));
  assert.ok(groups.every(group => group.matches.length === 6));
  assert.equal(new Set(groups.flatMap(group => group.participantIds)).size, 12);
}

function testGroupStandingsAndDraws() {
  const ids = ['p1', 'p2', 'p3'];
  const [group] = engine.createGroupStage(ids, {
    groupCount: 1,
    matchesPerPair: 1
  }, {
    tournamentId: 3,
    names: names(ids),
    seeding: 'manual',
    allowDraws: true,
    pointsRules: { win: 3, draw: 1, loss: 0 }
  });
  engine.recordGroupResult(group, group.matches[0].id, {
    score: '1:1',
    sets: '21:18, 16:21'
  });
  engine.recordGroupResult(group, group.matches[1].id, {
    score: '2:0',
    sets: '21:16, 21:17'
  });
  engine.recordGroupResult(group, group.matches[2].id, {
    score: '0:2',
    sets: '17:21, 18:21'
  });
  const standings = engine.calculateGroupStandings(group);
  assert.equal(standings[0].participantId, 'p1');
  assert.equal(standings[0].points, 4);
  assert.equal(standings.find(row => row.participantId === 'p2').draws, 1);
  assert.equal(standings.find(row => row.participantId === 'p3').played, 2);

  const unresolvedGroup = {
    id: 'manual-tie',
    participantIds: ['p1', 'p2'],
    matches: []
  };
  const manuallyResolved = engine.calculateGroupStandings(unresolvedGroup, {
    manualTieBreaks: { p2: 10 }
  });
  assert.equal(manuallyResolved[0].participantId, 'p2');
}

function createCompletedTwoGroupTournament() {
  const ids = Array.from({ length: 8 }, (_, index) => `p${index + 1}`);
  const tournament = {
    id: 4,
    format: 'groups_knockout',
    participantIds: ids,
    seeding: 'manual',
    allowDraws: true,
    pointsRules: { win: 3, draw: 1, loss: 0 },
    groupConfig: {
      groupCount: 2,
      matchesPerPair: 1,
      qualifiersPerGroup: 2,
      tieBreakOrder: ['points', 'wins', 'setsWon', 'setDifference', 'pointsFor', 'pointDifference', 'headToHead']
    },
    finalStageConfig: {
      type: 'knockout',
      pairingRule: 'cross_groups',
      thirdPlaceMatch: false
    },
    groups: [],
    bracket: []
  };
  engine.generateTournamentStructure(tournament, {
    names: names(ids),
    manualGroups: [
      ['p1', 'p2', 'p3', 'p4'],
      ['p5', 'p6', 'p7', 'p8']
    ]
  });
  tournament.groups.forEach(group => completeGroup(group, [
    { score: '2:0', sets: '21:15, 21:16' },
    { score: '2:1', sets: '21:18, 18:21, 21:19' },
    { score: '1:1', sets: '21:18, 17:21' }
  ]));
  return { tournament, ids };
}

function testGroupQualificationToKnockout() {
  const { tournament, ids } = createCompletedTwoGroupTournament();
  const standingsA = engine.calculateGroupStandings(tournament.groups[0]);
  const standingsB = engine.calculateGroupStandings(tournament.groups[1]);
  const finalStage = engine.createFinalStageFromGroups(tournament, { names: names(ids) });
  assert.equal(finalStage.participantIds.length, 4);
  const semifinals = finalStage.bracket.filter(match => match.round === 'Półfinał');
  assert.equal(semifinals.length, 2);
  assert.equal(semifinals[0].homeId, standingsA[0].participantId);
  assert.equal(semifinals[0].awayId, standingsB[1].participantId);
  assert.equal(semifinals[1].homeId, standingsB[0].participantId);
  assert.equal(semifinals[1].awayId, standingsA[1].participantId);
}

function testHighLowAndManualPairing() {
  const qualified = [
    { participantId: 'p1', groupPosition: 1, points: 9, wins: 3, setDifference: 5, pointDifference: 20 },
    { participantId: 'p2', groupPosition: 1, points: 8, wins: 2, setDifference: 3, pointDifference: 12 },
    { participantId: 'p3', groupPosition: 2, points: 6, wins: 2, setDifference: 1, pointDifference: 4 },
    { participantId: 'p4', groupPosition: 2, points: 4, wins: 1, setDifference: -2, pointDifference: -8 }
  ];
  assert.deepEqual(
    engine.orderQualifiedParticipants(qualified, 'high_low'),
    ['p1', 'p4', 'p2', 'p3']
  );
  assert.deepEqual(
    engine.orderQualifiedParticipants(qualified, 'manual', ['p3', 'p1', 'p4', 'p2']),
    ['p3', 'p1', 'p4', 'p2']
  );
  assert.throws(
    () => engine.orderQualifiedParticipants(qualified, 'manual', ['p1', 'p2']),
    /wszystkich/
  );
}

function testFinalGroupWithCarriedResult() {
  const { tournament, ids } = createCompletedTwoGroupTournament();
  tournament.format = 'groups_final_group';
  tournament.finalStageConfig = {
    type: 'final_group',
    pairingRule: 'group_result',
    carryGroupResults: true
  };
  const finalStage = engine.createFinalStageFromGroups(tournament, { names: names(ids) });
  assert.equal(finalStage.bracket.length, 0);
  assert.equal(finalStage.finalGroup.participantIds.length, 4);
  assert.equal(finalStage.finalGroup.matches.length, 6);
  assert.ok(finalStage.finalGroup.matches.some(match => match.status === 'completed'));
  tournament.finalGroup = finalStage.finalGroup;
}

function testInvalidManualGroups() {
  assert.throws(() => engine.createGroupStage(['p1', 'p2', 'p3'], {
    groupCount: 2,
    matchesPerPair: 1
  }, {
    manualGroups: [['p1', 'p2'], ['p2', 'p3']]
  }), /dokładnie do jednej grupy/);
}

testKnockoutSizes();
testKnockoutProgression();
testRoundRobinSchedule();
testFourGroupsOfThreeWithReturnMatches();
testGroupStandingsAndDraws();
testGroupQualificationToKnockout();
testHighLowAndManualPairing();
testFinalGroupWithCarriedResult();
testInvalidManualGroups();

console.log('tournament engine stage 2 tests passed');
