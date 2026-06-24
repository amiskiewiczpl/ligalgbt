const { spawnSync } = require('node:child_process');
const path = require('node:path');

const tests = [
  'data-model.test.js',
  'tournament-engine.test.js',
  'tournament-render.test.js',
  'admin-pages.test.js',
  'result-form.test.js',
  'tournament-result-clearing.test.js',
  'sorting.test.js',
  'player-directory.test.js',
  'roster.test.js',
  'remote-data.test.js',
  'final-regression.test.js'
];

for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join(__dirname, test)], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8'
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`all ${tests.length} regression test files passed`);
