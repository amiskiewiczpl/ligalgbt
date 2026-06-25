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
vm.runInContext(fs.readFileSync('competition-model.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('tournament-engine.js', 'utf8'), context);
vm.runInContext(
  fs.readFileSync('script.js', 'utf8')
    + ';globalThis.renderApi={renderTournamentFull,renderTournamentSummary,renderTournamentGroups,renderTournamentBracket,leagueData};',
  context
);

const { renderApi } = context;
const tournament = structuredClone(renderApi.leagueData.tournaments[0]);
const participantIds = tournament.participantIds;
const participantNames = Object.fromEntries(
  participantIds.map(reference => [
    reference,
    renderApi.leagueData.players.find(player => `player:${player.id}` === reference).name
  ])
);

tournament.id = 77;
tournament.name = 'Test groups and bracket';
tournament.format = 'groups_knockout';
tournament.status = 'ongoing';
tournament.allowDraws = true;
tournament.groupConfig = {
  groupCount: 1,
  participantsPerGroup: 4,
  matchesPerPair: 1,
  qualifiersPerGroup: 2,
  tieBreakOrder: ['points', 'wins', 'setsWon', 'setDifference', 'pointsFor', 'pointDifference', 'headToHead']
};
tournament.finalStageConfig = {
  type: 'knockout',
  participantCount: 2,
  pairingRule: 'high_low',
  thirdPlaceMatch: false,
  carryGroupResults: false
};
context.tournamentEngine.generateTournamentStructure(tournament, {
  names: participantNames,
  manualGroups: [participantIds]
});

const groupResults = [
  { score: '2:0', sets: '21:15, 21:17' },
  { score: '1:1', sets: '21:18, 17:21' },
  { score: '2:1', sets: '21:18, 18:21, 21:19' }
];
tournament.groups[0].matches.forEach((match, index) => {
  context.tournamentEngine.recordGroupResult(
    tournament.groups[0],
    match.id,
    groupResults[index % groupResults.length]
  );
});
const finalStage = context.tournamentEngine.createFinalStageFromGroups(tournament, {
  names: participantNames
});
tournament.bracket = finalStage.bracket;

const html = renderApi.renderTournamentFull(tournament);
assert.match(html, /tournament-flow/);
assert.match(html, /tournament-group-table/);
assert.match(html, /tournament-match-list/);
assert.match(html, /tournament-bracket-scroll/);
assert.match(html, /bracket-game/);
assert.match(html, /is-qualified/);
assert.match(html, /Remis 1:1 dozwolony/);
assert.doesNotMatch(html, /undefined|null/);

const summary = renderApi.renderTournamentSummary(tournament);
assert.match(summary, /turniej\.html\?id=77/);
assert.match(summary, /W trakcie/);
assert.match(summary, /rozegranych meczów/);

const legacyBracket = renderApi.renderTournamentBracket(renderApi.leagueData.tournaments[0]);
assert.match(legacyBracket, /Półfinał/);
assert.match(legacyBracket, /Finał/);
assert.match(legacyBracket, /is-winner/);

console.log('tournament render stage 3 tests passed');
