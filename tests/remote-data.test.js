const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const competitionModelSource = fs.readFileSync('competition-model.js', 'utf8');
const dataSource = fs.readFileSync('data.js', 'utf8');
const remoteSource = fs.readFileSync('remote-data.js', 'utf8');

function createLegacyRemoteState() {
  const storage = new Map();
  const context = {
    console,
    structuredClone,
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    window: { leagueStore: null }
  };
  vm.createContext(context);
  vm.runInContext(competitionModelSource, context);
  vm.runInContext(dataSource, context);
  const legacy = vm.runInContext('structuredClone(defaultLeagueData)', context);
  delete legacy.schemaVersion;
  legacy.sports.siatkowka.results.forEach(match => {
    delete match.phaseType;
    delete match.status;
    delete match.pointsRules;
  });
  legacy.tournaments.forEach(tournament => {
    delete tournament.format;
    delete tournament.participantIds;
    delete tournament.groupConfig;
    delete tournament.finalStageConfig;
    delete tournament.groups;
  });
  return legacy;
}

function createBackend(initialData = null) {
  return {
    record: initialData ? {
      id: 'main',
      data: structuredClone(initialData),
      updated_at: '2026-01-01T00:00:00.000Z'
    } : null
  };
}

function createSupabaseClient(backend, session) {
  return {
    from(table) {
      assert.equal(table, 'league_state');
      return {
        select(columns) {
          assert.equal(columns, 'data');
          return {
            eq(column, value) {
              assert.equal(column, 'id');
              assert.equal(value, 'main');
              return {
                async maybeSingle() {
                  return {
                    data: backend.record ? { data: structuredClone(backend.record.data) } : null,
                    error: null
                  };
                }
              };
            }
          };
        },
        async upsert(payload) {
          if (!session) {
            return { error: new Error('RLS: authenticated role required') };
          }
          if (payload.id !== 'main') {
            return { error: new Error('RLS: only main record is allowed') };
          }
          backend.record = structuredClone(payload);
          return { error: null };
        }
      };
    },
    auth: {
      async getSession() {
        return { data: { session }, error: null };
      },
      async signInWithPassword({ email, password }) {
        if (!email || !password) return { data: {}, error: new Error('Missing credentials') };
        return { data: { session }, error: null };
      },
      async signOut() {
        return { error: null };
      }
    }
  };
}

async function createBrowserSession(backend, session) {
  const storage = new Map();
  const client = createSupabaseClient(backend, session);
  const context = {
    console,
    structuredClone,
    Date,
    Promise,
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    window: {
      LIGA_CONFIG: {
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'sb_publishable_test'
      },
      supabase: {
        createClient() {
          return client;
        }
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(competitionModelSource, context);
  vm.runInContext(dataSource, context);
  vm.runInContext(remoteSource, context);
  await context.window.leagueDataReady;
  return {
    context,
    storage,
    store: context.window.leagueStore,
    getData() {
      return vm.runInContext('leagueData', context);
    }
  };
}

async function run() {
  const legacy = createLegacyRemoteState();
  const backend = createBackend(legacy);
  const adminSession = { user: { id: 'admin-1', email: 'admin@example.test' } };

  const firstSession = await createBrowserSession(backend, adminSession);
  assert.equal(firstSession.store.isConfigured, true);
  assert.equal(firstSession.store.loadState, 'loaded');
  assert.equal(firstSession.getData().schemaVersion, 3);
  assert.ok(firstSession.getData().tournaments[0].format);
  assert.ok(firstSession.getData().tournaments[0].participantIds.length > 0);
  assert.equal((await firstSession.store.getSession()).user.id, 'admin-1');
  assert.equal(
    (await firstSession.store.signIn('admin@example.test', 'test-password')).user.id,
    'admin-1'
  );

  const firstData = firstSession.getData();
  firstData.teams.push({
    id: 999,
    name: 'Klub synchronizacji Łódź',
    city: 'Łódź',
    description: 'Rekord testujący wspólny zapis.',
    logo: ''
  });
  firstData.admin = { password: 'must-not-leave-browser' };
  const saveResult = await firstSession.store.saveRemoteData(firstData);
  assert.equal(saveResult.remote, true);
  assert.equal(backend.record.data.admin, undefined);
  assert.ok(backend.record.data.teams.some(team => team.id === 999));

  const secondSession = await createBrowserSession(backend, adminSession);
  assert.equal(secondSession.store.loadState, 'loaded');
  assert.ok(secondSession.getData().teams.some(team => team.id === 999));
  assert.equal(secondSession.getData().schemaVersion, 3);

  const publicSession = await createBrowserSession(backend, null);
  assert.equal(await publicSession.store.getSession(), null);
  await assert.rejects(
    () => publicSession.store.saveRemoteData(publicSession.getData()),
    /authenticated role required/
  );

  const emptyBackend = createBackend();
  const emptySession = await createBrowserSession(emptyBackend, adminSession);
  assert.equal(emptySession.store.loadState, 'missing');

  await firstSession.store.signOut();
  console.log('remote data and two-session synchronization tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
