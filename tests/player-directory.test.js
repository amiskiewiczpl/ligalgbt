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
    + `;globalThis.playerDirectoryApi={
      leagueData,
      filterAndSortPlayers,
      getPlayerListGroupCounts,
      getPlayerListGroupLabel,
      getPlayerTeamNames
    };`,
  context
);

const api = context.playerDirectoryApi;
const players = api.leagueData.players;
const orionTeam = api.leagueData.clubTeams.find(team => team.club.includes('Orion'));
assert.ok(orionTeam);

const combined = api.filterAndSortPlayers(players, {
  search: '',
  club: orionTeam.club,
  sport: orionTeam.sport,
  team: orionTeam.name,
  sortBy: 'surname',
  direction: 'asc'
});
assert.ok(combined.length > 0);
assert.ok(combined.every(player => player.club === orionTeam.club));
assert.ok(combined.every(player => player.sports.includes(orionTeam.sport)));
assert.ok(combined.every(player => api.getPlayerTeamNames(player.name).includes(orionTeam.name)));

const searchTarget = players.find(player => player.name.split(/\s+/).length > 1);
const surname = searchTarget.name.split(/\s+/).at(-1);
const searched = api.filterAndSortPlayers(players, {
  search: surname.toLocaleLowerCase('pl-PL'),
  club: '',
  sport: '',
  team: '',
  sortBy: 'surname',
  direction: 'asc'
});
assert.ok(searched.some(player => player.id === searchTarget.id));

const incompatible = api.filterAndSortPlayers(players, {
  search: '',
  club: players.find(player => player.club !== orionTeam.club).club,
  sport: orionTeam.sport,
  team: orionTeam.name,
  sortBy: 'surname',
  direction: 'asc'
});
assert.equal(incompatible.length, 0);

const byClub = api.filterAndSortPlayers(players, {
  search: '',
  club: '',
  sport: '',
  team: '',
  sortBy: 'club',
  direction: 'asc'
});
const clubGroups = api.getPlayerListGroupCounts(byClub, 'club');
assert.equal(clubGroups.reduce((sum, group) => sum + group.count, 0), players.length);
assert.equal(new Set(clubGroups.map(group => group.label)).size, clubGroups.length);

const byTeamCountDescending = api.filterAndSortPlayers(players, {
  search: '',
  club: '',
  sport: '',
  team: '',
  sortBy: 'teamCount',
  direction: 'desc'
});
const teamCounts = byTeamCountDescending.map(player => api.getPlayerTeamNames(player.name).length);
assert.deepEqual(teamCounts, [...teamCounts].sort((left, right) => right - left));

const idsBefore = players.map(player => player.id);
api.filterAndSortPlayers(players, {
  search: '',
  club: '',
  sport: '',
  team: '',
  sortBy: 'sport',
  direction: 'desc'
});
assert.deepEqual(players.map(player => player.id), idsBefore);

const scriptSource = fs.readFileSync('script.js', 'utf8');
for (const id of [
  'player-search',
  'player-club-filter',
  'player-sport-filter',
  'player-team-filter',
  'player-sort',
  'player-sort-direction',
  'player-filters-clear',
  'player-visible-count',
  'player-group-counts',
  'player-table-body'
]) {
  assert.match(scriptSource, new RegExp(`id="${id}"`));
}
assert.match(scriptSource, /tableBody\.addEventListener\('click'/);
assert.match(scriptSource, /data-player-action="edit"/);
assert.match(scriptSource, /data-player-action="delete"/);

console.log('player directory stage 7 tests passed');
