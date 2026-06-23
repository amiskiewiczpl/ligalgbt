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
    { id: 1, name: 'Orion Poznań B', club: 'Orion Poznań', sport: 'siatkowka', level: 'B', description: 'Skład ligowy na poziomie B, zgłoszony jako osobna drużyna klubu.', roster: ['Kacper Kowalski', 'Marta Sokołowska', 'Piotr Maj'] },
    { id: 2, name: 'Neon Wrocław B', club: 'Neon Wrocław', sport: 'siatkowka', level: 'B', description: 'Drużyna poziomu B z własnym terminarzem i wynikami.', roster: ['Anna Zielińska', 'Tomasz Brzeziński', 'Julia Wrona'] },
    { id: 3, name: 'Dragons Kraków C', club: 'Dragons Kraków', sport: 'siatkowka', level: 'C', description: 'Skład turniejowo-ligowy na poziomie C.', roster: ['Krzysztof Sobanowski', 'Michał Wojakowski'] },
    { id: 4, name: 'Volup Warszawa C', club: 'Volup Warszawa', sport: 'siatkowka', level: 'C', description: 'Drużyna siatkarska przypisana do poziomu C.', roster: ['Łukasz Nowak', 'Sebastian Górski'] }
  ],
  players: [
    { id: 1, name: 'Kacper Kowalski', club: 'Orion Poznań', sports: ['siatkowka'], bio: 'Rozgrywajacy Orionu, regularny w przyjeciu i spokojnym prowadzeniu zespolu.' },
    { id: 2, name: 'Anna Zielińska', club: 'Neon Wrocław', sports: ['siatkowka', 'badminton'], bio: 'Wszechstronna zawodniczka Neonu, laczy gre zespolowa z dobrym refleksem w badmintonie.' },
    { id: 3, name: 'Łukasz Nowak', club: 'Volup Warszawa', sports: ['squash'], bio: 'Dynamiczny zawodnik squashowy z mocnym tempem gry i szybkim doskokiem do pilki.' },
    { id: 4, name: 'Dariusz Karpuk', club: 'Unicorns Łódź', sports: ['tenis'], bio: 'Tenisista turniejowy, cierpliwy w wymianach i skuteczny przy dluzszych meczach.' },
    { id: 5, name: 'Marta Sokołowska', club: 'Orion Poznań', sports: ['siatkowka'], bio: 'Przyjmujaca Orionu, dobrze czyta ustawienie rywali i utrzymuje tempo w dlugich akcjach.' },
    { id: 6, name: 'Piotr Maj', club: 'Orion Poznań', sports: ['siatkowka'], bio: 'Srodkowy z dobrym blokiem i duza regularnoscia w krotkich pilkach.' },
    { id: 7, name: 'Tomasz Brzeziński', club: 'Neon Wrocław', sports: ['siatkowka'], bio: 'Zawodnik Neonu odpowiedzialny za stabilny serwis i komunikacje w obronie.' },
    { id: 8, name: 'Julia Wrona', club: 'Neon Wrocław', sports: ['siatkowka'], bio: 'Atakujaca z wysoka skutecznoscia w koncowkach setow.' },
    { id: 9, name: 'Krzysztof Sobanowski', club: 'Dragons Kraków', sports: ['siatkowka', 'tenis'], bio: 'Reprezentant Dragons, gra zarowno zespolowo, jak i w turniejach tenisowych.' },
    { id: 10, name: 'Michał Wojakowski', club: 'Dragons Kraków', sports: ['siatkowka', 'tenis'], bio: 'Uniwersalny zawodnik z dobra kontrola tempa i doswiadczeniem turniejowym.' },
    { id: 11, name: 'Sebastian Górski', club: 'Volup Warszawa', sports: ['siatkowka', 'tenis'], bio: 'Zawodnik Volup, aktywny w siatkowce i turniejach singlowych.' }
  ],
  sports: {
    siatkowka: {
      name: 'Siatkówka',
      type: 'team',
      defaultScoring: 'volleyball',
      levels: ['A', 'B', 'B-', 'C', 'D'],
      headline: 'Poziomy A, B, B-, C i D',
      description: 'Rozgrywki siatkarskie są podzielone na pięć poziomów. Klub może wystawić kilka drużyn uczestniczących.',
      results: [
        { id: 1, home: 'Orion Poznań B', away: 'Neon Wrocław B', sets: '25:20, 25:22, 25:19', score: '3:0', level: 'B', scoring: 'volleyball', mvp: 'Kacper Kowalski' },
        { id: 2, home: 'Dragons Kraków C', away: 'Volup Warszawa C', sets: '25:21, 21:25, 25:19, 22:25, 13:15', score: '2:3', level: 'C', scoring: 'volleyball', mvp: 'Łukasz Nowak' }
      ]
    },
    badminton: {
      name: 'Badminton',
      type: 'individual',
      defaultScoring: 'sets',
      headline: 'Szybkie pojedynki singlowe i deblowe',
      description: 'W zawodach indywidualnych zawodnik reprezentuje bezpośrednio klub.',
      results: []
    },
    squash: {
      name: 'Squash',
      type: 'individual',
      defaultScoring: 'sets',
      headline: 'Intensywna gra na małym korcie',
      description: 'W zawodach indywidualnych zawodnik reprezentuje bezpośrednio klub.',
      results: []
    },
    tenis: {
      name: 'Tenis',
      type: 'individual',
      defaultScoring: 'sets',
      headline: 'Turnieje singlowe i deblowe',
      description: 'W zawodach indywidualnych zawodnik reprezentuje bezpośrednio klub.',
      results: []
    }
  },
  tournaments: [
    {
      id: 1,
      name: 'Letni Puchar Tenisa',
      sport: 'tenis',
      scoring: 'sets',
      status: 'completed',
      bracket: [
        { round: 'Półfinał', home: 'Dariusz Karpuk', away: 'Sebastian Górski', score: '2:0' },
        { round: 'Półfinał', home: 'Krzysztof Sobanowski', away: 'Michał Wojakowski', score: '2:1' },
        { round: 'Finał', home: 'Dariusz Karpuk', away: 'Krzysztof Sobanowski', score: '2:1' }
      ],
      finalClassification: [
        { place: 1, participant: 'Dariusz Karpuk', club: 'Unicorns Łódź' },
        { place: 2, participant: 'Krzysztof Sobanowski', club: 'Dragons Kraków' },
        { place: 3, participant: 'Sebastian Górski', club: 'Volup Warszawa' }
      ]
    }
  ]
};

function normalizeLoadedData(data) {
  if (!data) return structuredClone(defaultLeagueData);
  const serialized = JSON.stringify(data);
  const damagedMarkers = ['\uFFFD', '\u0107\u017C\u02DD', '\u0139', '\u0102', '\u00E2', '\u0111'];
  if (damagedMarkers.some(marker => serialized.includes(marker))) return structuredClone(defaultLeagueData);
  if (!data.admin) data.admin = defaultLeagueData.admin;
  if (!Array.isArray(data.teams)) data.teams = structuredClone(defaultLeagueData.teams);
  if (!Array.isArray(data.clubTeams)) data.clubTeams = structuredClone(defaultLeagueData.clubTeams);
  if (!Array.isArray(data.players)) data.players = structuredClone(defaultLeagueData.players);
  if (!Array.isArray(data.tournaments)) data.tournaments = structuredClone(defaultLeagueData.tournaments);
  if (!data.sports) data.sports = structuredClone(defaultLeagueData.sports);
  Object.keys(defaultLeagueData.sports).forEach(key => {
    if (!data.sports[key]) data.sports[key] = structuredClone(defaultLeagueData.sports[key]);
    if (!Array.isArray(data.sports[key].results)) data.sports[key].results = [];
    if (!data.sports[key].type) data.sports[key].type = defaultLeagueData.sports[key].type;
    if (!data.sports[key].defaultScoring) data.sports[key].defaultScoring = defaultLeagueData.sports[key].defaultScoring;
    if (Array.isArray(defaultLeagueData.sports[key].levels)) {
      if (!Array.isArray(data.sports[key].levels)) {
        data.sports[key].levels = structuredClone(defaultLeagueData.sports[key].levels);
      } else {
        const savedLevels = data.sports[key].levels;
        data.sports[key].levels = defaultLeagueData.sports[key].levels.filter(level => savedLevels.includes(level) || level === 'A');
        savedLevels.forEach(level => {
          if (!data.sports[key].levels.includes(level)) data.sports[key].levels.push(level);
        });
      }
    }
    data.sports[key].results.forEach(match => {
      if (!match.scoring) match.scoring = data.sports[key].defaultScoring;
      if (!match.sets && match.score) match.sets = '';
      if (typeof match.mvp !== 'string') match.mvp = '';
    });
    delete data.sports[key].mvp;
  });
  data.clubTeams.forEach(team => {
    if (typeof team.description !== 'string') team.description = '';
    if (!Array.isArray(team.roster)) {
      team.roster = defaultLeagueData.clubTeams.find(defaultTeam => defaultTeam.name === team.name || defaultTeam.id === team.id)?.roster || [];
    }
  });
  data.players.forEach(player => {
    if (typeof player.bio !== 'string') player.bio = '';
  });
  data.tournaments.forEach(tournament => {
    if (!Array.isArray(tournament.bracket)) tournament.bracket = [];
    if (!Array.isArray(tournament.finalClassification)) tournament.finalClassification = [];
    if (!tournament.scoring) tournament.scoring = 'sets';
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
