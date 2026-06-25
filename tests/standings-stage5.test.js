const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {
  console,
  structuredClone,
  URLSearchParams,
  encodeURIComponent,
  Intl,
  localStorage: {
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {}
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
vm.runInContext(fs.readFileSync('tournament-engine.js', 'utf8'), context);
vm.runInContext(
  fs.readFileSync('script.js', 'utf8')
    + `;globalThis.standingsStage5Api={
      leagueData,
      calculateStandings,
      getTieGroups,
      getLatestCompletedMatchesForLevel,
      sortStandingsForView,
      standingsSortState,
      getStandingsSortKey,
      renderStandingsRows,
      renderLevelStandingsSections
    };`,
  context
);

const api = context.standingsStage5Api;
api.leagueData.clubTeams = [
  { id: 101, name: 'Alfa B', club: 'Orion Poznań', sport: 'siatkowka', level: 'B', roster: [] },
  { id: 102, name: 'Beta B', club: 'Neon Wrocław', sport: 'siatkowka', level: 'B', roster: [] },
  { id: 103, name: 'Gamma B', club: 'Volup Warszawa', sport: 'siatkowka', level: 'B', roster: [] },
  { id: 104, name: 'Delta B', club: 'Dragons Kraków', sport: 'siatkowka', level: 'B', roster: [] },
  { id: 105, name: 'Jedyna A', club: 'Unicorns Łódź', sport: 'siatkowka', level: 'A', roster: [] }
];

api.leagueData.sports.siatkowka.results = [
  {
    id: 'a-b',
    level: 'B',
    home: 'Alfa B',
    away: 'Beta B',
    score: '3:0',
    sets: '25:20, 25:20, 25:20',
    scoring: 'volleyball',
    status: 'completed',
    scheduledAt: '2027-03-15T18:00:00+01:00'
  },
  {
    id: 'c-a',
    level: 'B',
    home: 'Gamma B',
    away: 'Alfa B',
    score: '3:0',
    sets: '25:20, 25:20, 25:20',
    scoring: 'volleyball',
    status: 'completed',
    scheduledAt: '2027-03-10T18:00:00+01:00'
  },
  {
    id: 'b-d',
    level: 'B',
    home: 'Beta B',
    away: 'Delta B',
    score: '3:0',
    sets: '25:20, 25:20, 25:20',
    scoring: 'volleyball',
    status: 'completed',
    scheduledAt: '2027-03-05T18:00:00+01:00'
  },
  {
    id: 'scheduled',
    level: 'B',
    home: 'Alfa B',
    away: 'Delta B',
    score: '',
    sets: '',
    scoring: 'volleyball',
    status: 'scheduled',
    scheduledAt: '2027-03-20T18:00:00+01:00'
  }
];

const levelB = api.calculateStandings('siatkowka', 'B');
assert.equal(levelB.length, 4);
assert.equal(levelB.find(row => row.name === 'Alfa B').played, 2);
assert.equal(levelB.find(row => row.name === 'Delta B').played, 1);
assert.equal(levelB.find(row => row.name === 'Alfa B').officialPosition, 1);
assert.equal(levelB.find(row => row.name === 'Beta B').officialPosition, 2);
assert.ok(
  levelB.find(row => row.name === 'Alfa B').officialPosition
    < levelB.find(row => row.name === 'Beta B').officialPosition,
  'Bilans bezpośredni Alfa-Beta musi rozstrzygnąć ich pełny remis statystyczny'
);
assert.equal(api.calculateStandings('siatkowka').length, 0);
assert.equal(api.calculateStandings('siatkowka', 'A').length, 1);

const latest = api.getLatestCompletedMatchesForLevel('siatkowka', 'B');
assert.deepEqual(
  JSON.parse(JSON.stringify(latest.map(match => match.id))),
  ['a-b', 'c-a', 'b-d']
);
assert.equal(new Set(latest.map(match => match.id)).size, latest.length);

const sortKey = api.getStandingsSortKey('siatkowka', 'B');
api.standingsSortState.set(sortKey, { key: 'wins', direction: 'asc' });
const sortedView = api.sortStandingsForView(levelB, 'siatkowka', 'B');
assert.equal(sortedView[0].wins, 0);
assert.deepEqual(
  [...sortedView.map(row => row.officialPosition)].sort((left, right) => left - right),
  [1, 2, 3, 4]
);

api.leagueData.players.push({
  id: 999,
  name: 'Nowa Osoba',
  club: 'Orion Poznań',
  sports: ['badminton'],
  bio: ''
});
api.leagueData.sports.badminton.results = [
  {
    id: 'draw',
    home: 'Anna Zielińska',
    away: 'Nowa Osoba',
    score: '1:1',
    sets: '21:18, 17:21',
    scoring: 'sets',
    allowDraw: true,
    pointsRules: { win: 3, draw: 1, loss: 0 },
    phaseType: 'league',
    status: 'completed'
  }
];
const drawRows = api.calculateStandings('badminton');
assert.equal(drawRows.length, 2);
assert.ok(drawRows.every(row => row.draws === 1));
assert.ok(drawRows.every(row => row.points === 1));

const html = api.renderStandingsRows(levelB, 'siatkowka', 'B');
assert.match(html, /aria-sort="ascending"/);
assert.match(html, /data-standings-sort="points"/);
assert.match(html, /oficjalnie/);
assert.match(html, />R</);
assert.match(html, /\+\/− setów/);
assert.match(html, /\+\/− małych/);

const source = fs.readFileSync('script.js', 'utf8');
assert.match(source, /match\.status === 'completed'/);
assert.match(source, /function bindStandingsSorting/);
assert.match(source, /getLatestCompletedMatchesForLevel/);
assert.match(source, /row\.officialPosition === rows\.length/);

console.log('standings, draws and sorting stage 5 tests passed');
