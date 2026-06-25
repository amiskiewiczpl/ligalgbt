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
    location: {
      search: '?sport=siatkowka&season=2026&rozgrywki=league&level=B',
      pathname: '/klasyfikacje.html'
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
    + `;globalThis.publicPagesApi={
      leagueData,
      getPublicResultsFilters,
      getPublicTournaments,
      getPublicCompetitionSeasons,
      renderPublicFilterBar,
      renderTournamentSummary,
      renderTournamentFull,
      renderTournamentCardList,
      renderLevelStandingsSections
    };`,
  context
);

const api = context.publicPagesApi;
const filters = api.getPublicResultsFilters();
assert.equal(filters.sport, 'siatkowka');
assert.equal(filters.season, '2026');
assert.equal(filters.kind, 'league');
assert.equal(filters.level, 'B');

const filterHtml = api.renderPublicFilterBar(filters);
assert.match(filterHtml, /name="sport"/);
assert.match(filterHtml, /name="season"/);
assert.match(filterHtml, /name="kind"/);
assert.match(filterHtml, /name="level"/);
assert.match(filterHtml, /value="B" selected/);

const publicTournament = api.leagueData.tournaments[0];
api.leagueData.competitions.push({
  ...structuredClone(publicTournament),
  id: 'draft-public-test',
  name: 'Ukryty szkic',
  status: 'draft'
});
assert.equal(api.getPublicTournaments().some(item => item.status === 'draft'), false);
assert.ok(api.getPublicTournaments({ sport: publicTournament.sport }).length > 0);

const card = api.renderTournamentSummary(publicTournament);
assert.match(card, /turniej\.html\?id=/);
assert.match(card, /Otwórz turniej/);
assert.doesNotMatch(card, /tournament-bracket-scroll/);
assert.doesNotMatch(card, /tournament-group-table/);

const full = api.renderTournamentFull(publicTournament);
assert.match(full, /tournament-overview-grid/);
assert.match(full, /tournament-stage-roadmap/);
assert.match(full, /tournament-participant-list/);
assert.match(full, /Klasyfikacja końcowa/);

const volleyballTables = api.renderLevelStandingsSections('siatkowka', {
  season: '2026',
  level: 'B'
});
assert.match(volleyballTables, /data-standings-level="B"/);
assert.doesNotMatch(volleyballTables, /data-standings-level="C"/);

const rankingsHtml = fs.readFileSync('klasyfikacje.html', 'utf8');
assert.match(rankingsHtml, /data-page="rankings"/);
assert.match(rankingsHtml, /<main class="container"><\/main>/);
assert.doesNotMatch(rankingsHtml, /Dragons Kraków B|Anna Wójcik|Ranking ogólny klubów/);

const tournamentsHtml = fs.readFileSync('turnieje.html', 'utf8');
assert.match(tournamentsHtml, /data-page="tournaments"/);
assert.match(tournamentsHtml, /id="public-tournaments"/);

const tournamentHtml = fs.readFileSync('turniej.html', 'utf8');
assert.match(tournamentHtml, /data-page="tournament"/);
assert.match(tournamentHtml, /href="turnieje\.html"/);

const scriptSource = fs.readFileSync('script.js', 'utf8');
assert.match(scriptSource, /if \(page === 'tournaments'\) return renderPublicTournamentsPage\(\)/);
assert.match(scriptSource, /renderSportTournaments[\s\S]*renderTournamentCardList\(tournaments\)/);
assert.doesNotMatch(
  scriptSource,
  /renderSportTournaments[\s\S]{0,500}tournaments\.map\(renderTournamentFull\)/,
  'Strona dyscypliny nie może renderować pełnych drabinek wszystkich turniejów'
);

console.log('public competition architecture stage 6 tests passed');
