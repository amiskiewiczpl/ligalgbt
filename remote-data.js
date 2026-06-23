(function () {
  const config = window.LIGA_CONFIG || {};
  const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase?.createClient);
  const client = isConfigured
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;
  let loadState = isConfigured ? 'loading' : 'local';
  let saveQueue = Promise.resolve();

  async function loadRemoteData() {
    if (!client) return false;
    const { data, error } = await client
      .from('league_state')
      .select('data')
      .eq('id', 'main')
      .maybeSingle();

    if (error) {
      loadState = 'error';
      throw error;
    }
    if (!data?.data) {
      loadState = 'missing';
      return false;
    }

    replaceLeagueData(data.data);
    localStorage.setItem('ligaLgbtData', JSON.stringify(leagueData));
    loadState = 'loaded';
    return true;
  }

  function saveRemoteData(data) {
    localStorage.setItem('ligaLgbtData', JSON.stringify(data));
    if (!client) return Promise.resolve({ remote: false });

    const publicData = structuredClone(data);
    delete publicData.admin;
    saveQueue = saveQueue
      .catch(() => undefined)
      .then(async () => {
        const { error } = await client
          .from('league_state')
          .upsert({
            id: 'main',
            data: publicData,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
        loadState = 'loaded';
        return { remote: true };
      });
    return saveQueue;
  }

  async function getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function signIn(email, password) {
    if (!client) return null;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  window.leagueStore = {
    isConfigured,
    client,
    loadRemoteData,
    saveRemoteData,
    getSession,
    signIn,
    signOut,
    get loadState() {
      return loadState;
    }
  };

  window.leagueDataReady = loadRemoteData().catch(error => {
    console.error('Nie udało się pobrać wspólnych danych ligi.', error);
    return false;
  });
})();
