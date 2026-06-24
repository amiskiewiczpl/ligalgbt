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
    + `;globalThis.sortingApi={
      leagueData,
      comparePolish,
      stableSort,
      getPersonNameParts,
      getPersonSortKey,
      sortPlayers,
      sortClubs,
      sortClubTeams,
      compareCompetitionLevels,
      getClubOptions,
      getLeagueParticipants
    };`,
  context
);

const api = context.sortingApi;

assert.equal(api.getPersonSortKey('Jakub Kowalski'), 'Kowalski, Jakub');
assert.equal(api.getPersonSortKey('Anna Maria Nowak'), 'Nowak, Anna Maria');
assert.deepEqual(
  JSON.parse(JSON.stringify(api.getPersonNameParts('Anna Maria Nowak'))),
  { surname: 'Nowak', givenNames: 'Anna Maria' }
);

const players = [
  { id: 1, name: 'Jan Żak' },
  { id: 2, name: 'Ewa Łuczak' },
  { id: 3, name: 'Adam Adamczyk' },
  { id: 4, name: 'Maria Ćwikła' },
  { id: 5, name: 'Anna Nowak' },
  { id: 6, name: 'Beata Nowak' }
];
const originalPlayerIds = players.map(player => player.id);
assert.deepEqual(
  api.sortPlayers(players).map(player => player.name),
  ['Adam Adamczyk', 'Maria Ćwikła', 'Ewa Łuczak', 'Anna Nowak', 'Beata Nowak', 'Jan Żak']
);
assert.deepEqual(players.map(player => player.id), originalPlayerIds);

const appendedPlayers = [...players, { id: 7, name: 'Karol Kowalski' }];
assert.equal(api.sortPlayers(appendedPlayers).findIndex(player => player.id === 7), 2);

const clubs = [
  { id: 1, name: 'Żagiel' },
  { id: 2, name: 'Łączność' },
  { id: 3, name: 'Alfa' }
];
assert.deepEqual(api.sortClubs(clubs).map(club => club.name), ['Alfa', 'Łączność', 'Żagiel']);
assert.deepEqual(clubs.map(club => club.id), [1, 2, 3]);

const teams = [
  { id: 1, name: 'Zespół D', club: 'Orion', sport: 'siatkowka', level: 'D' },
  { id: 2, name: 'Zespół bez', club: 'Neon', sport: 'siatkowka', level: '' },
  { id: 3, name: 'Zespół B minus', club: 'Volup', sport: 'siatkowka', level: 'B-' },
  { id: 4, name: 'Zespół A', club: 'Dragons', sport: 'siatkowka', level: 'A' },
  { id: 5, name: 'Zespół C', club: 'Neon', sport: 'siatkowka', level: 'C' },
  { id: 6, name: 'Zespół B', club: 'Orion', sport: 'siatkowka', level: 'B' }
];
assert.deepEqual(
  api.sortClubTeams(teams, 'level').map(team => team.level),
  ['A', 'B', 'B-', 'C', 'D', '']
);
assert.deepEqual(
  api.sortClubTeams(teams, 'club').map(team => team.club),
  ['Dragons', 'Neon', 'Neon', 'Orion', 'Orion', 'Volup']
);
assert.deepEqual(teams.map(team => team.id), [1, 2, 3, 4, 5, 6]);

const stableItems = [
  { id: 1, name: 'Orion' },
  { id: 2, name: 'orion' },
  { id: 3, name: 'ORION' }
];
assert.deepEqual(api.sortClubs(stableItems).map(item => item.id), [1, 2, 3]);

const clubOptions = api.getClubOptions();
const optionNames = [...clubOptions.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(match => match[1]);
assert.deepEqual(optionNames, [...optionNames].sort((left, right) => api.comparePolish(left, right)));

const bTeams = api.getLeagueParticipants('siatkowka', 'B');
assert.deepEqual(
  bTeams.map(team => team.name),
  [...bTeams.map(team => team.name)].sort((left, right) => api.comparePolish(left, right))
);

const scriptSource = fs.readFileSync('script.js', 'utf8');
assert.match(scriptSource, /id="club-team-sort"/);
assert.match(scriptSource, /adminTeamSort = event\.target\.value/);
assert.match(scriptSource, /sortPlayers\(leagueData\.players\)/);
assert.match(scriptSource, /sortClubs\(leagueData\.teams\)/);

console.log('sorting stage 6 tests passed');
