const defaultLeagueData = {
  admin: {
    password: 'LigaLgbt2026!'
  },
  teams: [
    { id: 1, name: 'Orion Poznań', city: 'Poznań', description: 'Dynamiczna drużyna z Poznania, która stawia na zaangażowanie, spokojną organizację i dobrą atmosferę.', logo: '' },
    { id: 2, name: 'Neon Wrocław', city: 'Wrocław', description: 'Barwna ekipa z Wrocławia, gotowa na sportowe wyzwania i nowe znajomości.', logo: '' },
    { id: 3, name: 'Volup Warszawa', city: 'Warszawa', description: 'Warszawski team z ambicją, energią i regularnym podejściem do treningów.', logo: '' },
    { id: 4, name: 'Dragons Kraków', city: 'Kraków', description: 'Drużyna z Krakowa, która łączy sportową pasję, dyscyplinę i społeczność.', logo: '' },
    { id: 5, name: 'Unicorns Łódź', city: 'Łódź', description: 'Kreatywna drużyna z Łodzi z sercem do sportu i zespołowej gry.', logo: '' }
  ],
  sports: {
    siatkowka: {
      name: 'Siatkówka',
      levels: ['B', 'B-', 'C', 'D'],
      headline: 'Poziomy B, B-, C i D',
      description: 'Rozgrywki siatkarskie są podzielone na cztery poziomy, dzięki czemu każda drużyna rywalizuje w możliwie równych warunkach.',
      results: [
        { id: 1, home: 'Orion Poznań', away: 'Neon Wrocław', score: '3:1', level: 'B' },
        { id: 2, home: 'Dragons Kraków', away: 'Volup Warszawa', score: '2:3', level: 'C' }
      ],
      mvp: [
        { id: 1, player: 'Kacper Kowalski', team: 'Orion Poznań', points: 28 },
        { id: 2, player: 'Anna Zielińska', team: 'Neon Wrocław', points: 24 }
      ]
    },
    badminton: {
      name: 'Badminton',
      headline: 'Szybkie pojedynki singlowe i deblowe',
      description: 'Badminton to dynamiczna rywalizacja, w której liczy się refleks, celność i dobre przygotowanie.',
      results: [],
      mvp: []
    },
    squash: {
      name: 'Squash',
      headline: 'Intensywna gra na małym korcie',
      description: 'Squash buduje kondycję i precyzję, a mecze opierają się na krótkich, szybkich wymianach.',
      results: [],
      mvp: []
    },
    tenis: {
      name: 'Tenis',
      headline: 'Turnieje singlowe i deblowe',
      description: 'Tenis w naszej lidze to precyzja, taktyka i sportowa rywalizacja w dobrym stylu.',
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
  if (!data.sports) data.sports = structuredClone(defaultLeagueData.sports);
  const keys = Object.keys(defaultLeagueData.sports);
  keys.forEach(key => {
    if (!data.sports[key]) data.sports[key] = structuredClone(defaultLeagueData.sports[key]);
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
