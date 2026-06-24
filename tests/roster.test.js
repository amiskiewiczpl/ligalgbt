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
    + `;globalThis.rosterApi={
      leagueData,
      getSortedRosterNames,
      getTeamRosterNames,
      getRosterSelectOptions,
      renderRoster,
      renderRosterSection,
      removePlayerReferences,
      comparePeople
    };`,
  context
);

const api = context.rosterApi;
const team = api.leagueData.clubTeams.find(item => item.roster?.length >= 2);
assert.ok(team);

const roster = api.getTeamRosterNames(team);
assert.equal(roster.length, team.roster.length);
assert.deepEqual(
  roster,
  [...roster].sort((left, right) => api.comparePeople(left, right))
);
assert.ok(roster.every(name => {
  const player = api.leagueData.players.find(item => item.name === name);
  return player.club === team.club && player.sports.includes(team.sport);
}));

const section = api.renderRosterSection(roster);
assert.match(section, new RegExp(`Skład \\(${roster.length}\\)`));
assert.match(section, /<ol class="team-roster"/);
assert.equal((section.match(/<li>/g) || []).length, roster.length);

const emptySection = api.renderRosterSection([]);
assert.match(emptySection, /Skład \(0\)/);
assert.match(emptySection, /Skład nie został jeszcze uzupełniony/);
assert.doesNotMatch(emptySection, /<ol/);

const longName = 'Aleksandra Bardzo Długie Wieloczłonowe Nazwisko';
const longNameHtml = api.renderRoster([longName]);
assert.match(longNameHtml, /<li><span>/);
assert.match(longNameHtml, /Aleksandra Bardzo Długie Wieloczłonowe Nazwisko/);

const ineligiblePlayer = api.leagueData.players.find(player => (
  player.club !== team.club || !player.sports.includes(team.sport)
));
assert.ok(ineligiblePlayer);
team.roster.push(ineligiblePlayer.name);
assert.equal(api.getTeamRosterNames(team).includes(ineligiblePlayer.name), false);
assert.doesNotMatch(api.getRosterSelectOptions(team.club, team.sport), new RegExp(ineligiblePlayer.name));
team.roster = team.roster.filter(name => name !== ineligiblePlayer.name);

const removedName = roster[0];
const countBefore = api.getTeamRosterNames(team).length;
api.removePlayerReferences(removedName);
const afterRemoval = api.getTeamRosterNames(team);
assert.equal(afterRemoval.length, countBefore - 1);
assert.equal(afterRemoval.includes(removedName), false);
const afterRemovalHtml = api.renderRosterSection(afterRemoval);
assert.match(afterRemovalHtml, new RegExp(`Skład \\(${countBefore - 1}\\)`));
assert.equal((afterRemovalHtml.match(/<li>/g) || []).length, countBefore - 1);

const scriptSource = fs.readFileSync('script.js', 'utf8');
assert.match(scriptSource, /id="club-team-roster-preview"/);
assert.match(scriptSource, /form\.roster\.addEventListener\('change', renderRosterPreview\)/);
assert.match(scriptSource, /renderRosterSection\(getTeamRosterNames\(entry\)\)/);
assert.match(scriptSource, /renderRosterSection\(getTeamRosterNames\(team\)/);

console.log('numbered rosters stage 8 tests passed');
