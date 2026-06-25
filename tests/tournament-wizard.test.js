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
  Date,
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
    + `;globalThis.wizardApi={
      createTournamentWizardDraft,
      ensureTournamentWizardStages,
      validateTournamentWizardStep,
      getTournamentWizardParticipants,
      buildCompetitionFromTournamentDraft,
      generateTournamentWizardPreview,
      renderTournamentWizardPreview,
      tournamentStructureSignature,
      leagueData
    };`,
  context
);

const api = context.wizardApi;
const draft = api.createTournamentWizardDraft();

assert.equal(api.validateTournamentWizardStep(draft, 0).valid, false);

draft.name = 'Puchar Wieloetapowy';
draft.sport = 'tenis';
draft.status = 'published';
draft.startDate = '2026-08-01';
draft.endDate = '2026-08-10';
draft.scheduleStart = '2026-08-01T10:00';
draft.matchesPerDay = 3;
draft.intervalDays = 1;
draft.venue = 'Kort Centralny';
draft.participantIds = api.getTournamentWizardParticipants('tenis')
  .slice(0, 4)
  .map(participant => participant.reference);

api.ensureTournamentWizardStages(draft, 3);
draft.stages[0].name = 'Grupy';
draft.stages[0].type = 'groups';
draft.stages[0].seeding = 'random';
draft.stages[0].groupConfig.groupCount = 2;
draft.stages[0].groupConfig.matchesPerPair = 1;

draft.stages[1].name = 'Grupa finałowa';
draft.stages[1].type = 'round_robin';
draft.stages[1].seeding = 'group_result';
draft.stages[1].qualificationRule = {
  type: 'group_winners',
  count: 1,
  pairingRule: 'group_result',
  positions: [],
  participantIds: []
};

draft.stages[2].name = 'Faza medalowa';
draft.stages[2].type = 'knockout';
draft.stages[2].thirdPlaceMatch = true;
draft.stages[2].seeding = 'group_result';
draft.stages[2].qualificationRule = {
  type: 'stage_positions',
  count: 4,
  pairingRule: 'high_low',
  positions: [1, 2],
  participantIds: []
};

for (let step = 0; step <= 4; step += 1) {
  assert.equal(api.validateTournamentWizardStep(draft, step).valid, true, `step ${step}`);
}

const competition = api.buildCompetitionFromTournamentDraft(draft);
assert.equal(competition.kind, 'tournament');
assert.equal(competition.stages.length, 3);
assert.equal(competition.stages[0].seeding, 'random');
assert.equal(competition.stages[1].qualificationRule.type, 'group_winners');
assert.equal(competition.stages[2].thirdPlaceMatch, true);
assert.equal(competition.finalClassification.length, 0);

const preview = api.generateTournamentWizardPreview(draft);
assert.equal(preview.competition.stages.length, 3);
assert.equal(preview.competition.stages[0].groups.length, 2);
assert.equal(preview.matches.length, 2);
assert.ok(preview.matches.every(match => match.scheduledAt));
assert.ok(preview.matches.every(match => match.venue === 'Kort Centralny'));
assert.ok(preview.matches.every(match => match.status === 'scheduled'));

const previewHtml = api.renderTournamentWizardPreview(draft);
assert.match(previewHtml, /wizard-stage-flow/);
assert.match(previewHtml, /Grupa finałowa/);
assert.match(previewHtml, /Faza medalowa/);
assert.match(previewHtml, /wizard-bracket-preview/);
assert.match(previewHtml, /Seed 1/);

const sameSignature = api.tournamentStructureSignature(competition);
const changed = structuredClone(competition);
changed.participantIds = changed.participantIds.slice(0, 3);
assert.notEqual(api.tournamentStructureSignature(changed), sameSignature);

const source = fs.readFileSync('script.js', 'utf8');
assert.doesNotMatch(source, /name="finalClassification"/);
assert.doesNotMatch(source, /name="bracket"/);
assert.match(source, /TOURNAMENT_WIZARD_STEPS/);
assert.match(source, /generateCompetitionStructure/);
assert.match(source, /Nie można zmienić struktury turnieju z rozegranymi meczami/);

const detailPage = fs.readFileSync('admin-turniej.html', 'utf8');
assert.match(detailPage, /data-page="admin-tournament"/);
assert.match(detailPage, /id="admin-tournament-editor"/);
assert.match(detailPage, /href="admin-turnieje\.html"/);

console.log('tournament wizard stage 3 tests passed');
