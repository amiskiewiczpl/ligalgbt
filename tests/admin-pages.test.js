const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pages = [
  ['admin.html', 'admin', null],
  ['admin-kluby.html', 'admin-clubs', 'team-editor'],
  ['admin-druzyny.html', 'admin-teams', 'club-team-editor'],
  ['admin-zawodnicy.html', 'admin-players', 'players-editor'],
  ['admin-wyniki.html', 'admin-results', 'results-editor'],
  ['admin-turnieje.html', 'admin-tournaments', 'tournaments-editor'],
  ['admin-klasyfikacje.html', 'admin-standings', 'admin-standings-preview']
];
const editorIds = pages.map(([, , editorId]) => editorId).filter(Boolean);
const expectedLinks = pages.map(([file]) => file);
const expectedScripts = [
  'config.js',
  'competition-model.js',
  'data.js',
  'remote-data.js',
  'tournament-engine.js',
  'script.js'
];

for (const [file, page, expectedEditor] of pages) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(html, new RegExp(`<html[^>]+data-page="${page}"`), `${file}: niepoprawny data-page`);
  assert.match(html, /id="admin-content"/, `${file}: brak wspólnego kontenera panelu`);
  assert.match(html, /id="admin-navigation"/, `${file}: brak wspólnej nawigacji`);
  assert.match(html, /id="admin-nav-toggle"/, `${file}: brak przycisku menu mobilnego`);
  assert.match(html, /id="admin-logout"/, `${file}: brak wylogowania`);

  for (const link of expectedLinks) {
    assert.match(html, new RegExp(`href="${link.replace('.', '\\.')}"`), `${file}: brak linku ${link}`);
  }

  const presentEditors = editorIds.filter(editorId => html.includes(`id="${editorId}"`));
  if (expectedEditor) {
    assert.deepEqual(presentEditors, [expectedEditor], `${file}: podstrona musi mieć tylko edytor ${expectedEditor}`);
  } else {
    assert.deepEqual(presentEditors, [], `${file}: dashboard nie może zawierać edytorów`);
  }

  let previousIndex = -1;
  for (const script of expectedScripts) {
    const index = html.indexOf(`src="${script}"`);
    assert.ok(index > previousIndex, `${file}: niepoprawna kolejność skryptu ${script}`);
    previousIndex = index;
  }
}

const detailPage = fs.readFileSync(path.join(root, 'admin-turniej.html'), 'utf8');
assert.match(detailPage, /data-page="admin-tournament"/);
assert.match(detailPage, /id="admin-content"/);
assert.match(detailPage, /id="admin-tournament-editor"/);
assert.match(detailPage, /href="admin-turnieje\.html"/);
assert.match(detailPage, /id="admin-logout"/);

const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
assert.match(script, /page\?\.startsWith\('admin'\)/, 'initPage musi chronić wszystkie strony administracyjne');
assert.match(script, /function initAdminNavigation\(\)/, 'brak inicjalizacji wspólnej nawigacji');
assert.match(script, /link\.setAttribute\('aria-current', 'page'\)/, 'aktywna strona nie jest oznaczana');
assert.match(script, /navigation\.classList\.toggle\('is-open'\)/, 'mobilne menu nie ma obsługi otwierania');

console.log('admin pages stage 4 tests passed');
