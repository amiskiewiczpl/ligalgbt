const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

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
    location: {
      search: '',
      pathname: '/admin-wyniki.html'
    },
    history: {
      replaceState(_state, _title, url) {
        context.lastHistoryUrl = url;
      }
    },
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
vm.runInContext(fs.readFileSync('tournament-engine.js', 'utf8'), context);
vm.runInContext(
  fs.readFileSync('script.js', 'utf8')
    + `;globalThis.matchSchedulingApi={
      leagueData,
      getLeagueScheduleMatches,
      validateLeagueScheduleEntry,
      saveLeagueScheduleEntry,
      validateExistingMatchForResult,
      getAdminResultPreferences,
      saveAdminResultPreferences,
      getAdminResultEditHref,
      getTournamentPhaseEntries
    };`,
  context
);

const api = context.matchSchedulingApi;
const teams = api.leagueData.clubTeams.filter(team => team.sport === 'siatkowka' && team.level === 'B');
assert.ok(teams.length >= 2);

const entry = {
  sport: 'siatkowka',
  season: '2027',
  level: 'B',
  roundNumber: 1,
  scheduledAt: '2027-02-10T18:30',
  venue: 'Hala Centrum',
  home: teams[0].name,
  away: teams[1].name
};

assert.equal(api.validateLeagueScheduleEntry(entry).valid, true);
const created = api.saveLeagueScheduleEntry(entry);
assert.equal(created.valid, true);
assert.equal(created.created, true);
assert.equal(created.match.status, 'scheduled');
assert.equal(created.match.roundNumber, 1);
assert.ok(created.match.scheduledAt);
assert.equal(created.competition.season, '2027');
assert.equal(created.stage.level, 'B');
assert.deepEqual(
  new Set([created.match.home, created.match.away]),
  new Set([teams[0].name, teams[1].name])
);

assert.equal(api.validateLeagueScheduleEntry({
  ...entry,
  home: entry.away,
  away: entry.home
}).valid, false, 'Odwrócona para nie może dublować meczu w tej samej kolejce');

assert.equal(api.validateLeagueScheduleEntry({
  ...entry,
  roundNumber: 2,
  away: entry.home
}).valid, false, 'Uczestnik nie może grać przeciwko sobie');

assert.equal(api.validateLeagueScheduleEntry({
  ...entry,
  level: 'C'
}).valid, false, 'Drużyny poziomu B nie mogą trafić do terminarza poziomu C');

const levelMatches = api.getLeagueScheduleMatches('siatkowka', 'B', '2027');
assert.equal(levelMatches.length, 1);
assert.equal(levelMatches[0].id, created.match.id);
assert.equal(api.getLeagueScheduleMatches('siatkowka', 'C', '2027').length, 0);

assert.equal(api.validateExistingMatchForResult(created.match, {
  kind: 'league',
  sport: 'siatkowka',
  level: 'B'
}).valid, true);
assert.equal(api.validateExistingMatchForResult(created.match, {
  kind: 'league',
  sport: 'siatkowka',
  level: 'C'
}).valid, false);
assert.equal(api.validateExistingMatchForResult({
  ...created.match,
  scheduledAt: null
}, {
  kind: 'league',
  sport: 'siatkowka',
  level: 'B'
}).valid, false, 'Wynik wymaga daty meczu');

api.saveAdminResultPreferences({
  sport: 'siatkowka',
  competition: 'league',
  level: 'B'
});
assert.deepEqual(
  JSON.parse(storage.get('ligalgbt-admin-results-filters-v1')),
  { sport: 'siatkowka', competition: 'league', level: 'B' }
);
assert.match(context.lastHistoryUrl, /sport=siatkowka/);
assert.match(context.lastHistoryUrl, /level=B/);

const tournament = api.leagueData.tournaments.find(item => (
  api.getTournamentPhaseEntries(item).some(phase => phase.matches.length)
));
assert.ok(tournament);
const tournamentMatch = api.getTournamentPhaseEntries(tournament)
  .flatMap(phase => phase.matches)
  .find(match => match.home && match.away);
assert.ok(tournamentMatch);
const href = api.getAdminResultEditHref(tournament, tournamentMatch);
assert.match(href, /^admin-wyniki\.html\?/);
assert.match(href, /competition=tournament/);
assert.match(href, new RegExp(`match=${encodeURIComponent(tournamentMatch.id)}`));

const source = fs.readFileSync('script.js', 'utf8');
assert.match(source, /Dodaj mecz do terminarza ligi/);
assert.match(source, /Wpisz wynik istniejącego meczu/);
assert.match(source, /Najpierw ustaw datę meczu w terminarzu/);
assert.match(source, /getAdminResultEditHref\(tournament, match\)/);

console.log('match scheduling and logical results stage 4 tests passed');
