const defaultLeagueData = {
  admin: {
    password: 'LigaLgbt2026!'
  },
  teams: [
    { id: 1, name: 'Orion Poznań', city: 'Poznań', description: 'Dynamiczny klub z Poznania, który stawia na zaangażowanie, spokojną organizację i dobrą atmosferę.', logo: '' },
    { id: 2, name: 'Neon Wrocław', city: 'Wrocław', description: 'Barwny klub z Wrocławia, gotowy na sportowe wyzwania i nowe znajomości.', logo: '' },
    { id: 3, name: 'Volup Warszawa', city: 'Warszawa', description: 'Warszawski klub z ambicją, energią i regularnym podejściem do treningów.', logo: '' },
    { id: 4, name: 'Dragons Kraków', city: 'Kraków', description: 'Klub z Krakowa, który łączy sportową pasję, dyscyplinę i społeczność.', logo: '' },
    { id: 5, name: 'Unicorns Łódź', city: 'Łódź', description: 'Kreatywny klub z Łodzi z sercem do sportu i zespołowej gry.', logo: '' }
  ],
  clubTeams: [
    { id: 1, name: 'Orion Poznań B', club: 'Orion Poznań', sport: 'siatkowka', level: 'B' },
    { id: 2, name: 'Neon Wrocław B', club: 'Neon Wrocław', sport: 'siatkowka', level: 'B' },
    { id: 3, name: 'Dragons Kraków C', club: 'Dragons Kraków', sport: 'siatkowka', level: 'C' },
    { id: 4, name: 'Volup Warszawa C', club: 'Volup Warszawa', sport: 'siatkowka', level: 'C' }
  ],
  sports: {
    siatkowka: {
      name: 'Siatkówka',
      levels: ['B', 'B-', 'C', 'D'],
      headline: 'Poziomy B, B-, C i D',
      description: 'Rozgrywki siatkarskie są podzielone na cztery poziomy. Klub może wystawić kilka drużyn uczestniczących.',
      results: [
        { id: 1, home: 'Orion Poznań B', away: 'Neon Wrocław B', score: '3:1', level: 'B' },
        { id: 2, home: 'Dragons Kraków C', away: 'Volup Warszawa C', score: '2:3', level: 'C' }
      ],
      mvp: [
        { id: 1, player: 'Kacper Kowalski', team: 'Orion Poznań B', points: 28 },
        { id: 2, player: 'Anna Zielińska', team: 'Neon Wrocław B', points: 24 }
      ]
    },
    badminton: {
      name: 'Badminton',
      headline: 'Szybkie pojedynki singlowe i deblowe',
      description: 'W zawodach indywidualnych zawodnik reprezentuje bezpośrednio klub.',
      results: [],
      mvp: []
    },
    squash: {
      name: 'Squash',
      headline: 'Intensywna gra na małym korcie',
      description: 'W zawodach indywidualnych zawodnik reprezentuje bezpośrednio klub.',
      results: [],
      mvp: []
    },
    tenis: {
      name: 'Tenis',
      headline: 'Turnieje singlowe i deblowe',
      description: 'W zawodach indywidualnych zawodnik reprezentuje bezpośrednio klub.',
      results: [],
      mvp: []
    }
  }
};

function normalizeLoadedData(data) {
  if (!data) return structuredClone(defaultLeagueData);
  const serialized = JSON.stringify(data);
  const damagedMarkers = ['\uFFFD', '\u0107\u017C\u02DD', '\u0139', '\u0102', '\u00E2', '\u0111'];
  if (damagedMarkers.some(marker => serialized.includes(marker))) return structuredClone(defaultLeagueData);
  if (!data.admin) data.admin = defaultLeagueData.admin;
  if (!Array.isArray(data.teams)) data.teams = structuredClone(defaultLeagueData.teams);
  if (!Array.isArray(data.clubTeams)) data.clubTeams = structuredClone(defaultLeagueData.clubTeams);
  if (!data.sports) data.sports = structuredClone(defaultLeagueData.sports);
  Object.keys(defaultLeagueData.sports).forEach(key => {
    if (!data.sports[key]) data.sports[key] = structuredClone(defaultLeagueData.sports[key]);
    if (!Array.isArray(data.sports[key].results)) data.sports[key].results = [];
    if (!Array.isArray(data.sports[key].mvp)) data.sports[key].mvp = [];
  });
  return data;
}

function loadLeagueData() {
  const stored = localStorage.getItem('ligaLgbtData');
  if (!stored) {
    localStorage.setItem('ligaLgbtData', JSON.stringify(defaultLeagueData));
    return structuredClone(defaultLeagueData);
  }
  try {
    const parsed = JSON.parse(stored);
    const normalized = normalizeLoadedData(parsed);
    localStorage.setItem('ligaLgbtData', JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    console.warn('Błąd danych lokalnych, używam domyślnych.', error);
    localStorage.setItem('ligaLgbtData', JSON.stringify(defaultLeagueData));
    return structuredClone(defaultLeagueData);
  }
}

function saveLeagueData(data) {
  localStorage.setItem('ligaLgbtData', JSON.stringify(data));
}

const leagueData = loadLeagueData();
