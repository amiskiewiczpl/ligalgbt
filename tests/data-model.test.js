const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createContext(storedData = null) {
  const storage = new Map();
  if (storedData) storage.set('ligaLgbtData', JSON.stringify(storedData));
  const context = {
    console,
    structuredClone,
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
      leagueStore: null
    },
    document: {
      body: { dataset: {} },
      documentElement: { dataset: {} }
    },
    setTimeout() {},
    clearTimeout() {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('data.js', 'utf8'), context);
  vm.runInContext(
    fs.readFileSync('script.js', 'utf8')
      + ';globalThis.testApi={normalizeLoadedData,normalizeTournament,validateMatchResult,getMatchPoints,getScoreOptions,getSetCountFromScore,CURRENT_SCHEMA_VERSION,leagueData};',
    context
  );
  return { context, storage, api: context.testApi };
}

function createLegacySnapshot() {
  const { api } = createContext();
  const legacy = structuredClone(api.leagueData);
  delete legacy.schemaVersion;
  legacy.sports.siatkowka.results.forEach(match => {
    delete match.phaseType;
    delete match.allowDraw;
    delete match.pointsRules;
    delete match.status;
  });
  legacy.tournaments.forEach(tournament => {
    [
      'format',
      'participantType',
      'participantIds',
      'seeding',
      'allowDraws',
      'pointsRules',
      'groupConfig',
      'finalStageConfig',
      'groups'
    ].forEach(key => delete tournament[key]);
    tournament.bracket.forEach(match => {
      [
        'id',
        'homeId',
        'awayId',
        'winnerId',
        'roundIndex',
        'matchIndex',
        'status',
        'phaseType',
        'allowDraw',
        'pointsRules'
      ].forEach(key => delete match[key]);
    });
  });
  return legacy;
}

function run() {
  const legacy = createLegacySnapshot();
  const legacyResultCount = Object.values(legacy.sports)
    .reduce((total, sport) => total + sport.results.length, 0);
  const legacyBracketCount = legacy.tournaments[0].bracket.length;
  const legacyClassificationCount = legacy.tournaments[0].finalClassification.length;

  const { api } = createContext(legacy);
  const migrated = api.leagueData;
  assert.equal(migrated.schemaVersion, api.CURRENT_SCHEMA_VERSION);
  assert.equal(
    Object.values(migrated.sports).reduce((total, sport) => total + sport.results.length, 0),
    legacyResultCount
  );
  assert.equal(migrated.tournaments[0].bracket.length, legacyBracketCount);
  assert.equal(migrated.tournaments[0].finalClassification.length, legacyClassificationCount);

  const tournament = migrated.tournaments[0];
  assert.equal(tournament.format, 'knockout');
  assert.equal(tournament.participantType, 'player');
  assert.equal(tournament.seeding, 'manual');
  assert.equal(tournament.allowDraws, false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(tournament.pointsRules)),
    { win: 3, draw: 1, loss: 0 }
  );
  assert.ok(tournament.participantIds.every(reference => reference.startsWith('player:')));
  assert.ok(tournament.bracket.every(match => match.id && match.homeId && match.awayId));
  assert.ok(tournament.bracket.every(match => Number.isInteger(match.roundIndex)));
  assert.ok(tournament.bracket.every(match => Number.isInteger(match.matchIndex)));
  assert.ok(tournament.bracket.every(match => match.winner && match.winnerId));
  assert.equal(tournament.finalStageConfig.participantCount, tournament.participants.length);

  const draw = {
    score: '1:1',
    sets: '21:18, 16:21',
    scoring: 'sets',
    phaseType: 'group',
    allowDraw: true,
    pointsRules: { win: 3, draw: 1, loss: 0 }
  };
  assert.equal(api.validateMatchResult(draw).valid, true);
  assert.equal(api.getSetCountFromScore('1:1'), 2);
  assert.match(api.getScoreOptions('sets', '', { allowDraw: true }), />1:1</);
  assert.equal(api.getMatchPoints(draw, 'home'), 1);
  assert.equal(api.getMatchPoints(draw, 'away'), 1);

  const forbiddenDraw = api.validateMatchResult(draw, { allowDraw: false });
  assert.equal(forbiddenDraw.valid, false);
  assert.match(forbiddenDraw.message, /Remis/);

  const invalidDraw = api.validateMatchResult({
    ...draw,
    sets: '21:18, 21:19'
  });
  assert.equal(invalidDraw.valid, false);

  const scheduled = api.validateMatchResult(
    { score: '0:0', sets: '', status: 'scheduled' },
    { allowScheduled: true }
  );
  assert.equal(scheduled.valid, true);
  assert.equal(scheduled.status, 'scheduled');

  const groupTournament = api.normalizeTournament({
    id: 99,
    name: 'Group test',
    sport: 'tenis',
    format: 'groups_knockout',
    scoring: 'sets',
    status: 'planned',
    participants: tournament.participants.slice(0, 4),
    allowDraws: true,
    pointsRules: { win: 4, draw: 2, loss: 0 },
    groupConfig: {
      groupCount: 1,
      participantsPerGroup: 4,
      matchesPerPair: 2,
      qualifiersPerGroup: 2
    },
    finalStageConfig: {
      type: 'knockout',
      participantCount: 2,
      pairingRule: 'group_result'
    },
    groups: [{
      name: 'A',
      participants: tournament.participants.slice(0, 4),
      matches: [{
        home: tournament.participants[0],
        away: tournament.participants[1],
        score: '1:1',
        sets: '21:18, 17:21'
      }]
    }],
    bracket: [],
    finalClassification: []
  }, migrated);

  assert.equal(groupTournament.format, 'groups_knockout');
  assert.equal(groupTournament.groupConfig.matchesPerPair, 2);
  assert.equal(groupTournament.finalStageConfig.pairingRule, 'group_result');
  assert.equal(groupTournament.groups[0].matches[0].allowDraw, true);
  assert.equal(groupTournament.groups[0].matches[0].phaseType, 'group');
  assert.ok(groupTournament.groups[0].participantIds.length > 0);
  assert.ok(groupTournament.groups[0].matches[0].homeId);

  const roundTrip = api.normalizeLoadedData(JSON.parse(JSON.stringify({
    ...migrated,
    tournaments: [...migrated.tournaments, groupTournament]
  })));
  const restored = roundTrip.tournaments.find(item => item.id === 99);
  assert.equal(restored.format, 'groups_knockout');
  assert.equal(restored.pointsRules.draw, 2);
  assert.equal(restored.groups[0].matches[0].score, '1:1');
  assert.equal(restored.finalStageConfig.participantCount, 2);

  groupTournament.format = 'groups_final_group';
  groupTournament.finalStageConfig.type = 'final_group';
  groupTournament.finalGroup = {
    id: 'final-group-99',
    name: 'Grupa finałowa',
    participants: groupTournament.participants.slice(0, 2),
    matches: [{
      home: groupTournament.participants[0],
      away: groupTournament.participants[1],
      score: '1:1',
      sets: '21:18, 17:21'
    }]
  };
  const finalGroupRoundTrip = api.normalizeLoadedData(JSON.parse(JSON.stringify({
    ...migrated,
    tournaments: [groupTournament]
  }))).tournaments[0];
  assert.equal(finalGroupRoundTrip.finalGroup.name, 'Grupa finałowa');
  assert.equal(finalGroupRoundTrip.finalGroup.matches[0].phaseType, 'final_group');
  assert.ok(finalGroupRoundTrip.finalGroup.matches[0].homeId);

  console.log('data model stage 1 tests passed');
}

run();
