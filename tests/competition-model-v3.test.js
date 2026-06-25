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
  vm.runInContext(fs.readFileSync('competition-model.js', 'utf8'), context);
  vm.runInContext(
    fs.readFileSync('data.js', 'utf8')
      + ';globalThis.v3Api={defaultLeagueData,normalizeLoadedData,leagueData,CURRENT_SCHEMA_VERSION};',
    context
  );
  return { context, storage, api: context.v3Api, model: context.competitionModel };
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const initial = createContext();
const data = initial.api.leagueData;

assert.equal(initial.api.CURRENT_SCHEMA_VERSION, 3);
assert.equal(data.schemaVersion, 3);
assert.ok(Array.isArray(data.competitions));
assert.ok(Array.isArray(data.matches));
assert.ok(data.competitions.some(competition => competition.kind === 'league'));
assert.ok(data.competitions.some(competition => competition.kind === 'tournament'));
assert.equal(data.matches.length, 5);
assert.equal(new Set(data.matches.map(match => match.id)).size, data.matches.length);
assert.ok(data.matches.every(match => match.competitionId && match.stageId));
assert.ok(data.matches.every(match => match.homeId && match.awayId));
assert.ok(data.matches.every(match => match.homeId !== match.awayId));
assert.ok(data.matches.every(match => Object.hasOwn(match, 'setScores')));
assert.ok(data.matches.every(match => !Object.keys(match).includes('sets')));
assert.equal(initial.model.validateData(data).length, 0);

const serialized = JSON.stringify(data);
assert.doesNotMatch(serialized, /"tournaments"\s*:/);
assert.doesNotMatch(serialized, /"results"\s*:/);
assert.doesNotMatch(serialized, /"bracket"\s*:/);
assert.match(serialized, /"competitions"\s*:/);
assert.match(serialized, /"matches"\s*:/);
assert.ok(data.matches.every(match => !Object.keys(match).includes('home')));
assert.ok(data.matches.every(match => !Object.keys(match).includes('away')));

const tournament = data.tournaments[0];
const tournamentMatchIds = new Set(tournament.bracket.map(match => match.id));
assert.equal(tournamentMatchIds.size, 3);
assert.ok(tournament.bracket.some(match => match.round === 'Finał'));
assert.ok(tournament.bracket.every(match => match.status === 'completed'));
assert.ok(tournament.bracket.every(match => match.winnerId));

const firstLeagueMatch = data.sports.siatkowka.results[0];
const originalLeagueMatchId = firstLeagueMatch.id;
firstLeagueMatch.scheduledAt = '2026-07-04T16:30:00+02:00';
firstLeagueMatch.roundNumber = 4;
firstLeagueMatch.venue = 'Hala Centrum';
assert.equal(firstLeagueMatch.id, originalLeagueMatchId);
assert.equal(initial.model.normalizeDateTime(firstLeagueMatch.scheduledAt), '2026-07-04T14:30:00.000Z');

const reloaded = createContext(jsonClone(data)).api.leagueData;
assert.equal(reloaded.schemaVersion, 3);
assert.equal(reloaded.matches.length, data.matches.length);
assert.equal(new Set(reloaded.matches.map(match => match.id)).size, reloaded.matches.length);
const restoredLeagueMatch = reloaded.matches.find(match => match.id === originalLeagueMatchId);
assert.equal(restoredLeagueMatch.roundNumber, 4);
assert.equal(restoredLeagueMatch.venue, 'Hala Centrum');
assert.equal(restoredLeagueMatch.scheduledAt, '2026-07-04T14:30:00.000Z');
assert.equal(initial.model.validateData(reloaded).length, 0);

const beforeAdd = reloaded.matches.length;
reloaded.sports.siatkowka.results = [
  ...reloaded.sports.siatkowka.results,
  {
    id: 'match:league:siatkowka:a:test',
    home: 'Orion Poznań B',
    away: 'Neon Wrocław B',
    level: 'A',
    score: '3:1',
    sets: '25:20, 22:25, 25:19, 25:21',
    scoring: 'volleyball',
    status: 'completed',
    scheduledAt: '2026-07-10T18:00:00+02:00',
    roundNumber: 1
  }
];
assert.equal(reloaded.matches.length, beforeAdd + 1);
assert.ok(reloaded.matches.some(match => match.id === 'match:league:siatkowka:a:test'));
assert.ok(reloaded.competitions.some(competition => (
  competition.kind === 'league'
  && competition.sport === 'siatkowka'
  && competition.stages[0].level === 'A'
)));

const tournamentMatchesBefore = reloaded.matches
  .filter(match => match.competitionId === reloaded.tournaments[0].id)
  .map(match => match.id);
reloaded.tournaments = [...reloaded.tournaments];
assert.deepEqual(
  reloaded.matches
    .filter(match => match.competitionId === reloaded.tournaments[0].id)
    .map(match => match.id),
  tournamentMatchesBefore
);

const orphaned = jsonClone(reloaded);
orphaned.matches[0].stageId = 'stage:missing';
assert.ok(initial.model.validateData(orphaned).some(error => error.includes('orphan stage')));

const invalidParticipant = jsonClone(reloaded);
invalidParticipant.matches[0].homeId = 'team:999999';
assert.ok(initial.model.validateData(invalidParticipant).some(error => error.includes('orphan home participant')));

console.log('competition model V3 tests passed');
