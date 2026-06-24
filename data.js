const CURRENT_SCHEMA_VERSION = 2;

const DEFAULT_TOURNAMENT_POINTS_RULES = {
  win: 3,
  draw: 1,
  loss: 0
};

const DEFAULT_GROUP_CONFIG = {
  groupCount: 0,
  participantsPerGroup: 0,
  matchesPerPair: 1,
  qualifiersPerGroup: 1,
  tieBreakOrder: ['points', 'wins', 'setsWon', 'setDifference', 'pointsFor', 'pointDifference', 'headToHead']
};

const DEFAULT_FINAL_STAGE_CONFIG = {
  type: 'knockout',
  participantCount: 0,
  pairingRule: 'manual',
  thirdPlaceMatch: false,
  carryGroupResults: false
};

const defaultLeagueData = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  admin: {
    password: ''
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
    { id: 3, name: 'Łukasz Nowak', club: 'Volup Warszawa', sports: ['siatkowka', 'squash'], bio: 'Dynamiczny zawodnik squashowy z mocnym tempem gry i szybkim doskokiem do pilki.' },
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
      format: 'knockout',
      participantType: 'player',
      scoring: 'sets',
      seeding: 'manual',
      status: 'completed',
      allowDraws: false,
      pointsRules: { ...DEFAULT_TOURNAMENT_POINTS_RULES },
      groupConfig: { ...DEFAULT_GROUP_CONFIG },
      finalStageConfig: { ...DEFAULT_FINAL_STAGE_CONFIG, participantCount: 4 },
      groups: [],
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

function getParticipantTypeForSport(data, sportKey) {
  return data.sports?.[sportKey]?.type === 'team' ? 'team' : 'player';
}

function getParticipantReference(data, sportKey, name) {
  const type = getParticipantTypeForSport(data, sportKey);
  const source = type === 'team' ? data.clubTeams : data.players;
  const participant = source.find(item => item.name === name);
  return participant ? `${type}:${participant.id}` : '';
}

function getParticipantNameFromReference(data, reference) {
  const [type, rawId] = String(reference || '').split(':');
  const id = Number(rawId);
  if (!Number.isFinite(id)) return '';
  const source = type === 'team' ? data.clubTeams : type === 'player' ? data.players : [];
  return source.find(item => item.id === id)?.name || '';
}

function getEligibleParticipantNames(data, sportKey) {
  const type = getParticipantTypeForSport(data, sportKey);
  return type === 'team'
    ? data.clubTeams.filter(team => team.sport === sportKey).map(team => team.name)
    : data.players.filter(player => player.sports.includes(sportKey)).map(player => player.name);
}

function normalizePointsRules(pointsRules) {
  const source = pointsRules && typeof pointsRules === 'object' ? pointsRules : {};
  return {
    win: Number.isFinite(Number(source.win)) ? Number(source.win) : DEFAULT_TOURNAMENT_POINTS_RULES.win,
    draw: Number.isFinite(Number(source.draw)) ? Number(source.draw) : DEFAULT_TOURNAMENT_POINTS_RULES.draw,
    loss: Number.isFinite(Number(source.loss)) ? Number(source.loss) : DEFAULT_TOURNAMENT_POINTS_RULES.loss
  };
}

function normalizeMatchRecord(match, defaults = {}) {
  const normalized = match && typeof match === 'object' ? match : {};
  if (!normalized.id && defaults.id) normalized.id = defaults.id;
  if (!normalized.scoring) normalized.scoring = defaults.scoring || 'sets';
  if (typeof normalized.sets !== 'string') normalized.sets = '';
  if (typeof normalized.score !== 'string') normalized.score = '';
  if (typeof normalized.mvp !== 'string') normalized.mvp = '';
  if (!normalized.status) {
    normalized.status = (normalized.score && normalized.score !== '0:0') || normalized.sets
      ? 'completed'
      : 'scheduled';
  }
  if (!normalized.phaseType) normalized.phaseType = defaults.phaseType || 'league';
  if (typeof normalized.allowDraw !== 'boolean') normalized.allowDraw = Boolean(defaults.allowDraw);
  normalized.pointsRules = normalizePointsRules(normalized.pointsRules || defaults.pointsRules);
  return normalized;
}

function normalizeTournamentMatch(match, tournament, data, index, roundIndex, matchIndex) {
  const normalized = normalizeMatchRecord(match, {
    scoring: tournament.scoring,
    phaseType: 'knockout',
    allowDraw: false,
    pointsRules: tournament.pointsRules
  });
  if (!normalized.id) normalized.id = `legacy-bracket-${tournament.id}-${index + 1}`;
  if (!Number.isInteger(normalized.roundIndex)) normalized.roundIndex = roundIndex;
  if (!Number.isInteger(normalized.matchIndex)) normalized.matchIndex = matchIndex;
  if (typeof normalized.winner !== 'string') normalized.winner = '';
  if (!normalized.home && normalized.homeId) normalized.home = getParticipantNameFromReference(data, normalized.homeId);
  if (!normalized.away && normalized.awayId) normalized.away = getParticipantNameFromReference(data, normalized.awayId);
  if (!normalized.winner && normalized.winnerId) normalized.winner = getParticipantNameFromReference(data, normalized.winnerId);
  if (!normalized.winner && normalized.home && normalized.away && normalized.score) {
    const [homeScore, awayScore] = normalized.score.split(':').map(Number);
    if (Number.isFinite(homeScore) && Number.isFinite(awayScore) && homeScore !== awayScore) {
      normalized.winner = homeScore > awayScore ? normalized.home : normalized.away;
    }
  }
  normalized.homeId = getParticipantReference(data, tournament.sport, normalized.home);
  normalized.awayId = getParticipantReference(data, tournament.sport, normalized.away);
  normalized.winnerId = getParticipantReference(data, tournament.sport, normalized.winner);
  return normalized;
}

function normalizeTournament(tournament, data) {
  if (!tournament || typeof tournament !== 'object') return null;
  if (!tournament.sport || !data.sports[tournament.sport]) return null;
  if (!Array.isArray(tournament.bracket)) tournament.bracket = [];
  if (!Array.isArray(tournament.finalClassification)) tournament.finalClassification = [];
  if (!Array.isArray(tournament.groups)) tournament.groups = [];
  if (!tournament.scoring) tournament.scoring = 'sets';
  if (!tournament.format) tournament.format = tournament.groups.length ? 'groups_knockout' : 'knockout';
  if (!['knockout', 'groups_knockout', 'groups_final_group'].includes(tournament.format)) {
    tournament.format = 'knockout';
  }
  tournament.participantType = getParticipantTypeForSport(data, tournament.sport);
  if (!tournament.seeding) tournament.seeding = tournament.bracket.length ? 'manual' : 'random';
  if (!['random', 'manual', 'group_result'].includes(tournament.seeding)) tournament.seeding = 'manual';
  if (!['planned', 'ongoing', 'completed'].includes(tournament.status)) tournament.status = 'planned';
  tournament.allowDraws = typeof tournament.allowDraws === 'boolean'
    ? tournament.allowDraws
    : tournament.format !== 'knockout';
  tournament.pointsRules = normalizePointsRules(tournament.pointsRules);
  tournament.groupConfig = {
    ...structuredClone(DEFAULT_GROUP_CONFIG),
    ...(tournament.groupConfig && typeof tournament.groupConfig === 'object' ? tournament.groupConfig : {})
  };
  tournament.groupConfig.matchesPerPair = [1, 2].includes(Number(tournament.groupConfig.matchesPerPair))
    ? Number(tournament.groupConfig.matchesPerPair)
    : 1;
  ['groupCount', 'participantsPerGroup', 'qualifiersPerGroup'].forEach(key => {
    tournament.groupConfig[key] = Math.max(0, Number.parseInt(tournament.groupConfig[key], 10) || 0);
  });
  if (!Array.isArray(tournament.groupConfig.tieBreakOrder)) {
    tournament.groupConfig.tieBreakOrder = [...DEFAULT_GROUP_CONFIG.tieBreakOrder];
  }
  tournament.finalStageConfig = {
    ...structuredClone(DEFAULT_FINAL_STAGE_CONFIG),
    ...(tournament.finalStageConfig && typeof tournament.finalStageConfig === 'object' ? tournament.finalStageConfig : {})
  };
  if (!['knockout', 'final_group'].includes(tournament.finalStageConfig.type)) {
    tournament.finalStageConfig.type = tournament.format === 'groups_final_group' ? 'final_group' : 'knockout';
  }
  tournament.finalStageConfig.participantCount = Math.max(
    0,
    Number.parseInt(tournament.finalStageConfig.participantCount, 10) || 0
  );
  if (!Array.isArray(tournament.participants)) {
    tournament.participants = Array.isArray(tournament.participantIds) && tournament.participantIds.length
      ? tournament.participantIds.map(reference => getParticipantNameFromReference(data, reference))
      : [
        ...tournament.finalClassification.map(row => row.participant),
        ...tournament.bracket.flatMap(match => [match.home, match.away])
      ];
  }
  const eligibleNames = getEligibleParticipantNames(data, tournament.sport);
  tournament.participants = [...new Set(tournament.participants)].filter(name => eligibleNames.includes(name));
  tournament.participantIds = tournament.participants
    .map(name => getParticipantReference(data, tournament.sport, name))
    .filter(Boolean);
  if (!tournament.finalStageConfig.participantCount && tournament.format === 'knockout') {
    tournament.finalStageConfig.participantCount = tournament.participants.length;
  }
  const roundOrder = [...new Set(tournament.bracket.map(match => match.round || 'Runda'))];
  const roundMatchCounts = new Map();
  tournament.bracket = tournament.bracket.map((match, index) => {
    const roundName = match.round || 'Runda';
    const roundIndex = roundOrder.indexOf(roundName);
    const matchIndex = roundMatchCounts.get(roundName) || 0;
    roundMatchCounts.set(roundName, matchIndex + 1);
    return normalizeTournamentMatch(match, tournament, data, index, roundIndex, matchIndex);
  });
  tournament.groups = tournament.groups.map((group, groupIndex) => {
    const groupParticipants = Array.isArray(group.participants) && group.participants.length
      ? group.participants
      : (group.participantIds || []).map(reference => getParticipantNameFromReference(data, reference));
    const participants = [...new Set(groupParticipants)].filter(name => tournament.participants.includes(name));
    return {
      id: group.id || `group-${tournament.id}-${groupIndex + 1}`,
      name: group.name || `Grupa ${groupIndex + 1}`,
      participantIds: participants
        .map(name => getParticipantReference(data, tournament.sport, name))
        .filter(Boolean),
      participants,
      matches: Array.isArray(group.matches)
        ? group.matches.map((match, matchIndex) => {
          const normalizedMatch = normalizeMatchRecord(match, {
            scoring: tournament.scoring,
            phaseType: 'group',
            allowDraw: tournament.allowDraws,
            pointsRules: tournament.pointsRules,
            id: `group-match-${tournament.id}-${groupIndex + 1}-${matchIndex + 1}`
          });
          if (!normalizedMatch.home && normalizedMatch.homeId) {
            normalizedMatch.home = getParticipantNameFromReference(data, normalizedMatch.homeId);
          }
          if (!normalizedMatch.away && normalizedMatch.awayId) {
            normalizedMatch.away = getParticipantNameFromReference(data, normalizedMatch.awayId);
          }
          normalizedMatch.homeId = getParticipantReference(data, tournament.sport, normalizedMatch.home);
          normalizedMatch.awayId = getParticipantReference(data, tournament.sport, normalizedMatch.away);
          return normalizedMatch;
        })
        : []
    };
  });
  if (!tournament.groupConfig.groupCount && tournament.groups.length) {
    tournament.groupConfig.groupCount = tournament.groups.length;
  }
  if (tournament.finalGroup && typeof tournament.finalGroup === 'object') {
    const finalParticipants = Array.isArray(tournament.finalGroup.participants)
      ? tournament.finalGroup.participants
      : (tournament.finalGroup.participantIds || [])
        .map(reference => getParticipantNameFromReference(data, reference));
    tournament.finalGroup = {
      id: tournament.finalGroup.id || `final-group-${tournament.id}`,
      name: tournament.finalGroup.name || 'Grupa finałowa',
      participants: [...new Set(finalParticipants)].filter(name => tournament.participants.includes(name)),
      participantIds: [],
      matches: Array.isArray(tournament.finalGroup.matches)
        ? tournament.finalGroup.matches.map((match, matchIndex) => {
          const normalizedMatch = normalizeMatchRecord(match, {
            scoring: tournament.scoring,
            phaseType: 'final_group',
            allowDraw: tournament.allowDraws,
            pointsRules: tournament.pointsRules,
            id: `final-group-match-${tournament.id}-${matchIndex + 1}`
          });
          if (!normalizedMatch.home && normalizedMatch.homeId) {
            normalizedMatch.home = getParticipantNameFromReference(data, normalizedMatch.homeId);
          }
          if (!normalizedMatch.away && normalizedMatch.awayId) {
            normalizedMatch.away = getParticipantNameFromReference(data, normalizedMatch.awayId);
          }
          normalizedMatch.homeId = getParticipantReference(data, tournament.sport, normalizedMatch.home);
          normalizedMatch.awayId = getParticipantReference(data, tournament.sport, normalizedMatch.away);
          return normalizedMatch;
        })
        : []
    };
    tournament.finalGroup.participantIds = tournament.finalGroup.participants
      .map(name => getParticipantReference(data, tournament.sport, name))
      .filter(Boolean);
  } else {
    tournament.finalGroup = null;
  }
  return tournament;
}

function migrateV0ToV1(data) {
  data.schemaVersion = 1;
  return data;
}

function migrateV1ToV2(data) {
  if (!Array.isArray(data.tournaments)) data.tournaments = [];
  data.tournaments = data.tournaments
    .map(tournament => normalizeTournament(tournament, data))
    .filter(Boolean);
  data.schemaVersion = 2;
  return data;
}

function migrateLeagueData(input) {
  const data = input && typeof input === 'object' ? input : structuredClone(defaultLeagueData);
  let version = Number.isInteger(data.schemaVersion) ? data.schemaVersion : 0;
  if (version > CURRENT_SCHEMA_VERSION) {
    console.warn(`Dane ligi mają nowszą wersję schematu (${version}) niż aplikacja (${CURRENT_SCHEMA_VERSION}).`);
    return data;
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    if (version === 0) migrateV0ToV1(data);
    if (version === 1) migrateV1ToV2(data);
    version = data.schemaVersion;
  }
  return data;
}

function normalizeLoadedData(data) {
  if (!data) data = structuredClone(defaultLeagueData);
  const serialized = JSON.stringify(data);
  const damagedMarkers = ['\uFFFD', '\u0107\u017C\u02DD', '\u0139', '\u0102', '\u00E2', '\u0111'];
  if (damagedMarkers.some(marker => serialized.includes(marker))) data = structuredClone(defaultLeagueData);
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
    data.sports[key].results = data.sports[key].results.map(match => normalizeMatchRecord(match, {
      scoring: data.sports[key].defaultScoring,
      phaseType: 'league',
      allowDraw: false,
      pointsRules: data.sports[key].defaultScoring === 'sets'
        ? DEFAULT_TOURNAMENT_POINTS_RULES
        : { win: 3, draw: 0, loss: 0 }
    }));
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
    if (!Array.isArray(player.sports)) player.sports = [];
    player.sports = [...new Set(player.sports)].filter(sportKey => Boolean(data.sports[sportKey]));
    data.clubTeams
      .filter(team => (team.roster || []).includes(player.name))
      .forEach(team => {
        if (team.sport && !player.sports.includes(team.sport)) player.sports.push(team.sport);
      });
  });
  data = migrateLeagueData(data);
  data.tournaments = data.tournaments
    .map(tournament => normalizeTournament(tournament, data))
    .filter(Boolean);
  data.schemaVersion = Math.max(Number(data.schemaVersion) || 0, CURRENT_SCHEMA_VERSION);
  return data;
}

function loadLeagueData() {
  const stored = localStorage.getItem('ligaLgbtData');
  if (!stored) {
    const normalized = normalizeLoadedData(structuredClone(defaultLeagueData));
    localStorage.setItem('ligaLgbtData', JSON.stringify(normalized));
    return normalized;
  }
  try {
    const parsed = JSON.parse(stored);
    const normalized = normalizeLoadedData(parsed);
    localStorage.setItem('ligaLgbtData', JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    console.warn('Błąd danych lokalnych, używam domyślnych.', error);
    const normalized = normalizeLoadedData(structuredClone(defaultLeagueData));
    localStorage.setItem('ligaLgbtData', JSON.stringify(normalized));
    return normalized;
  }
}

function saveLeagueData(data) {
  const normalized = normalizeLoadedData(data);
  localStorage.setItem('ligaLgbtData', JSON.stringify(normalized));
  if (window.leagueStore) return window.leagueStore.saveRemoteData(normalized);
  return Promise.resolve({ remote: false });
}

let leagueData = loadLeagueData();

function replaceLeagueData(data) {
  const normalized = normalizeLoadedData(structuredClone(data));
  Object.keys(leagueData).forEach(key => delete leagueData[key]);
  Object.assign(leagueData, normalized);
}
