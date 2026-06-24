const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const storage = new Map();
const context = {
  console,
  structuredClone,
  URLSearchParams,
  encodeURIComponent,
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
vm.runInContext(fs.readFileSync('data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('tournament-engine.js', 'utf8'), context);
vm.runInContext(
  fs.readFileSync('script.js', 'utf8')
    + `;globalThis.resultFormApi={
      leagueData,
      getLeagueParticipants,
      validateLeagueMatchSelection,
      getTournamentsForSport,
      getTournamentPhaseEntries,
      getTournamentMatchSelection,
      validateTournamentMatchSelection,
      getMatchMvpNames,
      getScoreOptions
    };`,
  context
);

const api = context.resultFormApi;
const levelB = api.getLeagueParticipants('siatkowka', 'B');
assert.ok(levelB.length >= 2);
assert.ok(levelB.every(team => team.level === 'B'));
assert.equal(api.getLeagueParticipants('siatkowka', 'C').some(team => team.level === 'B'), false);

assert.equal(api.validateLeagueMatchSelection(
  'siatkowka',
  'B',
  levelB[0].name,
  levelB[1].name
).valid, true);
assert.equal(
  api.validateLeagueMatchSelection('siatkowka', 'C', levelB[0].name, levelB[1].name).valid,
  false
);
assert.equal(
  api.validateLeagueMatchSelection('siatkowka', 'B', levelB[0].name, levelB[0].name).valid,
  false
);

const tennisTournaments = api.getTournamentsForSport('tenis');
assert.ok(tennisTournaments.length > 0);
assert.equal(api.getTournamentsForSport('siatkowka').some(tournament => tournament.sport !== 'siatkowka'), false);

const tournament = tennisTournaments[0];
const phases = api.getTournamentPhaseEntries(tournament);
assert.ok(phases.length > 0);
const phase = phases.find(item => item.matches.some(match => match.home && match.away));
assert.ok(phase);
const match = phase.matches.find(item => item.home && item.away);
assert.equal(api.getTournamentMatchSelection(tournament, phase.key, match.id).match.id, match.id);
assert.equal(api.validateTournamentMatchSelection(tournament, phase.key, match.id).valid, true);
assert.equal(api.validateTournamentMatchSelection(tournament, 'group:missing', match.id).valid, false);

const invalidRegistration = structuredClone(tournament);
invalidRegistration.participants = invalidRegistration.participants.filter(name => name !== match.home);
assert.equal(api.validateTournamentMatchSelection(invalidRegistration, phase.key, match.id).valid, false);

assert.match(api.getScoreOptions('sets', '', { allowDraw: true }), /value="1:1"/);
assert.doesNotMatch(api.getScoreOptions('sets', '', { allowDraw: false }), /value="1:1"/);

const mvpNames = api.getMatchMvpNames('siatkowka', levelB[0].name, levelB[1].name);
const expectedMvpNames = [...levelB[0].roster, ...levelB[1].roster];
assert.ok(mvpNames.length > 0);
assert.ok(mvpNames.every(name => expectedMvpNames.includes(name)));

const scriptSource = fs.readFileSync('script.js', 'utf8');
assert.match(scriptSource, /name="competition"/);
assert.match(scriptSource, /name="tournament"/);
assert.match(scriptSource, /name="phase"/);
assert.match(scriptSource, /name="match"/);
assert.match(scriptSource, /recordKnockoutResult/);
assert.match(scriptSource, /recordGroupResult/);

console.log('result form stage 5 tests passed');
