const fs = require('node:fs');
const vm = require('node:vm');

async function run() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('config.js', 'utf8'), context);
  const { supabaseUrl, supabaseAnonKey } = context.window.LIGA_CONFIG || {};
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase nie jest skonfigurowany.');

  const response = await fetch(
    `${supabaseUrl}/rest/v1/league_state?id=eq.main&select=id,updated_at,data`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    }
  );
  const body = await response.json().catch(() => null);
  const row = Array.isArray(body) ? body[0] : null;
  const result = {
    status: response.status,
    readable: response.ok,
    recordPresent: Boolean(row),
    schemaVersion: row?.data?.schemaVersion ?? null,
    updatedAt: row?.updated_at ?? null
  };
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok || !row || Number(row.data?.schemaVersion) < 2) process.exitCode = 1;
}

run().catch(error => {
  console.error(`Supabase read failed: ${error.message}`);
  process.exitCode = 1;
});
