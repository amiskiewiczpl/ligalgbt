const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const publicPages = htmlFiles.filter(file => !file.startsWith('admin-') && file !== 'admin.html' && file !== 'login.html');
const adminPages = htmlFiles.filter(file => file === 'admin.html' || file.startsWith('admin-'));

for (const file of htmlFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(source, /<meta charset="UTF-8"\s*\/?>/i, `${file}: brak UTF-8`);
  assert.doesNotMatch(source, /\uFFFD/, `${file}: znak zastępczy kodowania`);
  assert.doesNotMatch(source, /Ã.|Ä.|Ĺ./, `${file}: wykryto tekst wyglądający na mojibake`);
  assert.match(source, /<meta name="viewport"/i, `${file}: brak viewport`);
}

for (const file of publicPages) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(source, /src="data\.js"/, `${file}: brak danych`);
  assert.match(source, /src="remote-data\.js"/, `${file}: brak synchronizacji Supabase`);
  assert.match(source, /src="tournament-engine\.js"/, `${file}: brak silnika turniejowego`);
  assert.match(source, /src="script\.js"/, `${file}: brak aplikacji`);
}

for (const file of adminPages) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(source, /data-page="admin/, `${file}: brak administracyjnego data-page`);
  assert.match(source, /id="admin-logout"/, `${file}: brak wylogowania`);
}

const schema = fs.readFileSync(path.join(root, 'supabase', 'schema.sql'), 'utf8');
assert.match(schema, /enable row level security/i);
assert.match(schema, /grant select.+anon,\s*authenticated/is);
assert.match(schema, /grant insert,\s*update.+authenticated/is);
assert.match(schema, /for select[\s\S]+to anon,\s*authenticated/i);
assert.match(schema, /for insert[\s\S]+to authenticated/i);
assert.match(schema, /for update[\s\S]+to authenticated/i);
assert.doesNotMatch(schema, /grant\s+(insert|update|delete)[^;]+to\s+anon/i);

const configSource = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
const configContext = { window: {} };
vm.createContext(configContext);
vm.runInContext(configSource, configContext);
const config = configContext.window.LIGA_CONFIG;
assert.match(config.supabaseUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i);
assert.match(config.supabaseAnonKey, /^sb_publishable_/);
assert.doesNotMatch(config.supabaseAnonKey, /^sb_secret_/);

const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
assert.match(styles, /\.tournament-bracket-scroll[\s\S]+overflow-x:\s*auto/);
assert.match(styles, /@media \(max-width: 680px\)/);
assert.match(styles, /\.admin-header \.admin-nav\.is-open/);

const dataSource = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const scriptSource = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const storage = new Map();
const context = {
  console,
  structuredClone,
  URLSearchParams,
  encodeURIComponent,
  Intl,
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
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
vm.runInContext(dataSource, context);
vm.runInContext(
  scriptSource + ';globalThis.finalApi={leagueData,calculateStandings,calculateMvpRows,getTeamRosterNames};',
  context
);
const leagueData = context.finalApi.leagueData;
assert.deepEqual(JSON.parse(JSON.stringify(leagueData.sports.siatkowka.levels)), ['A', 'B', 'B-', 'C', 'D']);
assert.ok(leagueData.players.some(player => player.sports.length > 1));
assert.ok(leagueData.teams.every(team => Object.hasOwn(team, 'logo')));
assert.ok(context.finalApi.calculateStandings('siatkowka').length > 0);
assert.ok(context.finalApi.calculateMvpRows('siatkowka').length > 0);
assert.ok(leagueData.clubTeams.every(team => (
  context.finalApi.getTeamRosterNames(team).every(name => {
    const player = leagueData.players.find(item => item.name === name);
    return player && player.club === team.club && player.sports.includes(team.sport);
  })
)));

console.log('final static and functional regression tests passed');
