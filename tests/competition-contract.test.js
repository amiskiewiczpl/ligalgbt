const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('../tournament-engine.js');

function createApplicationContext() {
  const storage = new Map();
  const context = {
    console,
    structuredClone,
    URLSearchParams,
    encodeURIComponent,
    Intl,
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    window: {
      addEventListener() {},
      requestAnimationFrame(callback) {
        callback();
      },
      location: { search: '' },
      leagueStore: null
    },
    document: {
      body: { dataset: {} },
      documentElement: { dataset: {} },
      querySelector() {
        return null;
      },
      getElementById() {
        return null;
      }
    },
    setTimeout() {},
    clearTimeout() {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('competition-model.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('data.js', 'utf8'), context);
  vm.runInContext(
    fs.readFileSync('script.js', 'utf8')
      + `;globalThis.contractApi={
        leagueData,
        calculateStandings,
        validateMatchResult
      };`,
    context
  );
  return context.contractApi;
}

function createLevelTeams() {
  return ['A', 'B', 'B-', 'C', 'D'].map((level, index) => ({
    id: index + 1,
    name: `Drużyna ${level}`,
    club: `Klub ${level}`,
    sport: 'siatkowka',
    level,
    description: '',
    roster: []
  }));
}

function sortStandingsView(rows, key, direction = 'desc') {
  const modifier = direction === 'asc' ? 1 : -1;
  return rows
    .map((row, sourceIndex) => ({ ...row, sourceIndex }))
    .sort((left, right) => {
      const leftValue = left[key];
      const rightValue = right[key];
      const comparison = typeof leftValue === 'string'
        ? leftValue.localeCompare(rightValue, 'pl')
        : Number(leftValue) - Number(rightValue);
      return comparison * modifier || left.sourceIndex - right.sourceIndex;
    })
    .map((row, index) => ({
      ...row,
      displayNumber: index + 1
    }));
}

function latestCompletedMatchesPerParticipant(matches) {
  const latestByParticipant = new Map();
  matches
    .filter(match => match.status === 'completed' && match.scheduledAt)
    .sort((left, right) => Date.parse(right.scheduledAt) - Date.parse(left.scheduledAt))
    .forEach(match => {
      [match.homeId, match.awayId].forEach(participantId => {
        if (!latestByParticipant.has(participantId)) latestByParticipant.set(participantId, match);
      });
    });
  return [...new Map(
    [...latestByParticipant.values()].map(match => [match.id, match])
  ).values()].sort((left, right) => Date.parse(right.scheduledAt) - Date.parse(left.scheduledAt));
}

function calendarEvents(matches) {
  return matches
    .filter(match => match.scheduledAt)
    .map(match => ({
      id: match.id,
      competitionId: match.competitionId,
      stageId: match.stageId,
      roundNumber: match.roundNumber,
      scheduledAt: match.scheduledAt,
      status: match.status
    }))
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
}

function validateStageContract(stages) {
  const allowedTypes = new Set(['round_robin', 'groups', 'knockout']);
  assert.ok(stages.length >= 1 && stages.length <= 3);
  stages.forEach((stage, index) => {
    assert.equal(stage.order, index + 1);
    assert.ok(allowedTypes.has(stage.type));
    assert.ok(stage.id);
    assert.ok(stage.name);
    if (index > 0) assert.ok(stage.qualificationRule);
  });
}

function testLevelIsolationWithoutAggregateTable() {
  const api = createApplicationContext();
  api.leagueData.clubTeams = createLevelTeams();
  api.leagueData.sports.siatkowka.results = [];

  const aggregate = api.calculateStandings('siatkowka');
  assert.equal(aggregate.length, 0, 'Tabela bez poziomu nie może mieszać poziomów ligi');

  const scriptSource = fs.readFileSync('script.js', 'utf8');
  assert.match(scriptSource, /function renderLevelStandingsSections\(sportKey, options = \{\}\)/);
  assert.match(scriptSource, /visibleLevels\.map\(level =>/);
  assert.doesNotMatch(
    scriptSource,
    /renderAdminStandings[\s\S]{0,500}renderStandingsTable\(key\)/,
    'Panel administratora nie może renderować zbiorczej tabeli poziomów'
  );
}

function testZeroMatchTeamsOnEveryLevel() {
  const api = createApplicationContext();
  api.leagueData.clubTeams = createLevelTeams();
  api.leagueData.sports.siatkowka.results = [];

  ['A', 'B', 'B-', 'C', 'D'].forEach(level => {
    const rows = api.calculateStandings('siatkowka', level);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, `Drużyna ${level}`);
    assert.equal(rows[0].level, level);
    ['played', 'wins', 'losses', 'setsWon', 'setsLost', 'pointsFor', 'pointsAgainst', 'points']
      .forEach(key => assert.equal(rows[0][key], 0, `${level}.${key} should start at zero`));
  });
}

function testDrawStandingsContract() {
  const [group] = engine.createGroupStage(['team:1', 'team:2'], {
    groupCount: 1,
    matchesPerPair: 1
  }, {
    tournamentId: 'draw-contract',
    seeding: 'manual',
    allowDraws: true,
    pointsRules: { win: 3, draw: 1, loss: 0 }
  });
  engine.recordGroupResult(group, group.matches[0].id, {
    score: '1:1',
    sets: '21:18, 17:21'
  });
  const rows = engine.calculateGroupStandings(group);
  assert.ok(rows.every(row => row.played === 1));
  assert.ok(rows.every(row => row.draws === 1));
  assert.ok(rows.every(row => row.wins === 0 && row.losses === 0));
  assert.ok(rows.every(row => row.points === 1));

  const api = createApplicationContext();
  assert.equal(api.validateMatchResult({
    score: '1:1',
    sets: '21:18, 17:21',
    allowDraw: true
  }).valid, true);
}

function testSortableTableContract() {
  const rows = [
    { officialPosition: 1, name: 'Alfa', played: 3, wins: 2, draws: 1, losses: 0, setsWon: 7, pointsFor: 140, points: 7 },
    { officialPosition: 2, name: 'Beta', played: 3, wins: 1, draws: 1, losses: 1, setsWon: 5, pointsFor: 128, points: 4 },
    { officialPosition: 3, name: 'Gamma', played: 3, wins: 0, draws: 0, losses: 3, setsWon: 2, pointsFor: 101, points: 0 }
  ];
  const sortableKeys = ['officialPosition', 'name', 'played', 'wins', 'draws', 'losses', 'setsWon', 'pointsFor', 'points'];
  sortableKeys.forEach(key => {
    ['asc', 'desc'].forEach(direction => {
      const sorted = sortStandingsView(rows, key, direction);
      assert.deepEqual(sorted.map(row => row.displayNumber), [1, 2, 3]);
      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1][key];
        const current = sorted[index][key];
        const comparison = typeof previous === 'string'
          ? previous.localeCompare(current, 'pl')
          : Number(previous) - Number(current);
        assert.ok(
          direction === 'asc' ? comparison <= 0 : comparison >= 0,
          `${key} should be sorted ${direction}`
        );
      }
      assert.deepEqual(
        [...sorted.map(row => row.officialPosition)].sort((a, b) => a - b),
        [1, 2, 3],
        'View sorting must preserve official positions'
      );
    });
  });
  assert.deepEqual(
    sortStandingsView(rows, 'wins', 'asc').map(row => row.name),
    ['Gamma', 'Beta', 'Alfa']
  );
}

function testLatestMatchPerTeamContract() {
  const matches = [
    { id: 'm1', homeId: 'a', awayId: 'b', status: 'completed', scheduledAt: '2026-06-01T18:00:00+02:00' },
    { id: 'm2', homeId: 'a', awayId: 'c', status: 'completed', scheduledAt: '2026-06-10T18:00:00+02:00' },
    { id: 'm3', homeId: 'b', awayId: 'c', status: 'completed', scheduledAt: '2026-06-08T18:00:00+02:00' },
    { id: 'm4', homeId: 'd', awayId: 'a', status: 'scheduled', scheduledAt: '2026-06-20T18:00:00+02:00' }
  ];
  const latest = latestCompletedMatchesPerParticipant(matches);
  assert.deepEqual(latest.map(match => match.id), ['m2', 'm3']);
  assert.equal(new Set(latest.map(match => match.id)).size, latest.length);
}

function testCalendarContract() {
  const matches = [
    {
      id: 'league-1',
      competitionId: 'league-a',
      stageId: 'level-a',
      roundNumber: 1,
      scheduledAt: '2026-07-01T18:30:00+02:00',
      status: 'scheduled'
    },
    {
      id: 'tournament-1',
      competitionId: 'summer-cup',
      stageId: 'group-a',
      roundNumber: 2,
      scheduledAt: '2026-06-28T12:00:00+02:00',
      status: 'completed'
    },
    {
      id: 'legacy-undated',
      competitionId: 'legacy',
      stageId: 'legacy-stage',
      roundNumber: null,
      scheduledAt: null,
      status: 'completed'
    }
  ];
  const events = calendarEvents(matches);
  assert.deepEqual(events.map(event => event.id), ['tournament-1', 'league-1']);
  assert.ok(events.every(event => event.competitionId && event.stageId));
  assert.ok(events.every(event => Number.isInteger(event.roundNumber)));
}

function testTournamentStageScenarios() {
  const oneStage = [
    { id: 'league-table', order: 1, name: 'Każdy z każdym', type: 'round_robin' }
  ];
  const twoStages = [
    { id: 'groups', order: 1, name: 'Faza grupowa', type: 'groups' },
    {
      id: 'playoff',
      order: 2,
      name: 'Play-off',
      type: 'knockout',
      qualificationRule: { type: 'places_per_group', count: 2 }
    }
  ];
  const threeStages = [
    { id: 'opening-groups', order: 1, name: 'Grupy eliminacyjne', type: 'groups' },
    {
      id: 'final-group',
      order: 2,
      name: 'Grupa finałowa',
      type: 'round_robin',
      qualificationRule: { type: 'best_overall', count: 4 }
    },
    {
      id: 'medal-playoff',
      order: 3,
      name: 'Faza medalowa',
      type: 'knockout',
      qualificationRule: { type: 'stage_positions', positions: [1, 2, 3, 4] }
    }
  ];
  [oneStage, twoStages, threeStages].forEach(validateStageContract);

  const roundRobin = engine.createGroupStage(['p1', 'p2', 'p3', 'p4'], {
    groupCount: 1,
    matchesPerPair: 1
  }, {
    tournamentId: 'one-stage',
    seeding: 'manual'
  });
  assert.equal(roundRobin[0].matches.length, 6);

  const groups = engine.createGroupStage(['p1', 'p2', 'p3', 'p4'], {
    groupCount: 2,
    participantsPerGroup: 2,
    matchesPerPair: 1
  }, {
    tournamentId: 'two-stage',
    seeding: 'manual'
  });
  assert.equal(groups.length, 2);
  assert.ok(groups.every(group => group.matches.length === 1));

  const bracket = engine.createKnockoutBracket(['p1', 'p2', 'p3', 'p4'], {
    tournamentId: 'three-stage-final',
    seeding: 'manual'
  });
  assert.equal(bracket.filter(match => !match.isThirdPlace).length, 3);
}

testLevelIsolationWithoutAggregateTable();
testZeroMatchTeamsOnEveryLevel();
testDrawStandingsContract();
testSortableTableContract();
testLatestMatchPerTeamContract();
testCalendarContract();
testTournamentStageScenarios();

console.log('competition system stage 0 contract tests passed');
