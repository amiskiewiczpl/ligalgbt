const defaultLeagueData = {
  teams: [
    { id: 1, name: 'Orion Poznań', city: 'Poznań', description: 'Dynamiczna drużyna z Poznania, która stawia na zaangażowanie i dobrą atmosferę.', logo: '' },
    { id: 2, name: 'Neon Wrocław', city: 'Wrocław', description: 'Barwna ekipa z Wrocławia, gotowa na sportowe wyzwania.', logo: '' },
    { id: 3, name: 'Volup Warszawa', city: 'Warszawa', description: 'Warszawski team z ambicjami i energią, która napędza grę.', logo: '' },
    { id: 4, name: 'Dragons Kraków', city: 'Kraków', description: 'Dumni gracze z Krakowa, którzy łączą dyscypliny i społeczność.', logo: '' },
    { id: 5, name: 'Unicorns Łódź', city: 'Łódź', description: 'Kreatywna drużyna z Łodzi z sercem do sportu i zespołowej zabawy.', logo: '' }
  ],
  sports: {
    siatkowka: {
      name: 'Siatkówka',
      levels: ['B', 'B-', 'C', 'D'],
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
      results: [],
      mvp: []
    },
    squash: {
      name: 'Squash',
      results: [],
      mvp: []
    },
    tenis: {
      name: 'Tenis',
      results: [],
      mvp: []
    }
  }
};

function loadLeagueData() {
  const stored = localStorage.getItem('ligaLgbtData');
  if (!stored) {
    localStorage.setItem('ligaLgbtData', JSON.stringify(defaultLeagueData));
    return structuredClone(defaultLeagueData);
  }
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Błąd danych lokalnych, używam domyślnych', error);
    localStorage.setItem('ligaLgbtData', JSON.stringify(defaultLeagueData));
    return structuredClone(defaultLeagueData);
  }
}

function saveLeagueData(data) {
  localStorage.setItem('ligaLgbtData', JSON.stringify(data));
}

const leagueData = loadLeagueData();
