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
      search: '',
      pathname: '/kalendarz.html'
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
    + `;globalThis.calendarStage7Api={
      leagueData,
      getCalendarEvents,
      groupCalendarEvents,
      getCalendarFilters,
      getCalendarEventHref,
      renderCalendarEvent,
      renderCalendarFilters,
      getUndatedMatches,
      renderUndatedMatchesAdmin
    };`,
  context
);

const api = context.calendarStage7Api;
api.leagueData.competitions = [
  {
    id: 'league:volleyball:2026:b',
    name: 'Liga siatkówki 2026 · B',
    kind: 'league',
    sport: 'siatkowka',
    season: '2026',
    status: 'published',
    stages: [{ id: 'league-stage-b', name: 'Poziom B', type: 'league', order: 1, level: 'B' }]
  },
  {
    id: 'tournament:summer',
    name: 'Puchar Lata',
    kind: 'tournament',
    sport: 'tenis',
    season: '2026',
    status: 'published',
    stages: [{ id: 'tournament-stage-final', name: 'Finał', type: 'knockout', order: 1, level: '' }]
  },
  {
    id: 'tournament:draft',
    name: 'Ukryty szkic',
    kind: 'tournament',
    sport: 'tenis',
    season: '2026',
    status: 'draft',
    stages: [{ id: 'draft-stage', name: 'Etap', type: 'groups', order: 1, level: '' }]
  }
];
api.leagueData.matches = [
  {
    id: 'match-league-completed',
    competitionId: 'league:volleyball:2026:b',
    stageId: 'league-stage-b',
    scheduledAt: '2026-07-03T18:00:00+02:00',
    status: 'completed',
    home: 'Orion Poznań B',
    away: 'Neon Wrocław B',
    score: '3:1',
    sets: '25:20, 21:25, 25:18, 25:19',
    roundLabel: 'Kolejka 1',
    venue: 'Hala Centrum'
  },
  {
    id: 'match-tournament',
    competitionId: 'tournament:summer',
    stageId: 'tournament-stage-final',
    scheduledAt: '2026-07-03T20:00:00+02:00',
    status: 'scheduled',
    home: 'Dariusz Karpuk',
    away: 'Krzysztof Sobanowski',
    roundLabel: 'Finał',
    venue: 'Kort centralny'
  },
  {
    id: 'match-next-month',
    competitionId: 'league:volleyball:2026:b',
    stageId: 'league-stage-b',
    scheduledAt: '2026-08-01T12:00:00+02:00',
    status: 'scheduled',
    home: 'Neon Wrocław B',
    away: 'Orion Poznań B',
    roundLabel: 'Kolejka 2',
    venue: ''
  },
  {
    id: 'match-undated',
    competitionId: 'tournament:summer',
    stageId: 'tournament-stage-final',
    scheduledAt: null,
    status: 'scheduled',
    home: 'Dariusz Karpuk',
    away: 'Sebastian Górski',
    roundLabel: 'Półfinał'
  },
  {
    id: 'match-draft',
    competitionId: 'tournament:draft',
    stageId: 'draft-stage',
    scheduledAt: '2026-07-04T10:00:00+02:00',
    status: 'scheduled',
    home: 'A',
    away: 'B'
  },
  {
    id: 'match-tournament',
    competitionId: 'tournament:summer',
    stageId: 'tournament-stage-final',
    scheduledAt: '2026-07-03T20:00:00+02:00',
    status: 'scheduled',
    home: 'Dariusz Karpuk',
    away: 'Krzysztof Sobanowski'
  }
];

const events = api.getCalendarEvents();
assert.deepEqual(Array.from(events, event => event.id), [
  'match-league-completed',
  'match-tournament',
  'match-next-month'
]);
assert.equal(new Set(events.map(event => event.id)).size, events.length);
assert.equal(events.some(event => event.id === 'match-undated'), false);
assert.equal(events.some(event => event.id === 'match-draft'), false);

const grouped = api.groupCalendarEvents(events);
assert.equal(grouped.length, 2);
assert.equal(grouped[0].days.length, 1);
assert.equal(grouped[0].days[0].events.length, 2);
assert.equal(grouped[1].days[0].events.length, 1);

assert.equal(api.getCalendarEvents({ kind: 'league' }).length, 2);
assert.equal(api.getCalendarEvents({ kind: 'tournament' }).length, 1);
assert.equal(api.getCalendarEvents({ sport: 'siatkowka', level: 'B' }).length, 2);
assert.equal(api.getCalendarEvents({ status: 'completed' }).length, 1);
assert.equal(api.getCalendarEvents({ from: '2026-08-01', to: '2026-08-31' }).length, 1);

const leagueEvent = events.find(event => event.kind === 'league');
const tournamentEvent = events.find(event => event.kind === 'tournament');
assert.match(leagueEvent.href, /klasyfikacje\.html\?/);
assert.match(leagueEvent.href, /level=B/);
assert.match(leagueEvent.href, /#poziom-B$/);
assert.equal(tournamentEvent.href, 'turniej.html?id=tournament%3Asummer');

const leagueHtml = api.renderCalendarEvent(leagueEvent);
assert.match(leagueHtml, /Orion Poznań B/);
assert.match(leagueHtml, /Neon Wrocław B/);
assert.match(leagueHtml, /Hala Centrum/);
assert.match(leagueHtml, />3:1</);
assert.match(leagueHtml, />Tabela</);

const tournamentHtml = api.renderCalendarEvent(tournamentEvent);
assert.match(tournamentHtml, /Puchar Lata/);
assert.match(tournamentHtml, /Kort centralny/);
assert.match(tournamentHtml, />Turniej</);

context.window.location.search = '?sport=siatkowka&rozgrywki=league&level=B&status=completed&od=2026-07-01&do=2026-07-31';
const filters = api.getCalendarFilters();
assert.equal(filters.sport, 'siatkowka');
assert.equal(filters.kind, 'league');
assert.equal(filters.level, 'B');
assert.equal(filters.status, 'completed');
assert.equal(filters.from, '2026-07-01');
assert.equal(filters.to, '2026-07-31');
assert.match(api.renderCalendarFilters(filters), /name="from"/);
assert.match(api.renderCalendarFilters(filters), /name="to"/);

const undated = api.getUndatedMatches();
assert.equal(undated.length, 1);
assert.equal(undated[0].match.id, 'match-undated');
assert.match(api.renderUndatedMatchesAdmin(), /Mecze bez daty/);
assert.match(api.renderUndatedMatchesAdmin(), /admin-turniej\.html\?id=tournament%3Asummer/);

const calendarHtml = fs.readFileSync('kalendarz.html', 'utf8');
assert.match(calendarHtml, /data-page="calendar"/);
assert.match(calendarHtml, /id="calendar-view"/);
assert.match(calendarHtml, /href="kalendarz\.html" aria-current="page"/);

const scriptSource = fs.readFileSync('script.js', 'utf8');
assert.match(scriptSource, /if \(page === 'calendar'\) return renderCalendarPage\(\)/);
assert.match(scriptSource, /insertAdjacentHTML\('afterend', renderUndatedMatchesAdmin\(\)\)/);

console.log('calendar stage 7 tests passed');
