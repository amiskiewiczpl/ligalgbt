function getSportKey() {
  return document.body.dataset.sport || document.documentElement.dataset.sport || null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

const polishCollator = new Intl.Collator('pl-PL', {
  sensitivity: 'base',
  numeric: true,
  usage: 'sort'
});
const competitionLevelOrder = new Map(['A', 'B', 'B-', 'C', 'D', ''].map((level, index) => [level, index]));
let adminTeamSort = 'name';
let adminTournamentWizardState = null;
const ADMIN_RESULTS_FILTER_KEY = 'ligalgbt-admin-results-filters-v1';
const standingsSortState = new Map();
const adminPlayerListState = {
  search: '',
  club: '',
  sport: '',
  team: '',
  sortBy: 'surname',
  direction: 'asc'
};

function comparePolish(left, right) {
  return polishCollator.compare(String(left || '').trim(), String(right || '').trim());
}

function stableSort(items, comparator) {
  return (items || [])
    .map((item, index) => ({ item, index }))
    .sort((left, right) => comparator(left.item, right.item) || left.index - right.index)
    .map(entry => entry.item);
}

function getPersonNameParts(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { surname: '', givenNames: '' };
  return {
    surname: parts.at(-1),
    givenNames: parts.slice(0, -1).join(' ')
  };
}

function getPersonSortKey(fullName) {
  const { surname, givenNames } = getPersonNameParts(fullName);
  return `${surname}, ${givenNames}`.trim();
}

function comparePeople(left, right) {
  const leftName = getPersonNameParts(left?.name ?? left);
  const rightName = getPersonNameParts(right?.name ?? right);
  return comparePolish(leftName.surname, rightName.surname)
    || comparePolish(leftName.givenNames, rightName.givenNames)
    || comparePolish(left?.name ?? left, right?.name ?? right);
}

function sortPlayers(players) {
  return stableSort(players, comparePeople);
}

function sortClubs(clubs) {
  return stableSort(clubs, (left, right) => comparePolish(left.name, right.name));
}

function compareCompetitionLevels(left, right) {
  const leftLevel = String(left || '');
  const rightLevel = String(right || '');
  const leftOrder = competitionLevelOrder.has(leftLevel) ? competitionLevelOrder.get(leftLevel) : competitionLevelOrder.size;
  const rightOrder = competitionLevelOrder.has(rightLevel) ? competitionLevelOrder.get(rightLevel) : competitionLevelOrder.size;
  return leftOrder - rightOrder || comparePolish(leftLevel, rightLevel);
}

function sortClubTeams(teams, sortBy = 'name') {
  const comparators = {
    club: (left, right) => comparePolish(left.club, right.club) || comparePolish(left.name, right.name),
    sport: (left, right) => comparePolish(getSportName(left.sport), getSportName(right.sport)) || comparePolish(left.name, right.name),
    level: (left, right) => compareCompetitionLevels(left.level, right.level) || comparePolish(left.name, right.name),
    name: (left, right) => comparePolish(left.name, right.name)
  };
  return stableSort(teams, comparators[sortBy] || comparators.name);
}

function sortTournaments(tournaments) {
  return stableSort(tournaments, (left, right) => (
    comparePolish(left.name, right.name)
    || comparePolish(getSportName(left.sport), getSportName(right.sport))
  ));
}

function getPlayerSportsLabel(player) {
  return stableSort((player.sports || []).map(getSportName), comparePolish).join(', ');
}

function getPlayerListGroupLabel(player, sortBy = 'surname') {
  if (sortBy === 'club') return player.club || 'Bez klubu';
  if (sortBy === 'sport') return getPlayerSportsLabel(player) || 'Bez dyscypliny';
  if (sortBy === 'teamCount') {
    const count = getPlayerTeamNames(player.name).length;
    return `${count} ${count === 1 ? 'drużyna' : 'drużyn'}`;
  }
  return getPersonNameParts(player.name).surname.slice(0, 1).toLocaleUpperCase('pl-PL') || '#';
}

function filterAndSortPlayers(players, state = adminPlayerListState) {
  const search = String(state.search || '').trim().toLocaleLowerCase('pl-PL');
  const filtered = (players || []).filter(player => {
    const teamNames = getPlayerTeamNames(player.name);
    return (!search || player.name.toLocaleLowerCase('pl-PL').includes(search))
      && (!state.club || player.club === state.club)
      && (!state.sport || (player.sports || []).includes(state.sport))
      && (!state.team || teamNames.includes(state.team));
  });
  const comparators = {
    surname: comparePeople,
    club: (left, right) => comparePolish(left.club, right.club) || comparePeople(left, right),
    sport: (left, right) => comparePolish(getPlayerSportsLabel(left), getPlayerSportsLabel(right)) || comparePeople(left, right),
    teamCount: (left, right) => (
      getPlayerTeamNames(left.name).length - getPlayerTeamNames(right.name).length
      || comparePeople(left, right)
    )
  };
  const comparator = comparators[state.sortBy] || comparators.surname;
  const direction = state.direction === 'desc' ? -1 : 1;
  return stableSort(filtered, (left, right) => direction * comparator(left, right));
}

function getPlayerListGroupCounts(players, sortBy = 'surname') {
  const counts = new Map();
  (players || []).forEach(player => {
    const label = getPlayerListGroupLabel(player, sortBy);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function showToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

async function isAdminLoggedIn() {
  if (!window.leagueStore?.isConfigured) return false;
  return Boolean(await window.leagueStore.getSession());
}

const clubBadgeMap = [
  { label: 'DK', className: 'club-dragons', names: ['dragons', 'kraków', 'krakow'] },
  { label: 'NW', className: 'club-neon', names: ['neon', 'wrocław', 'wroclaw'] },
  { label: 'OP', className: 'club-orion', names: ['orion', 'poznań', 'poznan'] },
  { label: 'VW', className: 'club-volup', names: ['volup', 'warszawa'] },
  { label: 'UL', className: 'club-unicorns', names: ['unicorns', 'łódź', 'lodz'] }
];

function getClubByName(name) {
  return leagueData.teams.find(team => team.name === name) || null;
}

function getParticipantByName(name) {
  return leagueData.clubTeams.find(team => team.name === name) || null;
}

function getPlayerByName(name) {
  return leagueData.players.find(player => player.name === name) || null;
}

function getPlayerReferenceByName(name) {
  const player = getPlayerByName(name);
  return player ? `player:${player.id}` : '';
}

function getParticipantClubName(value) {
  const participant = getParticipantByName(value);
  if (participant) return participant.club;
  const player = getPlayerByName(value);
  if (player) return player.club;
  return value;
}

function getClubBadge(value) {
  const clubName = getParticipantClubName(value);
  const normalized = String(clubName || value || '').toLowerCase();
  const club = clubBadgeMap.find(item => item.names.some(name => normalized.includes(name)));
  const label = club?.label || String(clubName || value || '?').slice(0, 2).toUpperCase();
  return `<span class="club-badge ${club?.className || ''}" title="${escapeHtml(clubName || value || 'Klub')}">${escapeHtml(label)}</span>`;
}

function renderLogo(value) {
  const club = getClubByName(getParticipantClubName(value));
  if (club?.logo) return `<img class="club-logo" src="${escapeHtml(club.logo)}" alt="${escapeHtml(club.name)}" />`;
  return getClubBadge(value);
}

function getSportName(key) {
  return leagueData.sports[key]?.name || key;
}

function getClubOptions(selected = '') {
  return sortClubs(leagueData.teams).map(team => `<option value="${escapeHtml(team.name)}" ${team.name === selected ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('');
}

function getSportOptions(selected = '', type = '') {
  return stableSort(Object.keys(leagueData.sports)
    .filter(key => !type || leagueData.sports[key].type === type)
    , (left, right) => comparePolish(getSportName(left), getSportName(right)))
    .map(key => `<option value="${key}" ${key === selected ? 'selected' : ''}>${escapeHtml(getSportName(key))}</option>`)
    .join('');
}

function renderSportChoices(selected = []) {
  const selectedSet = new Set(selected || []);
  const sportKeys = stableSort(Object.keys(leagueData.sports), (left, right) => (
    comparePolish(getSportName(left), getSportName(right))
  ));
  return `<div class="sport-choice-grid">${sportKeys.map(key => `
    <label class="sport-choice">
      <input type="checkbox" name="sports" value="${escapeHtml(key)}" ${selectedSet.has(key) ? 'checked' : ''} />
      <span>${escapeHtml(getSportName(key))}</span>
    </label>
  `).join('')}</div>`;
}

function getLevelOptions(sportKey, selected = '', includeBlank = true) {
  const levels = leagueData.sports[sportKey]?.levels || [];
  const options = includeBlank ? [''] : [];
  levels.forEach(level => {
    if (!options.includes(level)) options.push(level);
  });
  if (selected && !options.includes(selected)) options.push(selected);
  return options.map(level => {
    const label = level || 'Bez poziomu';
    return `<option value="${escapeHtml(level)}" ${level === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function getParticipantOptions(sportKey, selected = '') {
  const sport = leagueData.sports[sportKey];
  const source = sport?.type === 'team'
    ? sortClubTeams(leagueData.clubTeams.filter(team => team.sport === sportKey))
    : sortPlayers(leagueData.players.filter(player => player.sports?.includes(sportKey)));
  return source.map(item => {
    const value = item.name;
    const detail = item.club ? ` (${item.club})` : '';
    return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value + detail)}</option>`;
  }).join('');
}

function getLeagueParticipants(sportKey, level = '') {
  const sport = leagueData.sports[sportKey];
  if (!sport) return [];
  if (sport.type === 'team') {
    return sortClubTeams(leagueData.clubTeams.filter(team => (
      team.sport === sportKey
      && (!sport.levels?.length || Boolean(level) && team.level === level)
    )));
  }
  return sortPlayers(leagueData.players.filter(player => player.sports?.includes(sportKey)));
}

function getFilteredParticipantOptions(participants, selected = '', excluded = '', placeholder = 'Wybierz uczestnika') {
  const available = (participants || []).filter(participant => participant.name !== excluded);
  const selectedValue = available.some(participant => participant.name === selected) ? selected : '';
  return `<option value="">${escapeHtml(placeholder)}</option>${available.map(participant => {
    const detail = participant.club ? ` (${participant.club})` : '';
    return `<option value="${escapeHtml(participant.name)}" ${participant.name === selectedValue ? 'selected' : ''}>${escapeHtml(participant.name + detail)}</option>`;
  }).join('')}`;
}

function validateLeagueMatchSelection(sportKey, level, home, away) {
  const sport = leagueData.sports[sportKey];
  if (!sport) return { valid: false, message: 'Wybierz prawidłową dyscyplinę.' };
  if (sport.type === 'team' && sport.levels?.length && !level) {
    return { valid: false, message: 'Wybierz poziom rozgrywek ligowych.' };
  }
  const participants = getLeagueParticipants(sportKey, level);
  const allowedNames = new Set(participants.map(participant => participant.name));
  if (!allowedNames.has(home) || !allowedNames.has(away)) {
    return { valid: false, message: 'Obaj uczestnicy muszą być zapisani do wybranej dyscypliny i poziomu.' };
  }
  if (home === away) return { valid: false, message: 'Uczestnik nie może grać przeciwko sobie.' };
  return { valid: true, participants };
}

function getLeagueCompetitionEntries(sportKey, level = '', season = '') {
  return (leagueData.competitions || []).filter(competition => (
    competition.kind === 'league'
    && (!sportKey || competition.sport === sportKey)
    && (!season || String(competition.season) === String(season))
    && (!level || competition.stages.some(stage => stage.level === level))
  ));
}

function getLeagueScheduleMatches(sportKey, level = '', season = '') {
  const competitionIds = new Set(
    getLeagueCompetitionEntries(sportKey, level, season).map(competition => String(competition.id))
  );
  return stableSort(
    (leagueData.matches || []).filter(match => competitionIds.has(String(match.competitionId))),
    (left, right) => {
      const dateComparison = (Date.parse(left.scheduledAt || '') || Number.MAX_SAFE_INTEGER)
        - (Date.parse(right.scheduledAt || '') || Number.MAX_SAFE_INTEGER);
      return dateComparison
        || (Number(left.roundNumber) || Number.MAX_SAFE_INTEGER) - (Number(right.roundNumber) || Number.MAX_SAFE_INTEGER)
        || comparePolish(left.home, right.home)
        || comparePolish(left.away, right.away);
    }
  );
}

function getMatchCompetitionContext(match) {
  const competition = (leagueData.competitions || [])
    .find(item => String(item.id) === String(match?.competitionId)) || null;
  const stage = competition?.stages.find(item => String(item.id) === String(match?.stageId)) || null;
  return { competition, stage };
}

function validateLeagueScheduleEntry(entry) {
  const sportKey = String(entry?.sport || '');
  const level = String(entry?.level || '');
  const season = String(entry?.season || '').trim();
  const roundNumber = Number(entry?.roundNumber);
  const scheduledAt = globalThis.competitionModel.normalizeDateTime(entry?.scheduledAt);
  const selection = validateLeagueMatchSelection(sportKey, level, entry?.home, entry?.away);
  if (!selection.valid) return selection;
  if (!season) return { valid: false, message: 'Podaj sezon rozgrywek.' };
  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    return { valid: false, message: 'Numer kolejki musi być dodatnią liczbą całkowitą.' };
  }
  if (!scheduledAt) return { valid: false, message: 'Podaj prawidłową datę i godzinę meczu.' };

  const existing = (leagueData.matches || []).find(match => String(match.id) === String(entry?.id || ''));
  if (existing?.status === 'completed') {
    const existingPair = new Set([existing.home, existing.away]);
    if (!existingPair.has(entry.home) || !existingPair.has(entry.away)) {
      return { valid: false, message: 'Najpierw wyczyść wynik, aby zmienić uczestników meczu.' };
    }
  }

  const duplicate = getLeagueScheduleMatches(sportKey, level, season).find(match => {
    if (String(match.id) === String(entry?.id || '')) return false;
    if (Number(match.roundNumber) !== roundNumber) return false;
    return (match.home === entry.home && match.away === entry.away)
      || (match.home === entry.away && match.away === entry.home);
  });
  if (duplicate) {
    return { valid: false, message: 'Ta para ma już mecz w wybranej kolejce.' };
  }
  return { valid: true, participants: selection.participants, scheduledAt };
}

function saveLeagueScheduleEntry(entry) {
  const validation = validateLeagueScheduleEntry(entry);
  if (!validation.valid) return validation;
  const competition = globalThis.competitionModel.ensureLeagueCompetition(
    leagueData,
    entry.sport,
    entry.level || '',
    entry.season
  );
  const stage = competition.stages[0];
  const homeId = getParticipantReference(leagueData, entry.sport, entry.home);
  const awayId = getParticipantReference(leagueData, entry.sport, entry.away);
  const existingIndex = (leagueData.matches || [])
    .findIndex(match => String(match.id) === String(entry.id || ''));
  const existing = existingIndex >= 0 ? leagueData.matches[existingIndex] : null;
  const normalized = globalThis.competitionModel.normalizeMatch({
    ...(existing || {}),
    id: existing?.id || `match:league:${entry.sport}:${globalThis.competitionModel.slugify(entry.season)}:${globalThis.competitionModel.slugify(entry.level || 'open')}:${Date.now()}`,
    competitionId: competition.id,
    stageId: stage.id,
    roundNumber: Number(entry.roundNumber),
    roundLabel: `Kolejka ${Number(entry.roundNumber)}`,
    scheduledAt: validation.scheduledAt,
    venue: String(entry.venue || '').trim(),
    homeId,
    awayId,
    status: existing?.status === 'completed' ? 'completed' : 'scheduled',
    scoringProfile: stage.scoringProfile,
    allowDraw: Boolean(stage.allowDraws),
    pointsRules: stage.pointsRules
  }, leagueData, existingIndex >= 0 ? existingIndex : leagueData.matches.length);
  if (existingIndex >= 0) leagueData.matches.splice(existingIndex, 1, normalized);
  else leagueData.matches.push(normalized);
  competition.participantIds = [...new Set([...competition.participantIds, homeId, awayId])];
  globalThis.competitionModel.installLegacyViews(leagueData);
  return { valid: true, match: normalized, competition, stage, created: existingIndex < 0 };
}

function validateExistingMatchForResult(match, expected = {}) {
  if (!match) return { valid: false, message: 'Wybierz istniejący mecz z terminarza.' };
  const { competition, stage } = getMatchCompetitionContext(match);
  if (!competition || !stage) return { valid: false, message: 'Mecz nie ma prawidłowych danych rozgrywek.' };
  if (expected.kind && competition.kind !== expected.kind) {
    return { valid: false, message: 'Mecz należy do innego rodzaju rozgrywek.' };
  }
  if (expected.sport && competition.sport !== expected.sport) {
    return { valid: false, message: 'Mecz należy do innej dyscypliny.' };
  }
  if (expected.level && stage.level !== expected.level) {
    return { valid: false, message: 'Mecz należy do innego poziomu.' };
  }
  if (expected.competitionId && String(competition.id) !== String(expected.competitionId)) {
    return { valid: false, message: 'Mecz należy do innych rozgrywek.' };
  }
  if (expected.stageId && String(stage.id) !== String(expected.stageId)) {
    return { valid: false, message: 'Mecz należy do innego etapu.' };
  }
  if (['bye', 'cancelled'].includes(match.status)) {
    return { valid: false, message: 'Dla tego meczu nie można wpisać wyniku.' };
  }
  if (!match.scheduledAt) return { valid: false, message: 'Najpierw ustaw datę meczu w terminarzu.' };
  if (!match.homeId || !match.awayId || !match.home || !match.away) {
    return { valid: false, message: 'Obaj uczestnicy muszą być ustaleni w terminarzu.' };
  }
  if (match.homeId === match.awayId) {
    return { valid: false, message: 'Uczestnik nie może grać przeciwko sobie.' };
  }
  if (!competition.participantIds.includes(match.homeId) || !competition.participantIds.includes(match.awayId)) {
    return { valid: false, message: 'Mecz zawiera uczestnika spoza wybranych rozgrywek.' };
  }
  return { valid: true, competition, stage, match };
}

function getAdminResultPreferences() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(ADMIN_RESULTS_FILTER_KEY) || '{}');
  } catch {
    stored = {};
  }
  const params = new URLSearchParams(window.location?.search || '');
  return {
    sport: params.get('sport') || stored.sport || '',
    competition: params.get('competition') || stored.competition || 'league',
    level: params.get('level') || stored.level || '',
    tournament: params.get('tournament') || '',
    phase: params.get('phase') || '',
    match: params.get('match') || ''
  };
}

function saveAdminResultPreferences(filters) {
  const safe = {
    sport: String(filters.sport || ''),
    competition: filters.competition === 'tournament' ? 'tournament' : 'league',
    level: String(filters.level || '')
  };
  localStorage.setItem(ADMIN_RESULTS_FILTER_KEY, JSON.stringify(safe));
  if (!window.history?.replaceState || !window.location?.pathname) return safe;
  const params = new URLSearchParams();
  Object.entries({ ...safe, tournament: filters.tournament, phase: filters.phase, match: filters.match })
    .forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  return safe;
}

function getTournamentsForSport(sportKey) {
  return stableSort(
    leagueData.tournaments.filter(tournament => tournament.sport === sportKey),
    (left, right) => comparePolish(left.name, right.name)
  );
}

function getTournamentPhaseEntries(tournament) {
  if (!tournament) return [];
  const phases = [];
  (tournament.groups || []).forEach(group => {
    phases.push({
      key: `group:${group.id}`,
      type: 'group',
      label: `Faza grupowa - ${group.name}`,
      container: group,
      matches: group.matches || []
    });
  });
  if (tournament.finalGroup) {
    phases.push({
      key: `final_group:${tournament.finalGroup.id}`,
      type: 'final_group',
      label: tournament.finalGroup.name || 'Grupa finałowa',
      container: tournament.finalGroup,
      matches: tournament.finalGroup.matches || []
    });
  }
  const bracketMatches = tournament.bracket || [];
  const roundKeys = [];
  bracketMatches.forEach(match => {
    const key = Number.isInteger(match.roundIndex)
      ? String(match.roundIndex)
      : String(match.round || 'Runda');
    if (!roundKeys.includes(key)) roundKeys.push(key);
  });
  roundKeys.forEach(roundKey => {
    const matches = bracketMatches.filter(match => {
      const key = Number.isInteger(match.roundIndex)
        ? String(match.roundIndex)
        : String(match.round || 'Runda');
      return key === roundKey;
    });
    phases.push({
      key: `knockout:${roundKey}`,
      type: 'knockout',
      label: matches[0]?.round || 'Faza play-off',
      container: tournament.bracket,
      matches
    });
  });
  return phases;
}

function getTournamentPhase(tournament, phaseKey) {
  return getTournamentPhaseEntries(tournament).find(phase => phase.key === phaseKey) || null;
}

function getTournamentMatchSelection(tournament, phaseKey, matchId) {
  const phase = getTournamentPhase(tournament, phaseKey);
  const match = phase?.matches.find(item => String(item.id) === String(matchId)) || null;
  return { phase, match };
}

function getTournamentPhaseKeyForMatch(tournament, matchId) {
  return getTournamentPhaseEntries(tournament)
    .find(phase => phase.matches.some(match => String(match.id) === String(matchId)))?.key || '';
}

function getAdminResultEditHref(tournament, match) {
  const params = new URLSearchParams({
    sport: tournament.sport,
    competition: 'tournament',
    tournament: String(tournament.id),
    phase: getTournamentPhaseKeyForMatch(tournament, match.id),
    match: String(match.id)
  });
  return `admin-wyniki.html?${params.toString()}`;
}

function validateTournamentMatchSelection(tournament, phaseKey, matchId) {
  if (!tournament) return { valid: false, message: 'Wybierz turniej zgodny z dyscypliną.' };
  const { phase, match } = getTournamentMatchSelection(tournament, phaseKey, matchId);
  if (!phase || !match) return { valid: false, message: 'Wybierz mecz z terminarza wybranej fazy.' };
  if (match.status === 'bye') return { valid: false, message: 'Nie można wpisać wyniku dla wolnego losu.' };
  if (!match.home || !match.away || !match.homeId || !match.awayId) {
    return { valid: false, message: 'Obaj uczestnicy meczu muszą być ustaleni przed wpisaniem wyniku.' };
  }
  const registered = new Set(tournament.participants || []);
  if (!registered.has(match.home) || !registered.has(match.away)) {
    return { valid: false, message: 'Mecz zawiera uczestnika niezapisanego do tego turnieju.' };
  }
  if (match.home === match.away) return { valid: false, message: 'Uczestnik nie może grać przeciwko sobie.' };
  return { valid: true, phase, match };
}

function getTournamentParticipantNames(tournament) {
  return Object.fromEntries((tournament?.participants || []).map(name => [
    getParticipantReference(leagueData, tournament.sport, name),
    name
  ]).filter(([reference]) => Boolean(reference)));
}

function getPlayerOptions(sportKey, selected = '') {
  return sortPlayers(leagueData.players
    .filter(player => !sportKey || player.sports?.includes(sportKey)))
    .map(player => `<option value="${escapeHtml(player.name)}" ${player.name === selected ? 'selected' : ''}>${escapeHtml(player.name)} (${escapeHtml(player.club)})</option>`)
    .join('');
}

function getPlayersForClub(club, sportKey = '') {
  return sortPlayers(leagueData.players.filter(player => (
    player.club === club
    && (!sportKey || player.sports?.includes(sportKey))
  )));
}

function getRosterSelectOptions(club, sportKey, selected = []) {
  const selectedSet = new Set(selected || []);
  return getPlayersForClub(club, sportKey)
    .map(player => `<option value="${escapeHtml(player.name)}" ${selectedSet.has(player.name) ? 'selected' : ''}>${escapeHtml(player.name)}</option>`)
    .join('');
}

function getTeamSelectOptions(club, sports = [], selected = []) {
  const sportsSet = new Set(sports || []);
  const selectedSet = new Set(selected || []);
  return sortClubTeams(leagueData.clubTeams
    .filter(team => team.club === club && sportsSet.has(team.sport)))
    .map(team => `<option value="${escapeHtml(team.name)}" ${selectedSet.has(team.name) ? 'selected' : ''}>${escapeHtml(team.name)} (${escapeHtml(getSportName(team.sport))}${team.level ? `, ${escapeHtml(team.level)}` : ''})</option>`)
    .join('');
}

function getPlayerTeamNames(playerName) {
  return sortClubTeams(leagueData.clubTeams
    .filter(team => (team.roster || []).includes(playerName)))
    .map(team => team.name);
}

function setPlayerTeams(playerName, playerSports, teamNames) {
  const sports = new Set(playerSports || []);
  const selected = new Set(teamNames || []);
  leagueData.clubTeams.forEach(team => {
    const roster = new Set(team.roster || []);
    if (selected.has(team.name) && sports.has(team.sport)) roster.add(playerName);
    else roster.delete(playerName);
    team.roster = [...roster];
  });
}

function getEligibleTournamentParticipants(sportKey) {
  const sport = leagueData.sports[sportKey];
  if (!sport) return [];
  return sport.type === 'team'
    ? sortClubTeams(leagueData.clubTeams.filter(team => team.sport === sportKey))
    : sortPlayers(leagueData.players.filter(player => player.sports?.includes(sportKey)));
}

function isEligibleParticipant(sportKey, name) {
  return getEligibleTournamentParticipants(sportKey).some(participant => participant.name === name);
}

function getBlockedPlayerSportRemovals(player, nextSports) {
  const next = new Set(nextSports || []);
  return (player?.sports || []).filter(sportKey => {
    if (next.has(sportKey)) return false;
    const hasResult = leagueData.sports[sportKey]?.results.some(match => (
      match.home === player.name || match.away === player.name || match.mvp === player.name
    ));
    const hasTournament = leagueData.tournaments.some(tournament => (
      tournament.sport === sportKey
      && (
        (tournament.participants || []).includes(player.name)
        || tournament.finalClassification.some(row => row.participant === player.name)
        || tournament.bracket.some(match => match.home === player.name || match.away === player.name)
      )
    ));
    return hasResult || hasTournament;
  });
}

function getTournamentParticipantOptions(sportKey, selected = []) {
  const selectedSet = new Set(selected || []);
  return getEligibleTournamentParticipants(sportKey)
    .map(participant => `<option value="${escapeHtml(participant.name)}" ${selectedSet.has(participant.name) ? 'selected' : ''}>${escapeHtml(participant.name)} (${escapeHtml(participant.club)})</option>`)
    .join('');
}

function getMatchMvpOptions(sportKey, home, away, selected = '') {
  return getMatchMvpNames(sportKey, home, away, selected)
    .map(name => `<option value="${escapeHtml(name)}" ${name === selected ? 'selected' : ''}>${escapeHtml(name)}</option>`)
    .join('');
}

function getMatchMvpNames(sportKey, home, away, selected = '') {
  const sport = leagueData.sports[sportKey];
  let names = [];
  if (sport?.type === 'team') {
    const homeTeam = getParticipantByName(home);
    const awayTeam = getParticipantByName(away);
    names = [...(homeTeam?.roster || []), ...(awayTeam?.roster || [])]
      .filter(name => getPlayerByName(name)?.sports?.includes(sportKey));
  } else {
    names = [home, away].filter(Boolean);
  }
  if (selected && !names.includes(selected)) names.push(selected);
  return sortPlayers([...new Set(names)].map(name => ({ name }))).map(player => player.name);
}

function getScoreOptions(scoring = 'volleyball', selected = '', options = {}) {
  const allowDraw = Boolean(options.allowDraw);
  const allowScheduled = Boolean(options.allowScheduled);
  const scores = scoring === 'sets'
    ? ['2:0', '2:1', ...(allowDraw ? ['1:1'] : []), '0:2', '1:2']
    : ['3:0', '3:1', '3:2', '0:3', '1:3', '2:3'];
  if (allowScheduled) scores.unshift('0:0');
  if (selected && !scores.includes(selected)) scores.push(selected);
  return scores.map(score => `<option value="${score}" ${score === selected ? 'selected' : ''}>${score}</option>`).join('');
}

function getSetCountFromScore(score) {
  const parsed = parseScore(score);
  const count = parsed.home + parsed.away;
  return count > 0 ? count : 0;
}

function renderSetInputs(score, sets = '') {
  const pairs = parseSetPairs(sets);
  const count = getSetCountFromScore(score);
  return Array.from({ length: count }, (_, index) => {
    const [home = '', away = ''] = pairs[index] || [];
    return `<div class="set-score-row"><span>Set ${index + 1}</span><label>Uczestnik 1<input type="number" min="0" name="setHome" value="${escapeHtml(home)}" required /></label><label>Uczestnik 2<input type="number" min="0" name="setAway" value="${escapeHtml(away)}" required /></label></div>`;
  }).join('');
}

function formatAdminMatchDate(value) {
  if (!value) return 'Brak daty';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Brak daty';
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsed);
}

function collectSetScores(form) {
  const homeScores = [...form.querySelectorAll('input[name="setHome"]')].map(input => Number(input.value));
  const awayScores = [...form.querySelectorAll('input[name="setAway"]')].map(input => Number(input.value));
  if (!homeScores.length || homeScores.some(Number.isNaN) || awayScores.some(Number.isNaN)) return '';
  return homeScores.map((home, index) => `${home}:${awayScores[index]}`).join(', ');
}

function parseRosterText(value) {
  return String(value || '')
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function stringifyRoster(roster) {
  return (roster || []).join('\n');
}

function getSortedRosterNames(roster) {
  const uniqueNames = [...new Set((roster || []).filter(Boolean))];
  return sortPlayers(uniqueNames.map(name => ({ name }))).map(player => player.name);
}

function getTeamRosterNames(team) {
  if (!team) return [];
  const roster = new Set(team.roster || []);
  return sortPlayers(leagueData.players.filter(player => (
    roster.has(player.name)
    && player.club === team.club
    && player.sports?.includes(team.sport)
  ))).map(player => player.name);
}

function renderRoster(roster, options = {}) {
  const names = getSortedRosterNames(roster);
  if (!names.length) {
    return '<p class="empty-state team-roster-empty">Skład nie został jeszcze uzupełniony.</p>';
  }
  const className = options.compact ? 'team-roster is-compact' : 'team-roster';
  return `<ol class="${className}" aria-label="Skład drużyny">${names.map(player => `<li><span>${escapeHtml(player)}</span></li>`).join('')}</ol>`;
}

function renderRosterSection(roster, options = {}) {
  const names = getSortedRosterNames(roster);
  const headingTag = options.headingTag || 'h4';
  const className = options.compact ? 'team-roster-block is-compact' : 'team-roster-block';
  return `<div class="${className}"><${headingTag}>Skład (${names.length})</${headingTag}>${renderRoster(names, { compact: options.compact })}</div>`;
}

function parseSetPairs(sets) {
  return String(sets || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.split(':').map(Number))
    .filter(pair => pair.length === 2 && pair.every(Number.isFinite));
}

function deriveScore(match) {
  const pairs = parseSetPairs(match.sets);
  if (!pairs.length) return match.score || '0:0';
  let home = 0;
  let away = 0;
  pairs.forEach(([h, a]) => {
    if (h > a) home += 1;
    if (a > h) away += 1;
  });
  return `${home}:${away}`;
}

function parseScore(score) {
  const [home, away] = String(score || '0:0').split(':').map(Number);
  return { home: Number.isFinite(home) ? home : 0, away: Number.isFinite(away) ? away : 0 };
}

function validateMatchResult(match, rules = {}) {
  const score = parseScore(match.score || deriveScore(match));
  const pairs = parseSetPairs(match.sets);
  const allowDraw = typeof rules.allowDraw === 'boolean' ? rules.allowDraw : Boolean(match.allowDraw);
  const allowScheduled = Boolean(rules.allowScheduled);
  if (score.home === 0 && score.away === 0) {
    return allowScheduled && !pairs.length
      ? { valid: true, status: 'scheduled', score: '0:0' }
      : { valid: false, message: 'Wynik 0:0 jest dozwolony tylko dla zaplanowanego meczu bez wpisanych setów.' };
  }
  if (score.home === score.away && !allowDraw) {
    return { valid: false, message: 'Remis nie jest dozwolony w tej fazie rozgrywek.' };
  }
  if (score.home === score.away && `${score.home}:${score.away}` !== '1:1') {
    return { valid: false, message: 'Dozwolonym remisem w systemie turniejowym jest wyłącznie 1:1.' };
  }
  const expectedSetCount = score.home + score.away;
  if (pairs.length !== expectedSetCount) {
    return { valid: false, message: `Wynik ${score.home}:${score.away} wymaga ${expectedSetCount} wyników setów.` };
  }
  if (pairs.some(([home, away]) => home === away)) {
    return { valid: false, message: 'Pojedynczy set nie może zakończyć się remisem.' };
  }
  const derived = deriveScore({ sets: match.sets, score: '' });
  if (derived !== `${score.home}:${score.away}`) {
    return { valid: false, message: 'Punkty setów nie zgadzają się z wynikiem meczu.' };
  }
  if (`${score.home}:${score.away}` === '1:1') {
    const homeSetWins = pairs.filter(([home, away]) => home > away).length;
    const awaySetWins = pairs.filter(([home, away]) => away > home).length;
    if (homeSetWins !== 1 || awaySetWins !== 1) {
      return { valid: false, message: 'Przy remisie 1:1 każdy uczestnik musi wygrać dokładnie jeden set.' };
    }
  }
  return { valid: true, status: 'completed', score: `${score.home}:${score.away}` };
}

function getMatchPoints(match, side) {
  const scoring = match.scoring || 'volleyball';
  const score = parseScore(deriveScore(match));
  const own = side === 'home' ? score.home : score.away;
  const other = side === 'home' ? score.away : score.home;
  if (match.phaseType !== 'league' && match.pointsRules) {
    const rules = match.pointsRules;
    if (own > other) return Number(rules.win) || 0;
    if (own === other) return Number(rules.draw) || 0;
    return Number(rules.loss) || 0;
  }
  if (scoring === 'sets') return own;
  if (own > other && other <= 1) return 3;
  if (own > other && other === 2) return 2;
  if (own === 2 && other === 3) return 1;
  return 0;
}

function createStandingsRow(name, level = '') {
  return {
    name,
    level,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    setDifference: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifference: 0,
    points: 0
  };
}

function calculateClubStandings(options = {}) {
  const sportKey = options.sport || '';
  const season = options.season || '';
  const clubs = new Map();

  leagueData.teams.forEach(club => {
    const clubName = club.name;
    const sportsMap = new Map();

    // Find all participants (teams or players) belonging to this club
    const clubTeams = leagueData.clubTeams.filter(team => team.club === clubName);
    const clubPlayers = leagueData.players.filter(player => player.club === clubName);

    // Collect all sport keys for this club
    const clubSportKeys = new Set([
      ...clubTeams.map(team => team.sport),
      ...clubPlayers.flatMap(player => player.sports || [])
    ]);

    clubSportKeys.forEach(skey => {
      if (sportKey && skey !== sportKey) return;
      const sport = leagueData.sports[skey];
      if (!sport) return;

      const participantNames = new Set([
        ...clubTeams.filter(team => team.sport === skey).map(team => team.name),
        ...clubPlayers.filter(player => (player.sports || []).includes(skey)).map(player => player.name)
      ]);

      const competitionsMap = new Map();
      let totalPoints = 0;
      let totalPlayed = 0;
      let totalWins = 0;
      let totalDraws = 0;

      // Gather matches from V3 model (competitions/matches) and legacy (sport.results)
      const allMatches = [];

      // Legacy results
      (sport.results || []).forEach(match => {
        if (match.status === 'completed' && (!season || matchBelongsToSeason(match, season))) {
          allMatches.push(match);
        }
      });

      // V3 matches via competitions
      (leagueData.competitions || []).forEach(competition => {
        if (competition.kind === 'league' && competition.sport === skey) {
          if (season && String(competition.season) !== String(season)) return;
          (leagueData.matches || []).forEach(match => {
            if (String(match.competitionId) === String(competition.id) && match.status === 'completed') {
              allMatches.push(match);
            }
          });
        }
      });

      allMatches.forEach(match => {
        const homeName = match.home;
        const awayName = match.away;
        const isHome = participantNames.has(homeName);
        const isAway = participantNames.has(awayName);
        if (!isHome && !isAway) return;

        const side = isHome ? 'home' : 'away';
        const points = getMatchPoints(match, side);
        totalPoints += points;
        totalPlayed += 1;

        const score = parseScore(deriveScore(match));
        const own = side === 'home' ? score.home : score.away;
        const other = side === 'home' ? score.away : score.home;
        if (own > other) totalWins += 1;
        else if (own === other) totalDraws += 1;

        // Aggregate by competition
        const competitionId = match.competitionId || 'legacy';
        if (!competitionsMap.has(competitionId)) {
          const competitionName = match.competitionId
            ? (leagueData.competitions || []).find(c => String(c.id) === String(match.competitionId))?.name || 'Liga'
            : getSportName(skey);
          const stage = match.competitionId
            ? (leagueData.competitions || []).find(c => String(c.id) === String(match.competitionId))?.stages?.find(s => String(s.id) === String(match.stageId))
            : null;
          const level = stage?.level || match.level || '';
          const kind = match.competitionId
            ? (leagueData.competitions || []).find(c => String(c.id) === String(match.competitionId))?.kind || 'league'
            : 'league';
          competitionsMap.set(competitionId, {
            id: competitionId,
            name: competitionName,
            kind,
            level,
            sport: skey,
            points: 0,
            played: 0,
            wins: 0,
            draws: 0
          });
        }
        const comp = competitionsMap.get(competitionId);
        comp.points += points;
        comp.played += 1;
        if (own > other) comp.wins += 1;
        else if (own === other) comp.draws += 1;
      });

      if (totalPlayed > 0) {
        sportsMap.set(skey, {
          sport: skey,
          sportName: getSportName(skey),
          points: totalPoints,
          played: totalPlayed,
          wins: totalWins,
          draws: totalDraws,
          competitions: [...competitionsMap.values()]
            .sort((a, b) => compareCompetitionLevels(a.level, b.level) || comparePolish(a.name, b.name))
        });
      }
    });

    if (sportsMap.size > 0) {
      const sportsArr = [...sportsMap.values()];
      const totalPoints = sportsArr.reduce((sum, s) => sum + s.points, 0);
      const totalPlayed = sportsArr.reduce((sum, s) => sum + s.played, 0);
      const totalWins = sportsArr.reduce((sum, s) => sum + s.wins, 0);
      const totalDraws = sportsArr.reduce((sum, s) => sum + s.draws, 0);
      clubs.set(clubName, {
        club: clubName,
        city: club.city || '',
        totalPoints,
        totalPlayed,
        totalWins,
        totalDraws,
        sports: sportsArr
      });
    }
  });

  return stableSort([...clubs.values()], (a, b) => {
    const pointsDiff = b.totalPoints - a.totalPoints;
    if (pointsDiff !== 0) return pointsDiff;
    const winsDiff = b.totalWins - a.totalWins;
    if (winsDiff !== 0) return winsDiff;
    return comparePolish(a.club, b.club);
  });
}

function applyMatchToRow(row, match, side) {
  const score = parseScore(deriveScore(match));
  const own = side === 'home' ? score.home : score.away;
  const other = side === 'home' ? score.away : score.home;
  const setPairs = parseSetPairs(match.sets);
  row.played += 1;
  row.wins += own > other ? 1 : 0;
  row.draws += own === other ? 1 : 0;
  row.losses += own < other ? 1 : 0;
  row.setsWon += own;
  row.setsLost += other;
  row.setDifference = row.setsWon - row.setsLost;
  row.points += getMatchPoints(match, side);
  setPairs.forEach(([homePoints, awayPoints]) => {
    row.pointsFor += side === 'home' ? homePoints : awayPoints;
    row.pointsAgainst += side === 'home' ? awayPoints : homePoints;
  });
  row.pointDifference = row.pointsFor - row.pointsAgainst;
}

function compareBaseStandings(a, b) {
  return b.points - a.points
    || b.wins - a.wins
    || b.setsWon - a.setsWon
    || b.pointsFor - a.pointsFor;
}

function matchBelongsToSeason(match, season = '') {
  if (!season) return true;
  const { competition } = getMatchCompetitionContext(match);
  return String(competition?.season || '') === String(season);
}

function calculateHeadToHeadRows(sportKey, names, level = '', options = {}) {
  const rows = new Map(names.map(name => [name, createStandingsRow(name, level)]));
  const sport = leagueData.sports[sportKey];
  if (!sport) return [];
  sport.results
    .filter(match => (
      match.status === 'completed'
      && (!level || match.level === level)
      && matchBelongsToSeason(match, options.season)
      && names.includes(match.home)
      && names.includes(match.away)
    ))
    .forEach(match => {
      applyMatchToRow(rows.get(match.home), match, 'home');
      applyMatchToRow(rows.get(match.away), match, 'away');
    });
  return [...rows.values()].sort((a, b) => compareBaseStandings(a, b) || comparePolish(a.name, b.name));
}

function compareStandingsRows(sportKey, level) {
  return (a, b) => {
    const base = compareBaseStandings(a, b);
    if (base) return base;
    const headToHead = calculateHeadToHeadRows(sportKey, [a.name, b.name], level);
    if (headToHead[0]?.name === a.name && headToHead[1]?.name === b.name) return -1;
    if (headToHead[0]?.name === b.name && headToHead[1]?.name === a.name) return 1;
    return a.name.localeCompare(b.name);
  };
}

function getTieGroups(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const key = [row.points, row.wins, row.setsWon, row.pointsFor].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.values()].filter(group => group.length > 1);
}

function applyHeadToHeadOrder(rows, sportKey, level = '', options = {}) {
  const sorted = stableSort(rows, (left, right) => (
    compareBaseStandings(left, right) || comparePolish(left.name, right.name)
  ));
  const output = [];
  for (let index = 0; index < sorted.length;) {
    const current = sorted[index];
    const tied = [current];
    let nextIndex = index + 1;
    while (nextIndex < sorted.length && compareBaseStandings(current, sorted[nextIndex]) === 0) {
      tied.push(sorted[nextIndex]);
      nextIndex += 1;
    }
    if (tied.length > 1) {
      const direct = calculateHeadToHeadRows(sportKey, tied.map(row => row.name), level, options);
      const directOrder = new Map(direct.map((row, directIndex) => [row.name, directIndex]));
      tied.sort((left, right) => (
        (directOrder.get(left.name) ?? Number.MAX_SAFE_INTEGER)
        - (directOrder.get(right.name) ?? Number.MAX_SAFE_INTEGER)
        || comparePolish(left.name, right.name)
      ));
    }
    output.push(...tied);
    index = nextIndex;
  }
  return output.map((row, index) => ({
    ...row,
    officialPosition: index + 1,
    setDifference: row.setsWon - row.setsLost,
    pointDifference: row.pointsFor - row.pointsAgainst
  }));
}

function calculateStandings(sportKey, level = '', options = {}) {
  const rows = new Map();
  const sport = leagueData.sports[sportKey];
  if (!sport) return [];
  if (sport.type === 'team' && sport.levels?.length && !level) return [];

  if (sport.type === 'team') {
    leagueData.clubTeams
      .filter(team => team.sport === sportKey && (!level || team.level === level))
      .forEach(team => {
        if (!rows.has(team.name)) rows.set(team.name, createStandingsRow(team.name, team.level || level));
      });
  }

  sport.results
    .filter(match => (
      match.status === 'completed'
      && (!level || match.level === level)
      && matchBelongsToSeason(match, options.season)
    ))
    .forEach(match => {
      ['home', 'away'].forEach(side => {
        const name = match[side];
        if (!rows.has(name)) rows.set(name, createStandingsRow(name, match.level || level));
        applyMatchToRow(rows.get(name), match, side);
      });
    });
  return applyHeadToHeadOrder([...rows.values()], sportKey, level, options);
}

function getStandingsSortKey(sportKey, level = '') {
  return `${sportKey}:${level || 'open'}`;
}

function getStandingsSortState(sportKey, level = '') {
  return standingsSortState.get(getStandingsSortKey(sportKey, level))
    || { key: 'officialPosition', direction: 'asc' };
}

function sortStandingsForView(rows, sportKey, level = '') {
  const state = getStandingsSortState(sportKey, level);
  const direction = state.direction === 'desc' ? -1 : 1;
  return stableSort(rows, (left, right) => {
    const leftValue = state.key === 'name' ? left.name : Number(left[state.key]) || 0;
    const rightValue = state.key === 'name' ? right.name : Number(right[state.key]) || 0;
    const comparison = state.key === 'name'
      ? comparePolish(leftValue, rightValue)
      : leftValue - rightValue;
    return direction * comparison || left.officialPosition - right.officialPosition;
  });
}

function getLatestCompletedMatchesForLevel(sportKey, level = '', options = {}) {
  const matches = (leagueData.sports[sportKey]?.results || [])
    .filter(match => (
      match.status === 'completed'
      && match.scheduledAt
      && (!level || match.level === level)
      && matchBelongsToSeason(match, options.season)
    ))
    .sort((left, right) => Date.parse(right.scheduledAt) - Date.parse(left.scheduledAt));
  const latestByParticipant = new Map();
  matches.forEach(match => {
    [match.home, match.away].forEach(name => {
      if (name && !latestByParticipant.has(name)) latestByParticipant.set(name, match);
    });
  });
  return [...new Map(
    [...latestByParticipant.values()].map(match => [String(match.id), match])
  ).values()].sort((left, right) => Date.parse(right.scheduledAt) - Date.parse(left.scheduledAt));
}

function calculateMvpRows(sportKey) {
  const rows = new Map();
  const sport = leagueData.sports[sportKey];
  if (!sport) return [];
  sport.results.forEach(match => {
    if (!match.mvp) return;
    if (!rows.has(match.mvp)) {
      const player = getPlayerByName(match.mvp);
      rows.set(match.mvp, { player: match.mvp, club: player?.club || '', awards: 0 });
    }
    rows.get(match.mvp).awards += 1;
  });
  return [...rows.values()].sort((a, b) => b.awards - a.awards || comparePeople(a.player, b.player));
}

function initNavigation() {
  const navs = document.querySelectorAll('.main-nav');
  if (!navs.length) return;
  function closeGroup(group) {
    const trigger = group.querySelector('.nav-trigger');
    const menu = group.querySelector('.nav-menu');
    if (!trigger) return;
    trigger.setAttribute('aria-expanded', 'false');
    group.classList.remove('is-open');
    if (menu) menu.hidden = true;
  }
  function closeAll(except = null) {
    document.querySelectorAll('.nav-group.is-open').forEach(group => {
      if (group !== except) closeGroup(group);
    });
  }
  function openGroup(group) {
    const trigger = group.querySelector('.nav-trigger');
    const menu = group.querySelector('.nav-menu');
    if (!trigger) return;
    closeAll(group);
    trigger.setAttribute('aria-expanded', 'true');
    group.classList.add('is-open');
    if (menu) menu.hidden = false;
  }
  navs.forEach(nav => {
    nav.querySelectorAll('.nav-menu').forEach(menu => { menu.hidden = true; });
    nav.querySelectorAll('.nav-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const group = trigger.closest('.nav-group');
        if (!group) return;
        trigger.getAttribute('aria-expanded') === 'true' ? closeGroup(group) : openGroup(group);
      });
    });
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      nav.querySelectorAll('.nav-group').forEach(group => {
        group.addEventListener('mouseenter', () => openGroup(group));
      });
    }
    nav.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const open = nav.querySelector('.nav-group.is-open');
      if (!open) return;
      closeGroup(open);
      open.querySelector('.nav-trigger')?.focus();
    });
  });
  document.addEventListener('click', event => {
    if (event.target.closest('.main-nav')) return;
    closeAll();
  });
}

function initHeaderScrollState() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  let ticking = false;
  let condensed = header.classList.contains('is-condensed');
  const collapseAt = 118;
  const expandAt = 42;
  const fixedHeaderQuery = window.matchMedia('(min-width: 981px)');

  function isFixedHeaderLayout() {
    return fixedHeaderQuery.matches;
  }

  function reserveHeaderSpace() {
    if (!isFixedHeaderLayout()) {
      document.documentElement.style.removeProperty('--site-header-offset');
      header.classList.remove('is-condensed');
      condensed = false;
      return;
    }

    const wasCondensed = header.classList.contains('is-condensed');
    const previousTransition = header.style.transition;
    header.style.transition = 'none';
    header.classList.remove('is-condensed');
    const headerHeight = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--site-header-offset', `${headerHeight}px`);
    if (wasCondensed) {
      header.classList.add('is-condensed');
    }
    condensed = wasCondensed;
    header.offsetHeight;
    header.style.transition = previousTransition;
  }

  function update() {
    if (!isFixedHeaderLayout()) {
      header.classList.remove('is-condensed');
      condensed = false;
      ticking = false;
      return;
    }

    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (!condensed && scrollTop > collapseAt) {
      condensed = true;
      header.classList.add('is-condensed');
    } else if (condensed && scrollTop < expandAt) {
      condensed = false;
      header.classList.remove('is-condensed');
    }
    ticking = false;
  }
  reserveHeaderSpace();
  update();
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener('resize', () => {
    reserveHeaderSpace();
    update();
  });
}

function initStaticForms() {
  document.querySelectorAll('.newsletter-form, .contact-form').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      showToast('Dziękujemy. Formularz jest gotowy wizualnie, ale wymaga podpięcia obsługi wysyłki.', 'info');
    });
  });
}

async function initLoginPage() {
  if (await isAdminLoggedIn()) {
    window.location.href = 'admin.html';
    return;
  }
  const form = document.getElementById('login-form');
  if (!form) return;
  const passwordInput = form.querySelector('input[name="password"]');
  const emailInput = form.querySelector('input[name="email"]');
  const configStatus = form.querySelector('#login-config-status');
  if (!window.leagueStore?.isConfigured) {
    if (configStatus) {
      configStatus.hidden = false;
      configStatus.textContent = 'Brakuje publicznego klucza Supabase w polu supabaseAnonKey w pliku config.js.';
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      showToast('Uzupełnij publiczny klucz Supabase w config.js.', 'warning', 6000);
    });
    return;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const email = new FormData(form).get('email').toString().trim();
    const password = new FormData(form).get('password').toString().trim();
    if (!email || !password) {
      showToast('Wpisz e-mail i hasło administratora.', 'warning');
      return;
    }
    try {
      await window.leagueStore.signIn(email, password);
      showToast('Zalogowano. Przekierowuję do panelu.', 'success', 2000);
      setTimeout(() => { window.location.href = 'admin.html'; }, 800);
    } catch (error) {
      console.error('Błąd logowania.', error);
      showToast('Nieprawidłowy e-mail lub hasło.', 'error');
      if (passwordInput) passwordInput.value = '';
      (emailInput || passwordInput)?.focus();
    }
  });
}

async function requireAdminAuth() {
  if (!await isAdminLoggedIn()) {
    showToast('Brak dostępu. Zaloguj się jako administrator.', 'warning', 3000);
    setTimeout(() => { window.location.href = 'login.html'; }, 500);
    return false;
  }
  return true;
}

function renderTeams() {
  const sportKey = getSportKey();
  const section = document.getElementById('sport-teams');
  if (!section || !sportKey) return;
  const sport = leagueData.sports[sportKey];
  const entries = sport?.type === 'team'
    ? sortClubTeams(leagueData.clubTeams.filter(team => team.sport === sportKey))
    : sortPlayers(leagueData.players.filter(player => player.sports?.includes(sportKey)));
  section.innerHTML = entries.map(entry => {
    const meta = entry.level ? `${entry.club} · poziom ${entry.level}` : entry.club;
    const description = entry.description ? `<p>${escapeHtml(entry.description)}</p>` : '';
    const roster = sport?.type === 'team' ? renderRosterSection(getTeamRosterNames(entry)) : '';
    return `<article class="team-card"><h3>${renderLogo(entry.name)} ${escapeHtml(entry.name)}</h3>${description}<p class="club-city">${escapeHtml(meta || '')}</p>${roster}</article>`;
  }).join('');
}

function renderResults() {
  const sportKey = getSportKey();
  const section = document.getElementById('sport-results');
  if (!section || !sportKey) return;
  const sport = leagueData.sports[sportKey];
  if (!sport?.results.length) {
    section.innerHTML = '<p class="empty-state">Brak aktualnych wyników.</p>';
    return;
  }
  const rows = sport.results.map(match => {
    const score = deriveScore(match);
    return `<tr><td>${escapeHtml(match.level || '-')}</td><td>${escapeHtml(match.home)}</td><td>${renderLogo(match.home)}</td><td><strong>${escapeHtml(score)}</strong></td><td>${escapeHtml(match.sets || '-')}</td><td>${renderLogo(match.away)}</td><td>${escapeHtml(match.away)}</td><td>${escapeHtml(match.mvp || '-')}</td></tr>`;
  }).join('');
  section.innerHTML = `<table><thead><tr><th>Poziom</th><th>Uczestnik 1</th><th>Logo</th><th>Wynik</th><th>Sety</th><th>Logo</th><th>Uczestnik 2</th><th>MVP</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderMvp() {
  const sportKey = getSportKey();
  const section = document.getElementById('sport-mvp');
  if (!section || !sportKey) return;
  const rows = calculateMvpRows(sportKey);
  if (!rows.length) {
    section.innerHTML = '<p class="empty-state">Brak wybranych MVP meczów.</p>';
    return;
  }
  section.innerHTML = `<table><thead><tr><th>#</th><th>Zawodnik</th><th>Klub</th><th>Logo</th><th>MVP meczu</th></tr></thead><tbody>${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.player)}</td><td>${escapeHtml(row.club)}</td><td>${renderLogo(row.club)}</td><td><strong>${row.awards}</strong></td></tr>`).join('')}</tbody></table>`;
}

function renderClubStandings(options = {}) {
  const standings = calculateClubStandings(options);
  if (!standings.length) return '<p class="empty-state">Brak wyników do klasyfikacji klubów. Rozegraj pierwsze mecze.</p>';

  const sportFilter = options.sport || '';
  const seasonFilter = options.season || '';

  return `<section class="club-rankings-section">
    <div class="section-lead">
      <span class="eyebrow">Klasyfikacja klubów</span>
      <h2>Punkty według dyscyplin</h2>
      <p>Punkty są liczone oddzielnie dla każdej dyscypliny. Nie sumujemy różnych sportów. Kliknij w wartość, aby przejść do tabeli.</p>
    </div>
    <form class="public-results-filters club-rankings-filters" id="club-rankings-filters">
      <label>Dyscyplina<select name="sport">
        <option value="">Wszystkie dyscypliny</option>
        ${getSportOptions(sportFilter)}
      </select></label>
      <label>Sezon<select name="season">
        <option value="">Wszystkie sezony</option>
        ${getPublicCompetitionSeasons().map(season => `<option value="${escapeHtml(season)}" ${season === seasonFilter ? 'selected' : ''}>${escapeHtml(season)}</option>`).join('')}
      </select></label>
    </form>
    <div class="club-rankings-list">${standings.map(club => {
      const sportsBreakdown = club.sports.map(s => {
        const competitionsHtml = s.competitions.map(comp => {
          const params = new URLSearchParams({
            sport: comp.sport,
            rozgrywki: comp.kind,
            season: seasonFilter || ''
          });
          if (comp.level) params.set('level', comp.level);
          const href = `klasyfikacje.html?${params.toString()}${comp.level ? `#poziom-${encodeURIComponent(comp.level)}` : ''}`;
          return `<a class="club-competition-link" href="${escapeHtml(href)}" title="Zobacz tabelę ${escapeHtml(comp.name)}">
            <span class="club-competition-name">${escapeHtml(comp.name)}</span>
            <span class="club-competition-points">${comp.points} pkt</span>
            <span class="club-competition-record">${comp.played} ${comp.played === 1 ? 'mecz' : 'mecze'} · ${comp.wins}W ${comp.draws ? comp.draws + 'R' : ''} ${comp.played - comp.wins - comp.draws}P</span>
          </a>`;
        }).join('');
        const sportParams = new URLSearchParams({ sport: s.sport });
        const sportHref = `klasyfikacje.html?${sportParams.toString()}`;
        return `<div class="club-rankings-sport">
          <div class="club-rankings-sport-header">
            <a href="${escapeHtml(sportHref)}">${escapeHtml(s.sportName)}</a>
            <strong>${s.points} pkt</strong>
          </div>
          <div class="club-competitions-list">${competitionsHtml}</div>
        </div>`;
      }).join('');
      return `<article class="club-rankings-card">
        <div class="club-rankings-header">
          ${renderLogo(club.club)}
          <div>
            <h3>${escapeHtml(club.club)}</h3>
            <p class="club-city">${escapeHtml(club.city)}</p>
          </div>
          <div class="club-rankings-total">
            <strong>${club.totalPoints}</strong>
            <span>pkt</span>
          </div>
        </div>
        <div class="club-rankings-summary">
          <span>${club.totalPlayed} ${club.totalPlayed === 1 ? 'mecz' : 'meczów'}</span>
          <span>${club.totalWins}W</span>
          ${club.totalDraws ? `<span>${club.totalDraws}R</span>` : ''}
          <span>${club.totalPlayed - club.totalWins - club.totalDraws}P</span>
        </div>
        ${sportsBreakdown}
      </article>`;
    }).join('')}</div>
  </section>`;
}

function renderClubsPage() {
  const grid = document.querySelector('.clubs-grid');
  if (!grid) return;
  grid.innerHTML = sortClubs(leagueData.teams).map(team => {
    const participantCount = leagueData.clubTeams.filter(entry => entry.club === team.name).length;
    const playerCount = leagueData.players.filter(player => player.club === team.name).length;
    return `<article class="club-card"><div class="club-header"><h3>${renderLogo(team.name)} ${escapeHtml(team.name)}</h3><p class="club-city">${escapeHtml(team.city)}</p></div><p class="club-description">${escapeHtml(team.description)}</p><div class="club-stats"><div class="stat"><span class="stat-label">Drużyny</span><span class="stat-value">${participantCount}</span></div><div class="stat"><span class="stat-label">Zawodnicy</span><span class="stat-value">${playerCount}</span></div></div></article>`;
  }).join('');

  // Add club rankings section after the clubs section
  const clubsSection = document.querySelector('.clubs-section');
  if (!clubsSection) return;
  const existingRankings = document.querySelector('.club-rankings-section');
  if (existingRankings) existingRankings.remove();
  const rankingsContainer = document.createElement('section');
  rankingsContainer.className = 'club-rankings-section';
  rankingsContainer.innerHTML = renderClubStandings();
  clubsSection.after(rankingsContainer);

  // Bind filter change events
  const filtersForm = rankingsContainer.querySelector('#club-rankings-filters');
  if (filtersForm) {
    filtersForm.addEventListener('change', () => {
      const sport = filtersForm.elements.namedItem('sport').value;
      const season = filtersForm.elements.namedItem('season').value;
      rankingsContainer.innerHTML = renderClubStandings({ sport, season });
      // Re-bind filters after re-render
      const newForm = rankingsContainer.querySelector('#club-rankings-filters');
      if (newForm) {
        newForm.addEventListener('change', () => {
          const newSport = newForm.elements.namedItem('sport').value;
          const newSeason = newForm.elements.namedItem('season').value;
          rankingsContainer.innerHTML = renderClubStandings({ sport: newSport, season: newSeason });
        });
      }
    });
  }
}

function renderPlayersPage() {
  const grid = document.querySelector('.players-grid');
  if (!grid) return;
  grid.innerHTML = sortPlayers(leagueData.players).map(player => {
    const teams = getPlayerTeamNames(player.name);
    const sports = (player.sports || []).map(getSportName).join(', ');
    return `<article class="player-card"><div class="player-card-header">${renderLogo(player.club)}<div><h3>${escapeHtml(player.name)}</h3><p class="club-city">${escapeHtml(player.club)}</p></div></div><p>${escapeHtml(player.bio || 'Profil zawodnika zostanie uzupełniony przez administratora.')}</p><div class="player-meta"><span>${escapeHtml(sports || 'Sport nieprzypisany')}</span><span>${escapeHtml(teams.join(', ') || 'Bez drużyny')}</span></div></article>`;
  }).join('');
}

function renderStandingsTable(sportKey, level = '', options = {}) {
  const rows = calculateStandings(sportKey, level, options);
  if (!rows.length) return '<p class="empty-state">Brak wyników do klasyfikacji.</p>';
  return renderStandingsRows(rows, sportKey, level, options);
}

function getStandingsRowStatus(row, rows, level) {
  if (!level) return '';
  if (level === 'A' && row.officialPosition === 1) return 'champion';
  if (level !== 'A' && row.officialPosition === 1) return 'promoted';
  if (rows.length > 1 && row.officialPosition === rows.length) return 'relegated';
  return '';
}

function getStandingsStatusLabel(status) {
  return {
    champion: 'Mistrzostwo',
    promoted: 'Awans',
    relegated: 'Spadek'
  }[status] || '';
}

const STANDINGS_COLUMNS = [
  { key: 'officialPosition', label: 'Poz.', title: 'Oficjalna pozycja' },
  { key: 'name', label: 'Drużyna', title: 'Drużyna' },
  { key: 'played', label: 'M', title: 'Mecze' },
  { key: 'wins', label: 'W', title: 'Wygrane' },
  { key: 'draws', label: 'R', title: 'Remisy' },
  { key: 'losses', label: 'P', title: 'Porażki' },
  { key: 'setsWon', label: 'Sety', title: 'Sety wygrane i przegrane' },
  { key: 'setDifference', label: '+/− setów', title: 'Bilans setów' },
  { key: 'pointsFor', label: 'Małe pkt', title: 'Małe punkty zdobyte i stracone' },
  { key: 'pointDifference', label: '+/− małych', title: 'Bilans małych punktów' },
  { key: 'points', label: 'Pkt', title: 'Punkty tabeli' }
];

function renderStandingsHeader(sportKey, level = '') {
  const state = getStandingsSortState(sportKey, level);
  return STANDINGS_COLUMNS.map(column => {
    const active = state.key === column.key;
    const ariaSort = active ? (state.direction === 'asc' ? 'ascending' : 'descending') : 'none';
    const indicator = active ? (state.direction === 'asc' ? '↑' : '↓') : '↕';
    return `<th scope="col" aria-sort="${ariaSort}" title="${escapeHtml(column.title)}"><button type="button" class="standings-sort-button" data-standings-sort="${escapeHtml(column.key)}" data-sport="${escapeHtml(sportKey)}" data-level="${escapeHtml(level)}"><span>${escapeHtml(column.label)}</span><span class="sort-indicator" aria-hidden="true">${indicator}</span></button></th>`;
  }).join('');
}

function renderStandingsRows(rows, sportKey, level = '', options = {}) {
  const displayedRows = sortStandingsForView(rows, sportKey, level);
  const body = displayedRows.map((row, index) => {
    const status = getStandingsRowStatus(row, rows, level);
    const statusLabel = getStandingsStatusLabel(status);
    return `<tr class="${status ? `standing-${status}` : ''}" data-official-position="${row.officialPosition}"><td><span class="standings-display-number">${index + 1}</span><small>oficjalnie ${row.officialPosition}</small></td><td><div class="standing-team-cell">${renderLogo(row.name)}<strong>${escapeHtml(row.name)}</strong>${statusLabel ? `<span class="standing-status">${escapeHtml(statusLabel)}</span>` : ''}</div></td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.setsWon}:${row.setsLost}</td><td>${row.setDifference > 0 ? '+' : ''}${row.setDifference}</td><td>${row.pointsFor}:${row.pointsAgainst}</td><td>${row.pointDifference > 0 ? '+' : ''}${row.pointDifference}</td><td><strong>${row.points}</strong></td></tr>`;
  }).join('');
  const tieBreakers = renderHeadToHeadBreakers(sportKey, rows, level, options);
  return `<div class="standings-table-scroll" role="region" aria-label="Tabela ${escapeHtml(level ? `poziomu ${level}` : getSportName(sportKey))}" tabindex="0"><table class="standings-table"><thead><tr>${renderStandingsHeader(sportKey, level)}</tr></thead><tbody>${body}</tbody></table></div>${tieBreakers}`;
}

function renderHeadToHeadBreakers(sportKey, rows, level = '', options = {}) {
  const groups = getTieGroups(rows);
  if (!groups.length) return '';
  return `<div class="head-to-head-list">${groups.map(group => {
    const names = group.map(row => row.name);
    const directRows = calculateHeadToHeadRows(sportKey, names, level, options);
    return `<div class="head-to-head-card"><h4>Bilans bezpośredni: ${names.map(escapeHtml).join(' / ')}</h4><div class="standings-table-scroll" tabindex="0"><table><thead><tr><th>Drużyna</th><th>M</th><th>W</th><th>R</th><th>Sety</th><th>Bilans</th><th>Małe punkty</th><th>Bilans</th><th>Pkt</th></tr></thead><tbody>${directRows.map(row => `<tr><td>${escapeHtml(row.name)}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.setsWon}:${row.setsLost}</td><td>${row.setDifference > 0 ? '+' : ''}${row.setDifference}</td><td>${row.pointsFor}:${row.pointsAgainst}</td><td>${row.pointDifference > 0 ? '+' : ''}${row.pointDifference}</td><td>${row.points}</td></tr>`).join('')}</tbody></table></div></div>`;
  }).join('')}</div>`;
}

function renderLatestLevelMatches(sportKey, level = '', options = {}) {
  const matches = getLatestCompletedMatchesForLevel(sportKey, level, options);
  if (!matches.length) return '<p class="empty-state standings-latest-empty">Brak rozegranych meczów z datą.</p>';
  return `<section class="standings-latest"><div class="standings-latest-heading"><span class="eyebrow">Ostatnia kolejka drużyn</span><p>Najnowszy ukończony mecz każdej drużyny, bez powtórzeń.</p></div><ol class="standings-latest-list">${matches.map(match => `<li><span>${escapeHtml(formatAdminMatchDate(match.scheduledAt))}</span><div>${renderLogo(match.home)}<strong>${escapeHtml(match.home)}</strong><b>${escapeHtml(deriveScore(match))}</b><strong>${escapeHtml(match.away)}</strong>${renderLogo(match.away)}</div></li>`).join('')}</ol></section>`;
}

function renderLevelStandingsSections(sportKey, options = {}) {
  const sport = leagueData.sports[sportKey];
  if (!sport) return '';
  if (sport.type !== 'team' || !sport.levels?.length) {
    return `<article class="level-standings">${renderStandingsTable(sportKey, '', options)}</article>`;
  }
  const visibleLevels = options.level ? sport.levels.filter(level => level === options.level) : sport.levels;
  return `<div class="standings-legend"><span class="legend-champion">Mistrz poziomu A</span><span class="legend-promoted">Awans</span><span class="legend-relegated">Spadek</span></div>${visibleLevels.map(level => {
    const rows = calculateStandings(sportKey, level, options);
    const empty = `<p class="empty-state">Brak drużyn zapisanych na poziom ${escapeHtml(level)}.</p>`;
    return `<article class="level-standings" id="poziom-${encodeURIComponent(level)}" data-standings-level="${escapeHtml(level)}"><div class="level-standings-header"><div><span class="eyebrow">Poziom</span><h3>${escapeHtml(level)}</h3></div><span>${rows.length} ${rows.length === 1 ? 'drużyna' : 'drużyn'}</span></div>${rows.length ? `${renderStandingsRows(rows, sportKey, level, options)}${renderLatestLevelMatches(sportKey, level, options)}` : empty}</article>`;
  }).join('')}`;
}

function bindStandingsSorting(container, rerender) {
  if (!container) return;
  container.querySelectorAll('[data-standings-sort]').forEach(button => button.addEventListener('click', () => {
    const key = getStandingsSortKey(button.dataset.sport, button.dataset.level);
    const current = getStandingsSortState(button.dataset.sport, button.dataset.level);
    standingsSortState.set(key, {
      key: button.dataset.standingsSort,
      direction: current.key === button.dataset.standingsSort && current.direction === 'asc' ? 'desc' : 'asc'
    });
    rerender();
  }));
}

function renderSportStandings() {
  const sportKey = getSportKey();
  const section = document.getElementById('sport-standings');
  if (!section || !sportKey) return;
  const sport = leagueData.sports[sportKey];
  if (!sport) return;
  section.innerHTML = renderLevelStandingsSections(sportKey);
  bindStandingsSorting(section, renderSportStandings);
}

function getPublicTournaments(filters = {}) {
  return sortTournaments(leagueData.tournaments.filter(tournament => (
    tournament.status !== 'draft'
    && (!filters.sport || tournament.sport === filters.sport)
    && (!filters.season || String(tournament.season) === String(filters.season))
  )));
}

function getPublicCompetitionSeasons(sportKey = '', kind = '') {
  const seasons = (leagueData.competitions || [])
    .filter(competition => (
      competition.status !== 'draft'
      && (!sportKey || competition.sport === sportKey)
      && (!kind || competition.kind === kind)
    ))
    .map(competition => String(competition.season || ''))
    .filter(Boolean);
  return [...new Set(seasons)].sort((left, right) => comparePolish(right, left));
}

function getCalendarDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCalendarEventHref(competition, stage) {
  if (!competition) return '';
  if (competition.kind === 'tournament') {
    return `turniej.html?id=${encodeURIComponent(competition.id)}`;
  }
  const params = new URLSearchParams({
    sport: competition.sport,
    season: String(competition.season || ''),
    rozgrywki: 'league'
  });
  if (stage?.level) params.set('level', stage.level);
  const anchor = stage?.level ? `#poziom-${encodeURIComponent(stage.level)}` : '';
  return `klasyfikacje.html?${params.toString()}${anchor}`;
}

function getCalendarEvents(filters = {}) {
  const uniqueMatches = new Map();
  (leagueData.matches || []).forEach(match => {
    if (!match?.id || !match.scheduledAt || uniqueMatches.has(String(match.id))) return;
    const { competition, stage } = getMatchCompetitionContext(match);
    if (!competition || competition.status === 'draft') return;
    const timestamp = Date.parse(match.scheduledAt);
    if (!Number.isFinite(timestamp)) return;
    const kind = competition.kind;
    const level = stage?.level || match.level || '';
    const status = match.status || 'scheduled';
    const dayKey = getCalendarDayKey(match.scheduledAt);
    if (filters.sport && competition.sport !== filters.sport) return;
    if (filters.kind && kind !== filters.kind) return;
    if (filters.level && level !== filters.level) return;
    if (filters.status && status !== filters.status) return;
    if (filters.from && dayKey < filters.from) return;
    if (filters.to && dayKey > filters.to) return;
    uniqueMatches.set(String(match.id), {
      id: String(match.id),
      match,
      competition,
      stage,
      sport: competition.sport,
      kind,
      level,
      status,
      scheduledAt: match.scheduledAt,
      timestamp,
      dayKey,
      href: getCalendarEventHref(competition, stage)
    });
  });
  return stableSort([...uniqueMatches.values()], (left, right) => (
    left.timestamp - right.timestamp
    || comparePolish(left.competition.name, right.competition.name)
    || comparePolish(left.match.home, right.match.home)
  ));
}

function groupCalendarEvents(events) {
  const months = [];
  events.forEach(event => {
    const date = new Date(event.scheduledAt);
    const monthKey = event.dayKey.slice(0, 7);
    let month = months.at(-1);
    if (!month || month.key !== monthKey) {
      month = {
        key: monthKey,
        label: new Intl.DateTimeFormat('pl-PL', {
          month: 'long',
          year: 'numeric'
        }).format(date),
        days: []
      };
      months.push(month);
    }
    let day = month.days.at(-1);
    if (!day || day.key !== event.dayKey) {
      day = {
        key: event.dayKey,
        label: new Intl.DateTimeFormat('pl-PL', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        }).format(date),
        events: []
      };
      month.days.push(day);
    }
    day.events.push(event);
  });
  return months;
}

function getCalendarStatusLabel(status) {
  return {
    scheduled: 'Zaplanowany',
    completed: 'Zakończony',
    cancelled: 'Odwołany',
    postponed: 'Przełożony',
    in_progress: 'W trakcie'
  }[status] || status || 'Zaplanowany';
}

function getCalendarFilters() {
  const params = new URLSearchParams(window.location.search);
  const sports = Object.keys(leagueData.sports);
  const sport = sports.includes(params.get('sport')) ? params.get('sport') : '';
  const kind = ['league', 'tournament'].includes(params.get('rozgrywki'))
    ? params.get('rozgrywki')
    : '';
  const levels = [...new Set((leagueData.competitions || [])
    .filter(competition => (
      competition.status !== 'draft'
      && competition.kind === 'league'
      && (!sport || competition.sport === sport)
    ))
    .flatMap(competition => competition.stages || [])
    .map(stage => stage.level)
    .filter(Boolean))].sort(comparePolish);
  const statuses = [...new Set(getCalendarEvents({ sport, kind })
    .map(event => event.status))].sort(comparePolish);
  const requestedLevel = params.get('level');
  const requestedStatus = params.get('status');
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : '';
  return {
    sport,
    kind,
    level: levels.includes(requestedLevel) ? requestedLevel : '',
    status: statuses.includes(requestedStatus) ? requestedStatus : '',
    from: validDate(params.get('od')),
    to: validDate(params.get('do')),
    levels,
    statuses
  };
}

function updateCalendarUrl(filters) {
  if (!window.history?.replaceState) return;
  const params = new URLSearchParams();
  if (filters.sport) params.set('sport', filters.sport);
  if (filters.kind) params.set('rozgrywki', filters.kind);
  if (filters.level) params.set('level', filters.level);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('od', filters.from);
  if (filters.to) params.set('do', filters.to);
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

function renderCalendarFilters(filters) {
  return `<form class="public-results-filters calendar-filters" id="calendar-filters"><label>Dyscyplina<select name="sport"><option value="">Wszystkie dyscypliny</option>${getSportOptions(filters.sport)}</select></label><label>Rodzaj rozgrywek<select name="kind"><option value="">Liga i turnieje</option><option value="league" ${filters.kind === 'league' ? 'selected' : ''}>Liga</option><option value="tournament" ${filters.kind === 'tournament' ? 'selected' : ''}>Turnieje</option></select></label><label>Poziom<select name="level"><option value="">Wszystkie poziomy</option>${filters.levels.map(level => `<option value="${escapeHtml(level)}" ${level === filters.level ? 'selected' : ''}>${escapeHtml(level)}</option>`).join('')}</select></label><label>Status<select name="status"><option value="">Wszystkie statusy</option>${filters.statuses.map(status => `<option value="${escapeHtml(status)}" ${status === filters.status ? 'selected' : ''}>${escapeHtml(getCalendarStatusLabel(status))}</option>`).join('')}</select></label><label>Od<input type="date" name="from" value="${escapeHtml(filters.from)}" /></label><label>Do<input type="date" name="to" value="${escapeHtml(filters.to)}" /></label><button type="reset" class="button-secondary compact-button calendar-filter-reset">Wyczyść filtry</button></form>`;
}

function renderCalendarEvent(event) {
  const date = new Date(event.scheduledAt);
  const time = new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
  const match = event.match;
  const completed = event.status === 'completed';
  const context = [
    event.stage?.name || match.roundLabel,
    event.level ? `Poziom ${event.level}` : '',
    match.roundLabel && event.stage?.name !== match.roundLabel ? match.roundLabel : ''
  ].filter(Boolean).join(' · ');
  const scoreOrStatus = completed
    ? `<strong class="calendar-event-score">${escapeHtml(deriveScore(match))}</strong>`
    : `<span class="match-status match-status-${escapeHtml(event.status)}">${escapeHtml(getCalendarStatusLabel(event.status))}</span>`;
  return `<article class="calendar-event"><time datetime="${escapeHtml(event.scheduledAt)}">${escapeHtml(time)}</time><div class="calendar-event-main"><div class="calendar-event-context"><span>${escapeHtml(getSportName(event.sport))}</span><strong>${escapeHtml(event.competition.name)}</strong>${context ? `<small>${escapeHtml(context)}</small>` : ''}</div><div class="calendar-event-opponents"><span>${renderLogo(match.home)}<strong>${escapeHtml(match.home || 'Do ustalenia')}</strong></span>${scoreOrStatus}<span><strong>${escapeHtml(match.away || 'Do ustalenia')}</strong>${renderLogo(match.away)}</span></div><div class="calendar-event-details"><span>${escapeHtml(match.venue || 'Miejsce do ustalenia')}</span>${match.sets && completed ? `<span>Sety: ${escapeHtml(match.sets)}</span>` : ''}</div></div><a class="button button-alt compact-button calendar-event-link" href="${escapeHtml(event.href)}">${event.kind === 'tournament' ? 'Turniej' : 'Tabela'}</a></article>`;
}

function renderCalendarPage() {
  const container = document.getElementById('calendar-view');
  if (!container) return;
  const filters = getCalendarFilters();
  const events = getCalendarEvents(filters);
  const months = groupCalendarEvents(events);
  const stream = months.length
    ? `<div class="calendar-stream">${months.map(month => `<section class="calendar-month"><header><span class="eyebrow">Miesiąc</span><h2>${escapeHtml(month.label)}</h2></header>${month.days.map(day => `<section class="calendar-day"><h3><time datetime="${escapeHtml(day.key)}">${escapeHtml(day.label)}</time></h3><div class="calendar-day-events">${day.events.map(renderCalendarEvent).join('')}</div></section>`).join('')}</section>`).join('')}</div>`
    : '<p class="empty-state calendar-empty">Brak meczów z datą dla wybranych filtrów.</p>';
  container.innerHTML = `<section class="page-intro"><span class="eyebrow">Kalendarz</span><h2>Liga i turnieje w jednym terminarzu</h2><p>Każdy datowany mecz pojawia się raz i prowadzi bezpośrednio do właściwej tabeli albo strony turnieju.</p></section>${renderCalendarFilters(filters)}<div class="calendar-summary"><strong>${events.length}</strong><span>${events.length === 1 ? 'wydarzenie' : 'wydarzeń'}</span></div>${stream}`;
  const form = container.querySelector('#calendar-filters');
  form.addEventListener('change', () => {
    updateCalendarUrl({
      sport: form.elements.namedItem('sport').value,
      kind: form.elements.namedItem('kind').value,
      level: form.elements.namedItem('level').value,
      status: form.elements.namedItem('status').value,
      from: form.elements.namedItem('from').value,
      to: form.elements.namedItem('to').value
    });
    renderCalendarPage();
  });
  form.addEventListener('reset', event => {
    event.preventDefault();
    updateCalendarUrl({});
    renderCalendarPage();
  });
}

function getPublicResultsFilters() {
  const params = new URLSearchParams(window.location.search);
  const availableSports = Object.keys(leagueData.sports);
  const requestedSport = params.get('sport');
  const sport = availableSports.includes(requestedSport) ? requestedSport : availableSports[0] || '';
  const requestedKind = params.get('rozgrywki');
  const kind = ['league', 'tournament'].includes(requestedKind) ? requestedKind : 'league';
  const seasons = getPublicCompetitionSeasons(sport, kind);
  const requestedSeason = params.get('season');
  const season = seasons.includes(requestedSeason) ? requestedSeason : seasons[0] || '';
  const levels = leagueData.sports[sport]?.levels || [];
  const requestedLevel = params.get('level');
  const level = levels.includes(requestedLevel) ? requestedLevel : '';
  return { sport, season, kind, level, seasons, levels };
}

function updatePublicResultsUrl(filters) {
  if (!window.history?.replaceState) return;
  const params = new URLSearchParams();
  if (filters.sport) params.set('sport', filters.sport);
  if (filters.season) params.set('season', filters.season);
  if (filters.kind) params.set('rozgrywki', filters.kind);
  if (filters.level) params.set('level', filters.level);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

function renderPublicFilterBar(filters, options = {}) {
  const showKind = options.showKind !== false;
  const showLevel = filters.kind === 'league' && filters.levels.length;
  return `<form class="public-results-filters" id="${escapeHtml(options.id || 'public-results-filters')}"><label>Dyscyplina<select name="sport">${getSportOptions(filters.sport)}</select></label><label>Sezon<select name="season">${filters.seasons.map(season => `<option value="${escapeHtml(season)}" ${season === filters.season ? 'selected' : ''}>${escapeHtml(season)}</option>`).join('') || '<option value="">Wszystkie</option>'}</select></label>${showKind ? `<label>Rozgrywki<select name="kind"><option value="league" ${filters.kind === 'league' ? 'selected' : ''}>Liga</option><option value="tournament" ${filters.kind === 'tournament' ? 'selected' : ''}>Turnieje</option></select></label>` : ''}<label data-public-filter="level" ${showLevel ? '' : 'hidden'}>Poziom<select name="level"><option value="">Wszystkie poziomy</option>${filters.levels.map(level => `<option value="${escapeHtml(level)}" ${level === filters.level ? 'selected' : ''}>${escapeHtml(level)}</option>`).join('')}</select></label></form>`;
}

function bindPublicResultsFilters(container, rerender, options = {}) {
  const form = container.querySelector(`#${options.id || 'public-results-filters'}`);
  if (!form) return;
  form.addEventListener('change', () => {
    const sport = form.elements.namedItem('sport').value;
    const kindInput = form.elements.namedItem('kind');
    const kind = kindInput?.value || options.kind || 'tournament';
    const seasons = getPublicCompetitionSeasons(sport, kind);
    const seasonInput = form.elements.namedItem('season');
    const season = seasons.includes(seasonInput.value) ? seasonInput.value : seasons[0] || '';
    const levelInput = form.elements.namedItem('level');
    updatePublicResultsUrl({
      sport,
      season,
      kind,
      level: levelInput?.value || ''
    });
    rerender();
  });
}

function renderPublicLeagueResults(filters) {
  const sport = leagueData.sports[filters.sport];
  const matches = (sport?.results || [])
    .filter(match => (
      match.status === 'completed'
      && matchBelongsToSeason(match, filters.season)
      && (!filters.level || match.level === filters.level)
    ))
    .sort((left, right) => (Date.parse(right.scheduledAt || '') || 0) - (Date.parse(left.scheduledAt || '') || 0));
  const rows = matches.map(match => `<tr><td>${escapeHtml(formatAdminMatchDate(match.scheduledAt))}</td><td>${escapeHtml(match.level || '–')}</td><td>${renderLogo(match.home)} ${escapeHtml(match.home)}</td><td><strong>${escapeHtml(deriveScore(match))}</strong></td><td>${escapeHtml(match.away)} ${renderLogo(match.away)}</td><td>${escapeHtml(match.sets || '–')}</td></tr>`).join('');
  return `<section class="public-results-block"><div class="section-lead"><span class="eyebrow">Liga</span><h2>${escapeHtml(getSportName(filters.sport))}: wyniki i tabele</h2><p>${filters.season ? `Sezon ${escapeHtml(filters.season)}.` : ''} Oficjalna pozycja pozostaje widoczna po sortowaniu tabeli.</p></div>${renderLevelStandingsSections(filters.sport, { season: filters.season, level: filters.level })}<section class="ranking-view public-match-results"><h3>Rozegrane mecze</h3><div class="admin-table-scroll"><table><thead><tr><th>Data</th><th>Poziom</th><th>Uczestnik 1</th><th>Wynik</th><th>Uczestnik 2</th><th>Sety</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Brak ukończonych meczów dla wybranych filtrów.</td></tr>'}</tbody></table></div></section></section>`;
}

function renderPublicRankingsPage() {
  const main = document.querySelector('main.container');
  if (!main) return;
  const filters = getPublicResultsFilters();
  const content = filters.kind === 'tournament'
    ? `<section class="public-results-block"><div class="section-lead"><span class="eyebrow">Turnieje</span><h2>${escapeHtml(getSportName(filters.sport))}: wydarzenia</h2><p>Każdy turniej ma osobną stronę z etapami, wynikami i drabinką.</p></div>${renderTournamentCardList(getPublicTournaments(filters))}</section>`
    : renderPublicLeagueResults(filters);
  main.innerHTML = `<section class="page-intro"><span class="eyebrow">Wyniki i tabele</span><h2>Jedno miejsce dla ligi i turniejów</h2><p>Filtry ograniczają dane do konkretnej dyscypliny, sezonu, rodzaju rozgrywek i poziomu.</p></section>${renderPublicFilterBar(filters)}${content}`;
  bindStandingsSorting(main, renderPublicRankingsPage);
  bindPublicResultsFilters(main, renderPublicRankingsPage);
}

function getTournamentFormatLabel(format) {
  return {
    knockout: 'Play-off',
    groups_knockout: 'Grupy + play-off',
    groups_final_group: 'Grupy + grupa finałowa'
  }[format] || 'Turniej';
}

function getTournamentStatusLabel(status) {
  return {
    draft: 'Szkic',
    published: 'Opublikowany',
    planned: 'Planowany',
    ongoing: 'W trakcie',
    completed: 'Zakończony'
  }[status] || status || 'Planowany';
}

function getTournamentParticipantName(tournament, reference, fallback = '') {
  return getParticipantNameFromReference(leagueData, reference)
    || fallback
    || tournament.participants?.find(name => getParticipantReference(leagueData, tournament.sport, name) === reference)
    || '';
}

function renderTournamentClassification(tournament, compact = false) {
  const rows = tournament.finalClassification || [];
  if (!rows.length) return '<p class="empty-state">Klasyfikacja końcowa pojawi się po zakończeniu turnieju.</p>';
  const visibleRows = compact ? rows.slice(0, 4) : rows;
  return `<div class="tournament-table-scroll"><table class="tournament-classification"><thead><tr><th>Miejsce</th><th>Uczestnik</th><th>Klub</th><th>Logo</th></tr></thead><tbody>${visibleRows.map(row => `<tr><td><strong>${escapeHtml(row.place)}</strong></td><td>${escapeHtml(row.participant)}</td><td>${escapeHtml(row.club || getParticipantClubName(row.participant))}</td><td>${renderLogo(row.participant)}</td></tr>`).join('')}</tbody></table></div>`;
}

function formatPublicDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium' }).format(date);
}

function getTournamentDateLabel(tournament) {
  const start = formatPublicDate(tournament.startDate);
  const end = formatPublicDate(tournament.endDate);
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end || 'Termin do ustalenia';
}

function getTournamentMatches(tournament) {
  const canonical = (leagueData.matches || []).filter(match => (
    String(match.competitionId) === String(tournament.id)
  ));
  if (canonical.length) return canonical;
  return [
    ...(tournament.groups || []).flatMap(group => group.matches || []),
    ...(tournament.finalGroup?.matches || []),
    ...(tournament.bracket || [])
  ];
}

function renderTournamentParticipants(tournament) {
  const participants = (tournament.participantIds || []).map(reference => (
    getTournamentParticipantName(tournament, reference)
  )).filter(Boolean);
  if (!participants.length) return '<p class="empty-state">Lista uczestników nie została jeszcze opublikowana.</p>';
  return `<ol class="tournament-participant-list">${participants.map(name => `<li>${renderLogo(name)}<span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(getParticipantClubName(name))}</small></span></li>`).join('')}</ol>`;
}

function renderTournamentStageRoadmap(tournament) {
  const matches = getTournamentMatches(tournament);
  return `<div class="tournament-stage-roadmap">${(tournament.stages || []).map(stage => {
    const stageMatches = matches.filter(match => String(match.stageId) === String(stage.id));
    const completed = stageMatches.filter(match => match.status === 'completed').length;
    return `<article><span>Etap ${stage.order}</span><h4>${escapeHtml(stage.name)}</h4><p>${escapeHtml(getTournamentStageTypeLabel(stage.type))}</p><small>${completed} z ${stageMatches.length} zakończonych</small></article>`;
  }).join('')}</div>`;
}

function renderTournamentGroupTable(tournament, group, isFinalGroup = false, stage = null) {
  const standings = globalThis.tournamentEngine
    ? globalThis.tournamentEngine.calculateGroupStandings(group, {
      tieBreakOrder: stage?.tieBreakOrder || tournament.groupConfig?.tieBreakOrder,
      manualTieBreaks: group.manualTieBreaks
    })
    : [];
  if (!standings.length) return '<p class="empty-state">Brak uczestników w grupie.</p>';
  const qualifiers = isFinalGroup
    ? 0
    : Number(stage?.qualificationRule?.count ?? stage?.groupConfig?.qualifiersPerGroup ?? tournament.groupConfig?.qualifiersPerGroup) || 0;
  return `<div class="tournament-table-scroll"><table class="tournament-group-table"><thead><tr><th>#</th><th>Uczestnik</th><th>M</th><th>W</th><th>R</th><th>P</th><th>Sety</th><th>Małe punkty</th><th>Pkt</th></tr></thead><tbody>${standings.map(row => {
    const name = getTournamentParticipantName(tournament, row.participantId);
    return `<tr class="${row.position <= qualifiers ? 'is-qualified' : ''}"><td>${row.position}</td><td><div class="tournament-participant">${renderLogo(name)}<strong>${escapeHtml(name)}</strong></div></td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.setsWon}:${row.setsLost}</td><td>${row.pointsFor}:${row.pointsAgainst}</td><td><strong>${row.points}</strong></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderTournamentMatchRows(tournament, matches, options = {}) {
  if (!matches?.length) return '<p class="empty-state">Terminarz nie został jeszcze wygenerowany.</p>';
  return `<div class="tournament-match-list">${matches.map(match => {
    const home = getTournamentParticipantName(tournament, match.homeId, match.home);
    const away = getTournamentParticipantName(tournament, match.awayId, match.away);
    const score = match.status === 'completed' ? (match.score || deriveScore(match)) : '–';
    const status = match.status === 'completed' ? 'Zakończony' : match.status === 'bye' ? 'Wolny los' : 'Zaplanowany';
    const editAction = options.adminEdit && match.status !== 'bye' && home && away
      ? `<a class="compact-button bracket-result-action" href="${escapeHtml(getAdminResultEditHref(tournament, match))}">${match.status === 'completed' ? 'Edytuj wynik' : 'Wpisz wynik'}</a>`
      : '';
    return `<article class="tournament-match-row"><span class="tournament-match-status">${status}</span><div class="tournament-match-side">${home ? renderLogo(home) : ''}<strong>${escapeHtml(home || 'Do ustalenia')}</strong></div><span class="tournament-match-score">${escapeHtml(score)}</span><div class="tournament-match-side tournament-match-side-away"><strong>${escapeHtml(away || 'Do ustalenia')}</strong>${away ? renderLogo(away) : ''}</div>${match.sets ? `<small>${escapeHtml(match.sets)}</small>` : ''}${editAction}</article>`;
  }).join('')}</div>`;
}

function renderTournamentGroups(tournament, options = {}) {
  const allMatches = getTournamentMatches(tournament);
  const canonicalStages = (tournament.stages || []).filter(stage => stage.type !== 'knockout');
  const stages = canonicalStages.length ? canonicalStages : (tournament.groups || []).length ? [{
    id: `legacy-groups:${tournament.id}`,
    order: 1,
    name: 'Faza grupowa',
    type: 'groups',
    role: 'groups',
    groups: tournament.groups,
    groupConfig: tournament.groupConfig,
    tieBreakOrder: tournament.groupConfig?.tieBreakOrder,
    qualificationRule: { count: tournament.groupConfig?.qualifiersPerGroup },
    legacyEmbeddedMatches: true
  }] : [];
  if (!stages.length) return '';
  return stages.map(stage => {
    const stageMatches = allMatches.filter(match => String(match.stageId) === String(stage.id));
    const groups = (stage.groups || []).length
      ? stage.groups.map(group => ({
        ...group,
        matches: stage.legacyEmbeddedMatches
          ? group.matches || []
          : stageMatches.filter(match => String(match.groupId) === String(group.id))
      }))
      : [{
        id: `stage-group:${stage.id}`,
        name: stage.name,
        participantIds: stage.participantIds?.length ? stage.participantIds : tournament.participantIds,
        manualTieBreaks: {},
        matches: stageMatches
      }];
    return `<section class="tournament-stage"><div class="tournament-stage-heading"><div><span class="eyebrow">Etap ${stage.order}</span><h3>${escapeHtml(stage.name)}</h3></div><span class="tournament-stage-note">${Number(stage.groupConfig?.matchesPerPair) === 2 ? 'Mecz i rewanż' : 'Jeden mecz każdej pary'}</span></div><div class="tournament-groups-grid">${groups.map(group => {
      const isFinalGroup = stage.role === 'final_group';
      return `<article class="tournament-group${isFinalGroup ? ' is-final-group' : ''}"><div class="tournament-group-header"><h4>${escapeHtml(group.name)}</h4><span>${group.participantIds?.length || 0} uczestników</span></div>${renderTournamentGroupTable(tournament, group, isFinalGroup, stage)}<div class="tournament-group-matches"><h5>Mecze</h5>${renderTournamentMatchRows(tournament, group.matches, options)}</div></article>`;
    }).join('')}</div></section>`;
  }).join('');
}

function getBracketSideScore(match, side) {
  if (match.status === 'bye') return side === 'home' ? 'BYE' : '–';
  if (match.status !== 'completed') return '–';
  const score = parseScore(match.score || deriveScore(match));
  return side === 'home' ? String(score.home) : String(score.away);
}

function renderTournamentBracket(tournament, options = {}) {
  const matches = (tournament.bracket || []).filter(match => !match.isThirdPlace);
  const thirdPlace = (tournament.bracket || []).find(match => match.isThirdPlace);
  if (!matches.length) return '';
  const rounds = [...new Set(matches.map(match => match.roundIndex))]
    .sort((a, b) => a - b)
    .map(roundIndex => ({
      roundIndex,
      name: matches.find(match => match.roundIndex === roundIndex)?.round || `Runda ${roundIndex + 1}`,
      matches: matches.filter(match => match.roundIndex === roundIndex).sort((a, b) => a.matchIndex - b.matchIndex)
    }));
  return `<section class="tournament-stage"><div class="tournament-stage-heading"><div><span class="eyebrow">Faza finałowa</span><h3>Drabinka turnieju</h3></div><span class="tournament-stage-note">Przewiń poziomo, aby zobaczyć kolejne rundy</span></div><div class="tournament-bracket-scroll" role="region" aria-label="Drabinka turnieju" tabindex="0"><div class="tournament-bracket" style="--round-count:${rounds.length}">${rounds.map(round => `<section class="tournament-round"><h4>${escapeHtml(round.name)}</h4><div class="tournament-round-matches">${round.matches.map(match => {
    const home = getTournamentParticipantName(tournament, match.homeId, match.home);
    const away = getTournamentParticipantName(tournament, match.awayId, match.away);
    const score = match.status === 'bye' ? 'BYE' : match.status === 'completed' ? (match.score || deriveScore(match)) : '–';
    const editAction = options.adminEdit && match.status !== 'bye' && home && away
      ? `<a class="compact-button bracket-result-action" href="${escapeHtml(getAdminResultEditHref(tournament, match))}">${match.status === 'completed' ? 'Edytuj wynik' : 'Wpisz wynik'}</a>`
      : '';
    return `<article class="bracket-game ${match.status === 'completed' || match.status === 'bye' ? 'is-complete' : ''}"><span class="bracket-game-number">Mecz ${match.matchIndex + 1}</span><div class="${match.winnerId && match.winnerId === match.homeId ? 'is-winner' : ''}"><span>${home ? renderLogo(home) : ''}${escapeHtml(home || 'Do ustalenia')}</span><strong>${escapeHtml(getBracketSideScore(match, 'home'))}</strong></div><div class="${match.winnerId && match.winnerId === match.awayId ? 'is-winner' : ''}"><span>${away ? renderLogo(away) : ''}${escapeHtml(away || 'Do ustalenia')}</span><strong>${escapeHtml(getBracketSideScore(match, 'away'))}</strong></div>${match.sets ? `<small>${escapeHtml(match.sets)}</small>` : ''}${editAction}</article>`;
  }).join('')}</div></section>`).join('')}</div></div>${thirdPlace ? `<div class="tournament-third-place"><h4>Mecz o 3. miejsce</h4>${renderTournamentMatchRows(tournament, [thirdPlace], options)}</div>` : ''}</section>`;
}

function renderTournamentFlow(tournament) {
  if (tournament.format === 'knockout') return '';
  const finalLabel = tournament.format === 'groups_final_group' ? 'Grupa finałowa' : 'Drabinka play-off';
  const groupCount = tournament.groups?.length || tournament.groupConfig?.groupCount || 0;
  return `<div class="tournament-flow" aria-label="Przebieg turnieju"><span>${groupCount} ${groupCount === 1 ? 'grupa' : 'grupy'}</span><i aria-hidden="true"></i><span>${Number(tournament.groupConfig?.qualifiersPerGroup) || 1} awansujących z grupy</span><i aria-hidden="true"></i><strong>${finalLabel}</strong></div>`;
}

function renderTournamentFull(tournament) {
  return `<article class="tournament-detail-view"><header class="tournament-detail-header"><div><span class="eyebrow">${escapeHtml(getSportName(tournament.sport))}</span><h2>${escapeHtml(tournament.name)}</h2><p>${escapeHtml(getTournamentFormatLabel(tournament.format))} · ${escapeHtml(getTournamentStatusLabel(tournament.status))}</p></div><div class="tournament-meta"><span>${escapeHtml(getTournamentDateLabel(tournament))}</span><span>${tournament.participantIds?.length || tournament.participants?.length || 0} uczestników</span><span>${tournament.allowDraws ? 'Remis 1:1 dozwolony' : 'Bez remisów'}</span></div></header><section class="tournament-overview-grid"><div><span class="eyebrow">System rozgrywek</span><h3>Etapy turnieju</h3>${renderTournamentStageRoadmap(tournament)}</div><div><span class="eyebrow">Zgłoszeni</span><h3>Uczestnicy</h3>${renderTournamentParticipants(tournament)}</div></section>${renderTournamentFlow(tournament)}${renderTournamentGroups(tournament)}${renderTournamentBracket(tournament)}<section class="tournament-stage"><div class="tournament-stage-heading"><div><span class="eyebrow">Podsumowanie</span><h3>Klasyfikacja końcowa</h3></div></div>${renderTournamentClassification(tournament)}</section></article>`;
}

function renderTournamentSummary(tournament) {
  const matches = getTournamentMatches(tournament);
  const completedMatches = matches.filter(match => match.status === 'completed').length;
  const stageLabel = (tournament.stages || []).map(stage => getTournamentStageTypeLabel(stage.type)).join(' + ');
  return `<article class="tournament-summary"><div class="tournament-summary-header"><div><span class="eyebrow">${escapeHtml(getSportName(tournament.sport))}</span><h3>${escapeHtml(tournament.name)}</h3></div><span class="tournament-status tournament-status-${escapeHtml(tournament.status)}">${escapeHtml(getTournamentStatusLabel(tournament.status))}</span></div><p class="tournament-card-date">${escapeHtml(getTournamentDateLabel(tournament))}</p><div class="tournament-summary-meta"><span>${escapeHtml(stageLabel || getTournamentFormatLabel(tournament.format))}</span><span>${tournament.participantIds?.length || tournament.participants?.length || 0} uczestników</span><span>${completedMatches} rozegranych meczów</span><span>${matches.length} w terminarzu</span></div><a class="button button-alt compact-button" href="turniej.html?id=${encodeURIComponent(tournament.id)}">Otwórz turniej</a></article>`;
}

function renderTournamentCardList(tournaments) {
  return tournaments.length
    ? `<div class="tournament-summary-list">${tournaments.map(renderTournamentSummary).join('')}</div>`
    : '<p class="empty-state">Brak opublikowanych turniejów dla wybranych filtrów.</p>';
}

function renderTournamentSections() {
  const tournaments = getPublicTournaments();
  if (!tournaments.length) return '';
  return `<section class="rankings-section"><div class="section-lead"><span class="eyebrow">Turnieje</span><h2>Końcowe klasyfikacje</h2><p>Pełne grupy, wyniki i drabinki są dostępne w szczegółach każdego turnieju.</p></div>${renderTournamentCardList(tournaments)}</section>`;
}

function renderSportTournaments() {
  const container = document.getElementById('sport-tournaments');
  const sportKey = getSportKey();
  if (!container || !sportKey) return;
  const tournaments = getPublicTournaments({ sport: sportKey });
  container.innerHTML = `${renderTournamentCardList(tournaments)}${tournaments.length ? '<a class="button button-alt compact-button tournament-list-link" href="turnieje.html">Wszystkie turnieje</a>' : ''}`;
}

function renderHomeTournaments() {
  const container = document.getElementById('home-tournaments');
  const section = document.getElementById('home-tournaments-section');
  if (!container) return;
  const tournaments = getPublicTournaments();
  if (!tournaments.length) {
    if (section) section.hidden = true;
    return;
  }
  container.innerHTML = renderTournamentCardList(tournaments);
}

function renderTournamentDetailPage() {
  const container = document.getElementById('tournament-detail');
  if (!container) return;
  const tournamentId = new URLSearchParams(window.location.search).get('id');
  const tournament = getPublicTournaments().find(item => String(item.id) === String(tournamentId));
  if (!tournament) {
    container.innerHTML = '<section class="page-intro"><span class="eyebrow">Turniej</span><h2>Nie znaleziono turnieju</h2><p>Wydarzenie nie istnieje albo nie zostało jeszcze opublikowane.</p><a class="button compact-button" href="turnieje.html">Wróć do turniejów</a></section>';
    return;
  }
  document.title = `${tournament.name} | Liga LGBT`;
  container.innerHTML = renderTournamentFull(tournament);
}

function renderPublicTournamentsPage() {
  const container = document.getElementById('public-tournaments');
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  const sports = Object.keys(leagueData.sports);
  const sport = sports.includes(params.get('sport')) ? params.get('sport') : '';
  const seasons = getPublicCompetitionSeasons(sport)
    .filter(season => getPublicTournaments({ sport, season }).length);
  const season = seasons.includes(params.get('season')) ? params.get('season') : '';
  const tournaments = getPublicTournaments({ sport, season });
  container.innerHTML = `<section class="page-intro"><span class="eyebrow">Turnieje</span><h2>Opublikowane wydarzenia</h2><p>Każdy turniej ma osobną stronę z uczestnikami, etapami, wynikami i drabinką.</p></section><form class="public-results-filters" id="public-tournament-filters"><label>Dyscyplina<select name="sport"><option value="">Wszystkie dyscypliny</option>${getSportOptions(sport)}</select></label><label>Sezon<select name="season"><option value="">Wszystkie sezony</option>${seasons.map(item => `<option value="${escapeHtml(item)}" ${item === season ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label></form><section class="public-results-block"><div class="section-lead"><span class="eyebrow">Lista</span><h2>${sport ? escapeHtml(getSportName(sport)) : 'Wszystkie dyscypliny'}</h2><p>${tournaments.length} ${tournaments.length === 1 ? 'opublikowany turniej' : 'opublikowanych turniejów'}.</p></div>${renderTournamentCardList(tournaments)}</section>`;
  const form = container.querySelector('#public-tournament-filters');
  form.addEventListener('change', () => {
    const nextParams = new URLSearchParams();
    const nextSport = form.elements.namedItem('sport').value;
    const availableSeasons = getPublicCompetitionSeasons(nextSport)
      .filter(item => getPublicTournaments({ sport: nextSport, season: item }).length);
    const requestedSeason = form.elements.namedItem('season').value;
    const nextSeason = availableSeasons.includes(requestedSeason) ? requestedSeason : '';
    if (nextSport) nextParams.set('sport', nextSport);
    if (nextSeason) nextParams.set('season', nextSeason);
    window.history.replaceState(null, '', `${window.location.pathname}${nextParams.toString() ? `?${nextParams}` : ''}`);
    renderPublicTournamentsPage();
  });
}

function saveAndRefreshAdmin(message) {
  renderAdminDashboard();
  renderAdminStandings();
  renderAdminTeams();
  renderAdminClubTeams();
  renderAdminPlayers();
  renderAdminResults();
  renderAdminTournaments();
  renderAdminTournamentManagement();
  if (!message) return;
  saveLeagueData(leagueData)
    .then(result => {
      const suffix = result.remote ? ' Zmiana jest już widoczna dla wszystkich.' : ' Zapisano lokalnie.';
      showToast(message + suffix, result.remote ? 'success' : 'warning');
    })
    .catch(error => {
      console.error('Nie udało się zapisać wspólnych danych ligi.', error);
      showToast('Nie udało się zapisać zmiany w bazie. Sprawdź połączenie i zalogowanie.', 'error', 6000);
    });
}

function syncClubName(oldName, newName) {
  if (!oldName || oldName === newName) return;
  leagueData.clubTeams.forEach(team => { if (team.club === oldName) team.club = newName; });
  leagueData.players.forEach(player => { if (player.club === oldName) player.club = newName; });
  Object.values(leagueData.sports).forEach(sport => {
    sport.results.forEach(match => {
      if (match.home === oldName) match.home = newName;
      if (match.away === oldName) match.away = newName;
    });
  });
  leagueData.tournaments.forEach(tournament => tournament.finalClassification.forEach(row => {
    if (row.club === oldName) row.club = newName;
  }));
}

function syncParticipantName(oldName, newName) {
  if (!oldName || oldName === newName) return;
  Object.values(leagueData.sports).forEach(sport => {
    sport.results.forEach(match => {
      if (match.home === oldName) match.home = newName;
      if (match.away === oldName) match.away = newName;
    });
  });
}

function syncPlayerName(oldName, newName) {
  if (!oldName || !newName) return;
  leagueData.clubTeams.forEach(team => {
    team.roster = (team.roster || []).map(player => player === oldName ? newName : player);
  });
  Object.values(leagueData.sports).forEach(sport => {
    sport.results.forEach(match => {
      if (match.mvp === oldName) match.mvp = newName;
      if (match.home === oldName) match.home = newName;
      if (match.away === oldName) match.away = newName;
    });
  });
  const playerClub = getPlayerByName(newName)?.club || '';
  leagueData.tournaments.forEach(tournament => {
    tournament.participants = (tournament.participants || []).map(name => name === oldName ? newName : name);
    tournament.finalClassification.forEach(row => {
      if (row.participant === oldName) {
        row.participant = newName;
        row.club = playerClub || row.club;
      }
    });
    tournament.bracket.forEach(match => {
      if (match.home === oldName) match.home = newName;
      if (match.away === oldName) match.away = newName;
    });
  });
}

function removeParticipantReferences(name) {
  Object.values(leagueData.sports).forEach(sport => {
    sport.results = sport.results.filter(match => match.home !== name && match.away !== name);
  });
}

function removePlayerReferences(name) {
  leagueData.clubTeams.forEach(team => {
    team.roster = (team.roster || []).filter(player => player !== name);
  });
  Object.values(leagueData.sports).forEach(sport => {
    if (sport.type === 'individual') {
      sport.results = sport.results.filter(match => match.home !== name && match.away !== name);
    }
    sport.results.forEach(match => {
      if (match.mvp === name) match.mvp = '';
    });
  });
  leagueData.tournaments.forEach(tournament => {
    tournament.participants = (tournament.participants || []).filter(participant => participant !== name);
    tournament.finalClassification = tournament.finalClassification.filter(row => row.participant !== name);
    tournament.bracket = tournament.bracket.filter(match => match.home !== name && match.away !== name);
  });
}

function parseClassificationText(value) {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [place, participant, club] = line.split('|').map(item => item.trim());
      return { place: Number(place) || place || '', participant: participant || '', club: club || '' };
    })
    .filter(row => row.participant);
}

function stringifyClassification(rows) {
  return (rows || []).map(row => `${row.place}|${row.participant}`).join('\n');
}

function parseBracketText(value) {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [round, home, score, away] = line.split('|').map(item => item.trim());
      return { round: round || '', home: home || '', score: score || '', away: away || '' };
    })
    .filter(match => match.round && match.home && match.score && match.away);
}

function stringifyBracket(rows) {
  return (rows || []).map(match => `${match.round}|${match.home}|${match.score}|${match.away}`).join('\n');
}

function renderAdminDashboard() {
  const resultsCount = Object.values(leagueData.sports).reduce((sum, sport) => sum + sport.results.length, 0);
  const fields = {
    'admin-teams-count': leagueData.teams.length,
    'admin-entries-count': leagueData.clubTeams.length,
    'admin-results-count': resultsCount,
    'admin-players-count': leagueData.players.length,
    'admin-tournaments-count': leagueData.tournaments.length
  };
  Object.entries(fields).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  });
}

function initAdminNavigation() {
  const navigation = document.getElementById('admin-navigation');
  const toggle = document.getElementById('admin-nav-toggle');
  if (!navigation) return;
  const page = document.body.dataset.page || document.documentElement.dataset.page;
  const activePage = page === 'admin-tournament' ? 'admin-tournaments' : page;
  navigation.querySelectorAll('[data-admin-page]').forEach(link => {
    if (link.dataset.adminPage === activePage) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const isOpen = navigation.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  navigation.addEventListener('click', event => {
    if (!event.target.closest('a')) return;
    navigation.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  });
}

function renderAdminStandings() {
  const container = document.getElementById('admin-standings-preview');
  if (!container) return;
  container.innerHTML = Object.keys(leagueData.sports).map(key => `<section class="admin-table-block" data-admin-standings-sport="${escapeHtml(key)}"><div class="admin-list-toolbar"><div><span class="eyebrow">Dyscyplina</span><h4>${escapeHtml(getSportName(key))}</h4></div></div>${renderLevelStandingsSections(key)}</section>`).join('');
  bindStandingsSorting(container, renderAdminStandings);
}

function renderAdminTeams() {
  const editor = document.getElementById('team-editor');
  if (!editor) return;
  const sortedClubs = sortClubs(leagueData.teams);
  editor.innerHTML = `<form id="team-form" class="admin-form"><input type="hidden" name="id" /><fieldset><legend>Dodaj lub edytuj klub</legend><div class="admin-form-grid"><label>Nazwa klubu<input type="text" name="name" required /></label><label>Miasto<input type="text" name="city" required /></label><label>Logo URL<input type="url" name="logo" placeholder="https://" /></label></div><label>Opis<textarea name="description" required></textarea></label><div class="admin-actions"><button type="submit">Zapisz klub</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form><div class="admin-table-block"><h4>Kluby</h4><table><thead><tr><th>#</th><th>Logo</th><th>Nazwa</th><th>Miasto</th><th>Opis</th><th>Akcje</th></tr></thead><tbody>${sortedClubs.map((team, index) => `<tr><td>${index + 1}</td><td>${renderLogo(team.name)}</td><td>${escapeHtml(team.name)}</td><td>${escapeHtml(team.city)}</td><td>${escapeHtml(team.description)}</td><td><div class="table-actions"><button type="button" class="compact-button edit-team" data-id="${team.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-team" data-id="${team.id}">Usuń</button></div></td></tr>`).join('')}</tbody></table></div>`;
  const form = editor.querySelector('#team-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = Number(data.get('id'));
    const payload = { name: data.get('name').toString().trim(), city: data.get('city').toString().trim(), logo: data.get('logo').toString().trim(), description: data.get('description').toString().trim() };
    if (!payload.name || !payload.city || !payload.description) return showToast('Uzupełnij nazwę, miasto i opis klubu.', 'error');
    const existing = leagueData.teams.find(team => team.id === id);
    if (existing) {
      const oldName = existing.name;
      Object.assign(existing, payload);
      syncClubName(oldName, payload.name);
      saveAndRefreshAdmin('Klub został zaktualizowany.');
    } else {
      leagueData.teams.push({ id: Math.max(0, ...leagueData.teams.map(team => team.id)) + 1, ...payload });
      saveAndRefreshAdmin('Dodano klub.');
    }
  });
  editor.querySelectorAll('.edit-team').forEach(button => button.addEventListener('click', () => {
    const team = leagueData.teams.find(item => item.id === Number(button.dataset.id));
    if (!team) return;
    form.id.value = team.id; form.name.value = team.name; form.city.value = team.city; form.logo.value = team.logo || ''; form.description.value = team.description;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  editor.querySelectorAll('.delete-team').forEach(button => button.addEventListener('click', () => {
    const removed = leagueData.teams.find(team => team.id === Number(button.dataset.id));
    leagueData.teams = leagueData.teams.filter(team => team.id !== Number(button.dataset.id));
    if (removed) {
      leagueData.clubTeams.filter(team => team.club === removed.name).forEach(team => removeParticipantReferences(team.name));
      leagueData.players.filter(player => player.club === removed.name).forEach(player => removePlayerReferences(player.name));
      leagueData.clubTeams = leagueData.clubTeams.filter(team => team.club !== removed.name);
      leagueData.players = leagueData.players.filter(player => player.club !== removed.name);
    }
    saveAndRefreshAdmin('Klub został usunięty.');
  }));
}

function renderAdminClubTeams() {
  const editor = document.getElementById('club-team-editor');
  if (!editor) return;
  const sortedTeams = sortClubTeams(leagueData.clubTeams, adminTeamSort);
  editor.innerHTML = `<form id="club-team-form" class="admin-form"><input type="hidden" name="id" /><fieldset><legend>Dodaj lub edytuj drużynę uczestniczącą</legend><div class="admin-form-grid"><label>Nazwa drużyny<input type="text" name="name" required placeholder="np. Orion Poznań B" /></label><label>Klub<select name="club" required>${getClubOptions()}</select></label><label>Dyscyplina<select name="sport" required>${getSportOptions('siatkowka', 'team')}</select></label><label>Poziom<select name="level"></select></label></div><label>Opis drużyny<textarea name="description" placeholder="Opcjonalnie: opis tej konkretnej drużyny, nie opis całego klubu."></textarea></label><label>Skład drużyny<select name="roster" multiple size="6"></select></label><p class="form-hint">Lista składu zawiera wyłącznie zawodników tego klubu, którzy mają przypisaną wybraną dyscyplinę.</p><div id="club-team-roster-preview" class="admin-roster-preview"></div><div class="admin-actions"><button type="submit">Zapisz drużynę</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form><div class="admin-table-block"><div class="admin-list-toolbar"><div><h4>Drużyny uczestniczące</h4><p>${sortedTeams.length} drużyn</p></div><label>Sortowanie<select id="club-team-sort"><option value="name" ${adminTeamSort === 'name' ? 'selected' : ''}>Nazwa</option><option value="club" ${adminTeamSort === 'club' ? 'selected' : ''}>Klub</option><option value="sport" ${adminTeamSort === 'sport' ? 'selected' : ''}>Dyscyplina</option><option value="level" ${adminTeamSort === 'level' ? 'selected' : ''}>Poziom</option></select></label></div><table><thead><tr><th>#</th><th>Logo</th><th>Drużyna</th><th>Klub</th><th>Dyscyplina</th><th>Poziom</th><th>Skład</th><th>Opis</th><th>Akcje</th></tr></thead><tbody>${sortedTeams.map((team, index) => `<tr><td>${index + 1}</td><td>${renderLogo(team.name)}</td><td>${escapeHtml(team.name)}</td><td>${escapeHtml(team.club)}</td><td>${escapeHtml(getSportName(team.sport))}</td><td>${escapeHtml(team.level || '-')}</td><td>${renderRosterSection(getTeamRosterNames(team), { compact: true, headingTag: 'strong' })}</td><td>${escapeHtml(team.description || '-')}</td><td><div class="table-actions"><button type="button" class="compact-button edit-club-team" data-id="${team.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-club-team" data-id="${team.id}">Usuń</button></div></td></tr>`).join('')}</tbody></table></div>`;
  const form = editor.querySelector('#club-team-form');
  const rosterPreview = editor.querySelector('#club-team-roster-preview');
  editor.querySelector('#club-team-sort').addEventListener('change', event => {
    adminTeamSort = event.target.value;
    renderAdminClubTeams();
  });
  function refreshRosterOptions(selected = []) {
    form.roster.innerHTML = getRosterSelectOptions(form.club.value, form.sport.value, selected);
    renderRosterPreview();
  }
  function getSelectedRosterNames() {
    return [...form.roster.selectedOptions].map(option => option.value);
  }
  function renderRosterPreview() {
    rosterPreview.innerHTML = renderRosterSection(getSelectedRosterNames(), { compact: true });
  }
  function refreshClubTeamLevelOptions(selected = '') {
    form.level.innerHTML = getLevelOptions(form.sport.value, selected, true);
  }
  refreshClubTeamLevelOptions();
  refreshRosterOptions();
  form.club.addEventListener('change', () => refreshRosterOptions());
  form.sport.addEventListener('change', () => {
    form.level.value = '';
    refreshClubTeamLevelOptions();
    refreshRosterOptions();
  });
  form.roster.addEventListener('change', renderRosterPreview);
  form.addEventListener('reset', () => {
    setTimeout(() => {
      refreshClubTeamLevelOptions();
      refreshRosterOptions();
    });
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = Number(data.get('id'));
    const payload = { name: data.get('name').toString().trim(), club: data.get('club').toString(), sport: data.get('sport').toString(), level: data.get('level').toString().trim(), description: data.get('description').toString().trim(), roster: getSortedRosterNames(data.getAll('roster').map(item => item.toString())) };
    if (!payload.name || !payload.club || !payload.sport) return showToast('Uzupełnij nazwę drużyny, klub i dyscyplinę.', 'error');
    const existing = leagueData.clubTeams.find(team => team.id === id);
    if (existing) {
      const oldName = existing.name;
      Object.assign(existing, payload);
      syncParticipantName(oldName, payload.name);
      saveAndRefreshAdmin('Drużyna została zaktualizowana.');
    } else {
      leagueData.clubTeams.push({ id: Math.max(0, ...leagueData.clubTeams.map(team => team.id)) + 1, ...payload });
      saveAndRefreshAdmin('Dodano drużynę.');
    }
  });
  editor.querySelectorAll('.edit-club-team').forEach(button => button.addEventListener('click', () => {
    const team = leagueData.clubTeams.find(item => item.id === Number(button.dataset.id));
    if (!team) return;
    form.id.value = team.id; form.name.value = team.name; form.club.value = team.club; form.sport.value = team.sport; refreshClubTeamLevelOptions(team.level || ''); form.description.value = team.description || ''; refreshRosterOptions(team.roster || []);
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  editor.querySelectorAll('.delete-club-team').forEach(button => button.addEventListener('click', () => {
    const removed = leagueData.clubTeams.find(team => team.id === Number(button.dataset.id));
    leagueData.clubTeams = leagueData.clubTeams.filter(team => team.id !== Number(button.dataset.id));
    if (removed) removeParticipantReferences(removed.name);
    saveAndRefreshAdmin('Drużyna została usunięta.');
  }));
}

function renderAdminPlayers() {
  const editor = document.getElementById('players-editor');
  if (!editor) return;
  const clubFilterOptions = sortClubs(leagueData.teams)
    .map(club => `<option value="${escapeHtml(club.name)}">${escapeHtml(club.name)}</option>`)
    .join('');
  const sportFilterOptions = stableSort(Object.keys(leagueData.sports), (left, right) => (
    comparePolish(getSportName(left), getSportName(right))
  )).map(sportKey => `<option value="${escapeHtml(sportKey)}">${escapeHtml(getSportName(sportKey))}</option>`).join('');
  const teamFilterOptions = sortClubTeams(leagueData.clubTeams)
    .map(team => `<option value="${escapeHtml(team.name)}">${escapeHtml(team.name)} (${escapeHtml(team.club)})</option>`)
    .join('');
  editor.innerHTML = `<form id="player-form" class="admin-form"><input type="hidden" name="id" /><fieldset><legend>Dodaj lub edytuj zawodnika</legend><div class="admin-form-grid"><label>Zawodnik<input type="text" name="name" required /></label><label>Klub<select name="club" required>${getClubOptions()}</select></label><div class="admin-field-group"><span>Dyscypliny</span>${renderSportChoices()}</div><label>Drużyny<select name="teams" multiple size="5"></select></label></div><label>Opis zawodnika<textarea name="bio" placeholder="Krótki opis profilu, stylu gry albo roli w klubie."></textarea></label><p class="form-hint">Lista drużyn uwzględnia wybrany klub i dyscypliny zawodnika. Usunięcie dyscypliny automatycznie usuwa zawodnika ze składów tego sportu.</p><div class="admin-actions"><button type="submit">Zapisz zawodnika</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form><section class="admin-table-block player-directory" aria-labelledby="player-directory-title"><div class="player-directory-heading"><div><h4 id="player-directory-title">Spis zawodników</h4><p>Filtry można łączyć. Numeracja jest liczona po filtrowaniu i sortowaniu.</p></div><button id="player-filters-clear" class="button-secondary compact-button" type="button">Wyczyść filtry</button></div><div class="player-filter-grid"><label>Wyszukaj<input id="player-search" type="search" autocomplete="off" placeholder="Imię lub nazwisko" value="${escapeHtml(adminPlayerListState.search)}" /></label><label>Klub<select id="player-club-filter"><option value="">Wszystkie kluby</option>${clubFilterOptions}</select></label><label>Dyscyplina<select id="player-sport-filter"><option value="">Wszystkie dyscypliny</option>${sportFilterOptions}</select></label><label>Drużyna<select id="player-team-filter"><option value="">Wszystkie drużyny</option>${teamFilterOptions}</select></label><label>Sortowanie<select id="player-sort"><option value="surname">Nazwisko</option><option value="club">Klub</option><option value="sport">Dyscyplina</option><option value="teamCount">Liczba drużyn</option></select></label><label>Kierunek<select id="player-sort-direction"><option value="asc">Rosnąco</option><option value="desc">Malejąco</option></select></label></div><div class="player-list-summary"><div><span>Wszyscy</span><strong id="player-total-count">${leagueData.players.length}</strong></div><div><span>Widoczni</span><strong id="player-visible-count">0</strong></div></div><div id="player-group-counts" class="player-group-counts" aria-live="polite"></div><div class="player-table-scroll"><table class="player-admin-table"><thead><tr><th>#</th><th>Nazwisko i imię</th><th>Klub</th><th>Dyscypliny</th><th>Drużyny</th><th>Akcje</th></tr></thead><tbody id="player-table-body"></tbody></table></div></section>`;
  const form = editor.querySelector('#player-form');
  const listControls = {
    search: editor.querySelector('#player-search'),
    club: editor.querySelector('#player-club-filter'),
    sport: editor.querySelector('#player-sport-filter'),
    team: editor.querySelector('#player-team-filter'),
    sortBy: editor.querySelector('#player-sort'),
    direction: editor.querySelector('#player-sort-direction')
  };
  const tableBody = editor.querySelector('#player-table-body');
  const visibleCount = editor.querySelector('#player-visible-count');
  const groupCounts = editor.querySelector('#player-group-counts');

  Object.entries(listControls).forEach(([key, control]) => {
    control.value = adminPlayerListState[key] || '';
  });

  function getSelectedSports() {
    return [...form.querySelectorAll('input[name="sports"]:checked')].map(input => input.value);
  }
  function getSelectedTeams() {
    return [...form.teams.selectedOptions].map(option => option.value);
  }
  function refreshPlayerTeamOptions(selected = []) {
    form.teams.innerHTML = getTeamSelectOptions(form.club.value, getSelectedSports(), selected);
  }

  function editPlayer(playerId) {
    const player = leagueData.players.find(item => item.id === playerId);
    if (!player) return;
    form.id.value = player.id;
    form.name.value = player.name;
    form.club.value = player.club;
    form.bio.value = player.bio || '';
    form.querySelectorAll('input[name="sports"]').forEach(input => {
      input.checked = (player.sports || []).includes(input.value);
    });
    refreshPlayerTeamOptions(getPlayerTeamNames(player.name));
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderPlayerList() {
    const visiblePlayers = filterAndSortPlayers(leagueData.players, adminPlayerListState);
    const groups = getPlayerListGroupCounts(visiblePlayers, adminPlayerListState.sortBy);
    visibleCount.textContent = visiblePlayers.length;
    groupCounts.innerHTML = groups.length
      ? groups.map(group => `<span><strong>${group.count}</strong> ${escapeHtml(group.label)}</span>`).join('')
      : '<span>Brak grup dla wybranych filtrów</span>';
    if (!visiblePlayers.length) {
      tableBody.innerHTML = '<tr><td colspan="6"><p class="empty-state">Brak zawodników spełniających wybrane kryteria.</p></td></tr>';
      return;
    }
    let previousGroup = '';
    tableBody.innerHTML = visiblePlayers.map((player, index) => {
      const groupLabel = getPlayerListGroupLabel(player, adminPlayerListState.sortBy);
      const groupCount = groups.find(group => group.label === groupLabel)?.count || 0;
      const groupRow = groupLabel !== previousGroup
        ? `<tr class="player-group-row"><th colspan="6">${escapeHtml(groupLabel)} <span>${groupCount}</span></th></tr>`
        : '';
      previousGroup = groupLabel;
      const teams = getPlayerTeamNames(player.name);
      return `${groupRow}<tr><td>${index + 1}</td><td><strong>${escapeHtml(getPersonSortKey(player.name))}</strong></td><td><div class="player-club-cell">${renderLogo(player.club)}<span>${escapeHtml(player.club)}</span></div></td><td>${escapeHtml(getPlayerSportsLabel(player) || '-')}</td><td>${escapeHtml(teams.join(', ') || '-')}</td><td><div class="table-actions"><button type="button" class="compact-button" data-player-action="edit" data-id="${player.id}">Edytuj</button><button type="button" class="compact-button danger-button" data-player-action="delete" data-id="${player.id}">Usuń</button></div></td></tr>`;
    }).join('');
  }

  function updatePlayerListState() {
    Object.entries(listControls).forEach(([key, control]) => {
      adminPlayerListState[key] = control.value;
    });
    renderPlayerList();
  }

  refreshPlayerTeamOptions();
  renderPlayerList();
  form.club.addEventListener('change', () => refreshPlayerTeamOptions());
  form.querySelectorAll('input[name="sports"]').forEach(input => input.addEventListener('change', () => {
    refreshPlayerTeamOptions(getSelectedTeams());
  }));
  listControls.search.addEventListener('input', updatePlayerListState);
  ['club', 'sport', 'team', 'sortBy', 'direction'].forEach(key => {
    listControls[key].addEventListener('change', updatePlayerListState);
  });
  editor.querySelector('#player-filters-clear').addEventListener('click', () => {
    Object.assign(adminPlayerListState, {
      search: '',
      club: '',
      sport: '',
      team: '',
      sortBy: 'surname',
      direction: 'asc'
    });
    Object.entries(listControls).forEach(([key, control]) => {
      control.value = adminPlayerListState[key];
    });
    renderPlayerList();
    listControls.search.focus();
  });
  form.addEventListener('reset', () => {
    setTimeout(() => refreshPlayerTeamOptions());
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = Number(data.get('id'));
    const payload = { name: data.get('name').toString().trim(), club: data.get('club').toString(), sports: data.getAll('sports').map(item => item.toString()), bio: data.get('bio').toString().trim() };
    const teams = data.getAll('teams').map(item => item.toString());
    if (!payload.name || !payload.club) return showToast('Uzupełnij zawodnika i klub.', 'error');
    if (!payload.sports.length) return showToast('Wybierz co najmniej jedną dyscyplinę zawodnika.', 'warning');
    const existing = leagueData.players.find(player => player.id === id);
    if (existing) {
      const blockedSports = getBlockedPlayerSportRemovals(existing, payload.sports);
      if (blockedSports.length) {
        return showToast(`Nie można usunąć dyscypliny z zapisanymi wynikami lub turniejami: ${blockedSports.map(getSportName).join(', ')}.`, 'warning', 6000);
      }
      const oldName = existing.name;
      Object.assign(existing, payload);
      syncPlayerName(oldName, payload.name);
      setPlayerTeams(payload.name, payload.sports, teams);
      saveAndRefreshAdmin('Zawodnik został zaktualizowany.');
    } else {
      leagueData.players.push({ id: Math.max(0, ...leagueData.players.map(player => player.id)) + 1, ...payload });
      setPlayerTeams(payload.name, payload.sports, teams);
      saveAndRefreshAdmin('Dodano zawodnika.');
    }
  });
  tableBody.addEventListener('click', event => {
    const button = event.target.closest('[data-player-action]');
    if (!button) return;
    const playerId = Number(button.dataset.id);
    if (button.dataset.playerAction === 'edit') {
      editPlayer(playerId);
      return;
    }
    const removed = leagueData.players.find(player => player.id === playerId);
    leagueData.players = leagueData.players.filter(player => player.id !== playerId);
    if (removed) removePlayerReferences(removed.name);
    saveAndRefreshAdmin('Zawodnik został usunięty.');
  });
}

function getUndatedMatches() {
  return stableSort(
    (leagueData.matches || [])
      .filter(match => (
        !match.scheduledAt
        && !['bye', 'cancelled'].includes(match.status)
        && getMatchCompetitionContext(match).competition
      ))
      .map(match => {
        const { competition, stage } = getMatchCompetitionContext(match);
        return { match, competition, stage };
      }),
    (left, right) => (
      comparePolish(left.competition.kind, right.competition.kind)
      || comparePolish(left.competition.name, right.competition.name)
      || (Number(left.stage?.order) || 0) - (Number(right.stage?.order) || 0)
      || comparePolish(left.match.home, right.match.home)
    )
  );
}

function renderUndatedMatchesAdmin() {
  const entries = getUndatedMatches();
  const rows = entries.map(({ match, competition, stage }) => {
    const context = competition.kind === 'league'
      ? [stage?.level ? `Poziom ${stage.level}` : '', match.roundLabel].filter(Boolean).join(' · ')
      : [stage?.name, match.roundLabel].filter(Boolean).join(' · ');
    const action = competition.kind === 'league'
      ? `<button type="button" class="compact-button edit-schedule-match" data-match="${escapeHtml(match.id)}">Uzupełnij datę</button>`
      : `<a class="compact-button" href="admin-turniej.html?id=${encodeURIComponent(competition.id)}">Zarządzaj turniejem</a>`;
    return `<li><div><span class="eyebrow">${competition.kind === 'league' ? 'Liga' : 'Turniej'} · ${escapeHtml(getSportName(competition.sport))}</span><strong>${escapeHtml(competition.name)}</strong><small>${escapeHtml(context || 'Etap bez nazwy')}</small></div><p>${escapeHtml(match.home || 'Do ustalenia')} <b>vs</b> ${escapeHtml(match.away || 'Do ustalenia')}</p>${action}</li>`;
  }).join('');
  return `<section class="admin-undated-matches"><div class="admin-list-toolbar"><div><h4>Mecze bez daty</h4><p>${entries.length} ${entries.length === 1 ? 'mecz wymaga' : 'meczów wymaga'} uzupełnienia przed publikacją w kalendarzu.</p></div><span class="admin-undated-count">${entries.length}</span></div>${entries.length ? `<ol>${rows}</ol>` : '<p class="empty-state">Wszystkie aktywne mecze mają przypisany termin.</p>'}</section>`;
}

function renderAdminResults() {
  const editor = document.getElementById('results-editor');
  if (!editor) return;
  const preferences = getAdminResultPreferences();
  const selectedTournament = leagueData.tournaments.find(tournament => (
    String(tournament.id) === String(preferences.tournament)
  ));
  if (selectedTournament) {
    preferences.sport = selectedTournament.sport;
    preferences.competition = 'tournament';
  }
  if (!leagueData.sports[preferences.sport]) {
    preferences.sport = Object.keys(leagueData.sports)[0] || '';
  }

  const leagueMatches = stableSort(
    (leagueData.matches || []).filter(match => getMatchCompetitionContext(match).competition?.kind === 'league'),
    (left, right) => (Date.parse(right.scheduledAt || '') || 0) - (Date.parse(left.scheduledAt || '') || 0)
  );
  const scheduleRows = leagueMatches.map(match => {
    const { competition, stage } = getMatchCompetitionContext(match);
    const completed = match.status === 'completed';
    return `<tr><td>${escapeHtml(getSportName(competition.sport))}</td><td>${escapeHtml(competition.season)}</td><td>${escapeHtml(stage.level || '–')}</td><td>${match.roundNumber || '–'}</td><td>${escapeHtml(formatAdminMatchDate(match.scheduledAt))}</td><td>${escapeHtml(match.home)}</td><td>${escapeHtml(match.away)}</td><td>${escapeHtml(match.venue || '–')}</td><td><span class="match-status match-status-${completed ? 'completed' : 'scheduled'}">${completed ? 'Rozegrany' : 'Zaplanowany'}</span></td><td><div class="table-actions"><button type="button" class="compact-button edit-schedule-match" data-match="${escapeHtml(match.id)}">Edytuj</button><button type="button" class="compact-button danger-button delete-schedule-match" data-match="${escapeHtml(match.id)}">Usuń</button></div></td></tr>`;
  }).join('');
  const leagueResultRows = leagueMatches.map(match => {
    const { competition, stage } = getMatchCompetitionContext(match);
    const completed = match.status === 'completed';
    return `<tr><td>${escapeHtml(getSportName(competition.sport))}</td><td>${escapeHtml(stage.level || '–')}</td><td>${escapeHtml(formatAdminMatchDate(match.scheduledAt))}</td><td>${escapeHtml(match.home)}</td><td><strong>${completed ? escapeHtml(deriveScore(match)) : '–'}</strong></td><td>${escapeHtml(match.away)}</td><td>${escapeHtml(match.mvp || '–')}</td><td><div class="table-actions"><button type="button" class="compact-button edit-existing-result" data-kind="league" data-sport="${escapeHtml(competition.sport)}" data-level="${escapeHtml(stage.level || '')}" data-match="${escapeHtml(match.id)}">${completed ? 'Edytuj wynik' : 'Wpisz wynik'}</button>${completed ? `<button type="button" class="compact-button danger-button clear-existing-result" data-kind="league" data-match="${escapeHtml(match.id)}">Wyczyść</button>` : ''}</div></td></tr>`;
  }).join('');
  const tournamentRows = sortTournaments(leagueData.tournaments).flatMap(tournament => (
    getTournamentPhaseEntries(tournament).flatMap(phase => (
      phase.matches.map(match => {
        const completed = match.status === 'completed';
        const canEdit = match.status !== 'bye' && match.home && match.away;
        return `<tr><td>${escapeHtml(tournament.name)}</td><td>${escapeHtml(getSportName(tournament.sport))}</td><td>${escapeHtml(phase.label)}</td><td>${escapeHtml(formatAdminMatchDate(match.scheduledAt))}</td><td>${escapeHtml(match.home || 'Do ustalenia')}</td><td><strong>${completed ? escapeHtml(deriveScore(match)) : '–'}</strong></td><td>${escapeHtml(match.away || 'Do ustalenia')}</td><td>${escapeHtml(match.mvp || '–')}</td><td><div class="table-actions">${canEdit ? `<button type="button" class="compact-button edit-existing-result" data-kind="tournament" data-sport="${escapeHtml(tournament.sport)}" data-tournament="${escapeHtml(tournament.id)}" data-phase="${escapeHtml(phase.key)}" data-match="${escapeHtml(match.id)}">${completed ? 'Edytuj wynik' : 'Wpisz wynik'}</button>` : ''}${completed ? `<button type="button" class="compact-button danger-button clear-existing-result" data-kind="tournament" data-tournament="${escapeHtml(tournament.id)}" data-phase="${escapeHtml(phase.key)}" data-match="${escapeHtml(match.id)}">Wyczyść</button>` : ''}</div></td></tr>`;
      })
    ))
  )).join('');

  editor.innerHTML = `<div class="results-workspace"><div class="results-editor-grid"><form id="schedule-form" class="admin-form result-editor-panel"><input type="hidden" name="id" /><fieldset><legend>Dodaj mecz do terminarza ligi</legend><p class="form-hint">Tutaj tworzysz parę, kolejkę i datę. Wynik wpisujesz dopiero w drugim formularzu.</p><div class="admin-form-grid result-form-flow"><label>Dyscyplina<select name="sport" required>${getSportOptions(preferences.sport)}</select></label><label>Sezon<input type="text" name="season" required value="${escapeHtml(String(new Date().getFullYear()))}" inputmode="numeric" /></label><label data-schedule-field="level">Poziom<select name="level"></select></label><label>Kolejka<input type="number" name="roundNumber" min="1" step="1" required value="1" /></label><label>Data i godzina<input type="datetime-local" name="scheduledAt" required /></label><label>Miejsce<input type="text" name="venue" placeholder="np. Hala Centrum" /></label><label>Uczestnik 1<select name="home" required></select></label><label>Uczestnik 2<select name="away" required></select></label></div><p class="result-context-note" id="schedule-context-note"></p><div class="admin-actions"><button type="submit">Zapisz mecz</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form><form id="result-form" class="admin-form result-editor-panel"><fieldset><legend>Wpisz wynik istniejącego meczu</legend><p class="form-hint">Lista zawiera wyłącznie mecze utworzone w terminarzu ligi albo wygenerowane przez turniej.</p><div class="admin-form-grid result-form-flow"><label>Dyscyplina<select name="sport" required>${getSportOptions(preferences.sport)}</select></label><label>Rodzaj rozgrywek<select name="competition" required><option value="league" ${preferences.competition === 'league' ? 'selected' : ''}>Liga</option><option value="tournament" ${preferences.competition === 'tournament' ? 'selected' : ''}>Turniej</option></select></label><label data-result-field="level">Poziom<select name="level"></select></label><label data-result-field="tournament" hidden>Turniej<select name="tournament"></select></label><label data-result-field="phase" hidden>Etap<select name="phase"></select></label><label data-result-field="match">Mecz<select name="match" required></select></label><label>Data meczu<input type="datetime-local" name="matchDate" readonly required /></label><label>Uczestnik 1<select name="home" aria-readonly="true" required></select></label><label>Uczestnik 2<select name="away" aria-readonly="true" required></select></label><label>Format wyniku<select name="score" required></select></label><label>MVP meczu<select name="mvp"><option value="">Brak</option></select></label></div><p class="result-context-note" id="result-context-note"></p><div class="set-fields" id="set-fields"></div><div class="admin-actions"><button type="submit">Zapisz wynik</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form></div><section class="admin-table-block"><div class="admin-list-toolbar"><div><h4>Terminarz ligowy</h4><p>${leagueMatches.length} meczów</p></div></div><div class="admin-table-scroll"><table><thead><tr><th>Dyscyplina</th><th>Sezon</th><th>Poziom</th><th>Kolejka</th><th>Data</th><th>Uczestnik 1</th><th>Uczestnik 2</th><th>Miejsce</th><th>Status</th><th>Akcje</th></tr></thead><tbody>${scheduleRows || '<tr><td colspan="10">Brak meczów w terminarzu ligowym.</td></tr>'}</tbody></table></div></section><section class="admin-table-block"><h4>Wyniki ligowe</h4><div class="admin-table-scroll"><table><thead><tr><th>Dyscyplina</th><th>Poziom</th><th>Data</th><th>Uczestnik 1</th><th>Wynik</th><th>Uczestnik 2</th><th>MVP</th><th>Akcje</th></tr></thead><tbody>${leagueResultRows || '<tr><td colspan="8">Brak meczów ligowych.</td></tr>'}</tbody></table></div></section><section class="admin-table-block"><h4>Wyniki turniejowe</h4><div class="admin-table-scroll"><table><thead><tr><th>Turniej</th><th>Dyscyplina</th><th>Etap</th><th>Data</th><th>Uczestnik 1</th><th>Wynik</th><th>Uczestnik 2</th><th>MVP</th><th>Akcje</th></tr></thead><tbody>${tournamentRows || '<tr><td colspan="9">Brak wygenerowanych meczów turniejowych.</td></tr>'}</tbody></table></div></section></div>`;
  editor.querySelector('.results-editor-grid')
    ?.insertAdjacentHTML('afterend', renderUndatedMatchesAdmin());
  const scheduleForm = editor.querySelector('#schedule-form');
  const scheduleContextNote = editor.querySelector('#schedule-context-note');
  const scheduleFields = {
    id: scheduleForm.elements.namedItem('id'),
    sport: scheduleForm.elements.namedItem('sport'),
    season: scheduleForm.elements.namedItem('season'),
    level: scheduleForm.elements.namedItem('level'),
    roundNumber: scheduleForm.elements.namedItem('roundNumber'),
    scheduledAt: scheduleForm.elements.namedItem('scheduledAt'),
    venue: scheduleForm.elements.namedItem('venue'),
    home: scheduleForm.elements.namedItem('home'),
    away: scheduleForm.elements.namedItem('away')
  };
  const scheduleLevelWrapper = scheduleForm.querySelector('[data-schedule-field="level"]');

  function refreshScheduleParticipants(options = {}) {
    const sport = leagueData.sports[scheduleFields.sport.value];
    const levels = sport?.levels || [];
    scheduleLevelWrapper.hidden = !levels.length;
    scheduleFields.level.required = Boolean(levels.length);
    scheduleFields.level.innerHTML = levels.length
      ? `<option value="">Wybierz poziom</option>${levels.map(level => `<option value="${escapeHtml(level)}" ${level === options.level ? 'selected' : ''}>${escapeHtml(level)}</option>`).join('')}`
      : '<option value="">Bez poziomu</option>';
    if (!levels.length) scheduleFields.level.value = '';
    const participants = getLeagueParticipants(scheduleFields.sport.value, scheduleFields.level.value);
    scheduleFields.home.innerHTML = getFilteredParticipantOptions(participants, options.home || '', options.away || '', 'Wybierz uczestnika 1');
    scheduleFields.away.innerHTML = getFilteredParticipantOptions(participants, options.away || '', scheduleFields.home.value, 'Wybierz uczestnika 2');
    scheduleContextNote.textContent = levels.length
      ? 'Wybierz poziom, aby zobaczyć wyłącznie zapisane do niego drużyny.'
      : 'Lista zawiera wyłącznie zawodników tej dyscypliny.';
  }

  function resetScheduleForm() {
    scheduleFields.id.value = '';
    scheduleFields.sport.value = preferences.sport;
    scheduleFields.season.value = String(new Date().getFullYear());
    scheduleFields.roundNumber.value = '1';
    scheduleFields.scheduledAt.value = '';
    scheduleFields.venue.value = '';
    refreshScheduleParticipants();
  }

  refreshScheduleParticipants({ level: preferences.level });
  scheduleFields.sport.addEventListener('change', () => refreshScheduleParticipants());
  scheduleFields.level.addEventListener('change', () => refreshScheduleParticipants({
    level: scheduleFields.level.value
  }));
  scheduleFields.home.addEventListener('change', () => {
    const participants = getLeagueParticipants(scheduleFields.sport.value, scheduleFields.level.value);
    const away = scheduleFields.away.value === scheduleFields.home.value ? '' : scheduleFields.away.value;
    scheduleFields.away.innerHTML = getFilteredParticipantOptions(participants, away, scheduleFields.home.value, 'Wybierz uczestnika 2');
  });
  scheduleForm.addEventListener('reset', () => setTimeout(resetScheduleForm));
  scheduleForm.addEventListener('submit', event => {
    event.preventDefault();
    const result = saveLeagueScheduleEntry({
      id: scheduleFields.id.value,
      sport: scheduleFields.sport.value,
      season: scheduleFields.season.value,
      level: scheduleFields.level.value,
      roundNumber: scheduleFields.roundNumber.value,
      scheduledAt: scheduleFields.scheduledAt.value,
      venue: scheduleFields.venue.value,
      home: scheduleFields.home.value,
      away: scheduleFields.away.value
    });
    if (!result.valid) return showToast(result.message, 'warning', 6000);
    saveAdminResultPreferences({
      sport: scheduleFields.sport.value,
      competition: 'league',
      level: scheduleFields.level.value
    });
    saveAndRefreshAdmin(result.created ? 'Mecz został dodany do terminarza.' : 'Terminarz meczu został zaktualizowany.');
  });

  const form = editor.querySelector('#result-form');
  const setFields = editor.querySelector('#set-fields');
  const contextNote = editor.querySelector('#result-context-note');
  const fields = {
    sport: form.elements.namedItem('sport'),
    competition: form.elements.namedItem('competition'),
    level: form.elements.namedItem('level'),
    tournament: form.elements.namedItem('tournament'),
    phase: form.elements.namedItem('phase'),
    match: form.elements.namedItem('match'),
    matchDate: form.elements.namedItem('matchDate'),
    home: form.elements.namedItem('home'),
    away: form.elements.namedItem('away'),
    score: form.elements.namedItem('score'),
    mvp: form.elements.namedItem('mvp')
  };
  const fieldWrappers = Object.fromEntries(
    [...form.querySelectorAll('[data-result-field]')].map(node => [node.dataset.resultField, node])
  );

  function refreshScoreFields(score = fields.score.value, sets = '') {
    setFields.innerHTML = renderSetInputs(score, sets);
  }

  function refreshMvpOptions(mvp = '') {
    fields.mvp.innerHTML = `<option value="">Brak</option>${getMatchMvpOptions(fields.sport.value, fields.home.value, fields.away.value, mvp)}`;
  }

  function setParticipants(home = '', away = '') {
    fields.home.innerHTML = home
      ? `<option value="${escapeHtml(home)}">${escapeHtml(home)}</option>`
      : '<option value="">Najpierw wybierz mecz</option>';
    fields.away.innerHTML = away
      ? `<option value="${escapeHtml(away)}">${escapeHtml(away)}</option>`
      : '<option value="">Najpierw wybierz mecz</option>';
  }

  function refreshSelectedMatch(options = {}) {
    const match = (leagueData.matches || []).find(item => String(item.id) === String(fields.match.value));
    setParticipants(match?.home || '', match?.away || '');
    fields.matchDate.value = toDateTimeInputValue(match?.scheduledAt);
    if (!match) {
      fields.score.innerHTML = '<option value="">Najpierw wybierz mecz</option>';
      fields.mvp.innerHTML = '<option value="">Brak</option>';
      setFields.innerHTML = '';
      contextNote.textContent = 'Wybierz istniejący mecz z terminarza.';
      return;
    }
    const { competition, stage } = getMatchCompetitionContext(match);
    const scoring = match.scoringProfile || stage?.scoringProfile || leagueData.sports[competition?.sport]?.defaultScoring || 'sets';
    const allowDraw = Boolean(match.allowDraw && stage?.type !== 'knockout');
    form.dataset.scoring = scoring;
    form.dataset.allowDraw = String(allowDraw);
    fields.score.innerHTML = getScoreOptions(scoring, options.score || match.score || '', { allowDraw });
    refreshScoreFields(fields.score.value, options.sets ?? match.sets ?? '');
    refreshMvpOptions(options.mvp ?? match.mvp ?? '');
    const date = match.scheduledAt ? formatAdminMatchDate(match.scheduledAt) : 'brak daty';
    const round = match.roundLabel || (match.roundNumber ? `Kolejka ${match.roundNumber}` : 'bez oznaczenia rundy');
    contextNote.textContent = `${round} · ${date}${match.venue ? ` · ${match.venue}` : ''}. Uczestnicy i format wynikają z terminarza.`;
  }

  function refreshLeagueOptions(options = {}) {
    const sport = leagueData.sports[fields.sport.value];
    const levels = sport?.levels || [];
    fieldWrappers.level.hidden = !levels.length;
    fields.level.required = Boolean(levels.length);
    fields.level.innerHTML = levels.length
      ? `<option value="">Wybierz poziom</option>${levels.map(level => `<option value="${escapeHtml(level)}" ${level === options.level ? 'selected' : ''}>${escapeHtml(level)}</option>`).join('')}`
      : '<option value="">Bez poziomu</option>';
    if (!levels.length) fields.level.value = '';
    const matches = getLeagueScheduleMatches(fields.sport.value, fields.level.value)
      .filter(match => match.homeId && match.awayId);
    fields.match.innerHTML = `<option value="">Wybierz mecz</option>${matches.map(match => {
      const selected = String(match.id) === String(options.match || '');
      const status = match.status === 'completed' ? ` · ${deriveScore(match)}` : '';
      return `<option value="${escapeHtml(match.id)}" ${selected ? 'selected' : ''}>${escapeHtml(`${formatAdminMatchDate(match.scheduledAt)} · ${match.home} - ${match.away}${status}`)}</option>`;
    }).join('')}`;
    refreshSelectedMatch(options);
    if (!matches.length) {
      contextNote.textContent = levels.length && !fields.level.value
        ? 'Najpierw wybierz poziom.'
        : 'Brak meczów w terminarzu dla wybranego zakresu.';
    }
  }

  function refreshTournamentMatchOptions(selectedMatch = '', options = {}) {
    const tournament = leagueData.tournaments.find(item => String(item.id) === String(fields.tournament.value));
    const phase = getTournamentPhase(tournament, fields.phase.value);
    fields.match.innerHTML = `<option value="">Wybierz mecz</option>${(phase?.matches || []).map(match => {
      const disabled = match.status === 'bye' || !match.home || !match.away;
      const status = match.status === 'completed' ? ` · ${deriveScore(match)}` : match.status === 'bye' ? ' · wolny los' : '';
      const label = `${match.home || 'Do ustalenia'} - ${match.away || 'Do ustalenia'}${status}`;
      return `<option value="${escapeHtml(match.id)}" ${String(match.id) === String(selectedMatch) ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</option>`;
    }).join('')}`;
    refreshSelectedMatch(options);
  }

  function refreshTournamentPhaseOptions(selectedPhase = '', selectedMatch = '', options = {}) {
    const tournament = leagueData.tournaments.find(item => String(item.id) === String(fields.tournament.value));
    const phases = getTournamentPhaseEntries(tournament);
    fields.phase.innerHTML = `<option value="">Wybierz fazę</option>${phases.map(phase => `<option value="${escapeHtml(phase.key)}" ${phase.key === selectedPhase ? 'selected' : ''}>${escapeHtml(phase.label)}</option>`).join('')}`;
    refreshTournamentMatchOptions(selectedMatch, options);
    if (tournament && !phases.length) contextNote.textContent = 'Ten turniej nie ma jeszcze wygenerowanego terminarza.';
  }

  function refreshTournamentOptions(selectedTournament = '', selectedPhase = '', selectedMatch = '', options = {}) {
    const tournaments = sortTournaments(leagueData.tournaments);
    fields.tournament.innerHTML = `<option value="">Wybierz turniej</option>${tournaments.map(tournament => `<option value="${escapeHtml(tournament.id)}" ${String(tournament.id) === String(selectedTournament) ? 'selected' : ''}>${escapeHtml(`${tournament.name} · ${getSportName(tournament.sport)}`)}</option>`).join('')}`;
    refreshTournamentPhaseOptions(selectedPhase, selectedMatch, options);
    if (!tournaments.length) contextNote.textContent = 'Brak turniejów.';
  }

  function refreshMode(options = {}) {
    const isTournament = fields.competition.value === 'tournament';
    fieldWrappers.tournament.hidden = !isTournament;
    fieldWrappers.phase.hidden = !isTournament;
    fieldWrappers.match.hidden = !isTournament;
    if (isTournament) {
      fieldWrappers.level.hidden = true;
      fields.level.required = false;
      refreshTournamentOptions(options.tournament, options.phase, options.match, options);
    } else {
      refreshLeagueOptions(options);
    }
  }

  function resetFormState() {
    const saved = getAdminResultPreferences();
    fields.sport.value = leagueData.sports[saved.sport] ? saved.sport : preferences.sport;
    fields.competition.value = saved.competition;
    refreshMode({ level: saved.level });
  }

  refreshMode(preferences);
  fields.sport.addEventListener('change', () => {
    refreshMode();
    saveAdminResultPreferences({
      sport: fields.sport.value,
      competition: fields.competition.value,
      level: fields.level.value
    });
  });
  fields.competition.addEventListener('change', () => {
    refreshMode();
    saveAdminResultPreferences({
      sport: fields.sport.value,
      competition: fields.competition.value,
      level: fields.level.value
    });
  });
  fields.level.addEventListener('change', () => {
    refreshLeagueOptions({ level: fields.level.value });
    saveAdminResultPreferences({
      sport: fields.sport.value,
      competition: 'league',
      level: fields.level.value
    });
  });
  fields.tournament.addEventListener('change', () => {
    const tournament = leagueData.tournaments.find(item => String(item.id) === String(fields.tournament.value));
    if (tournament) fields.sport.value = tournament.sport;
    refreshTournamentPhaseOptions();
    saveAdminResultPreferences({
      sport: fields.sport.value,
      competition: 'tournament',
      tournament: fields.tournament.value
    });
  });
  fields.phase.addEventListener('change', () => {
    refreshTournamentMatchOptions();
    saveAdminResultPreferences({
      sport: fields.sport.value,
      competition: 'tournament',
      tournament: fields.tournament.value,
      phase: fields.phase.value
    });
  });
  fields.match.addEventListener('change', () => {
    refreshSelectedMatch();
    saveAdminResultPreferences({
      sport: fields.sport.value,
      competition: fields.competition.value,
      level: fields.level.value,
      tournament: fields.tournament.value,
      phase: fields.phase.value,
      match: fields.match.value
    });
  });
  fields.score.addEventListener('change', () => refreshScoreFields(fields.score.value));
  form.addEventListener('reset', () => setTimeout(resetFormState));

  form.addEventListener('submit', event => {
    event.preventDefault();
    const sportKey = fields.sport.value;
    const competitionKind = fields.competition.value;
    const match = (leagueData.matches || []).find(item => String(item.id) === String(fields.match.value));
    const tournament = competitionKind === 'tournament'
      ? leagueData.tournaments.find(item => String(item.id) === String(fields.tournament.value))
      : null;
    const tournamentSelection = competitionKind === 'tournament'
      ? validateTournamentMatchSelection(tournament, fields.phase.value, fields.match.value)
      : null;
    if (tournamentSelection && !tournamentSelection.valid) {
      return showToast(tournamentSelection.message, 'warning', 6000);
    }
    const phase = tournamentSelection?.phase || null;
    const selection = validateExistingMatchForResult(match, {
      kind: competitionKind,
      sport: sportKey,
      level: competitionKind === 'league' ? fields.level.value : '',
      competitionId: tournament?.id || '',
      stageId: tournamentSelection?.match?.stageId || ''
    });
    if (!selection.valid) return showToast(selection.message, 'warning', 6000);
    const scoring = form.dataset.scoring || leagueData.sports[sportKey]?.defaultScoring || 'sets';
    const payload = {
      level: selection.stage.level || '',
      home: match.home,
      away: match.away,
      score: fields.score.value,
      sets: collectSetScores(form),
      scoring,
      phaseType: competitionKind === 'league' ? 'league' : '',
      allowDraw: form.dataset.allowDraw === 'true',
      pointsRules: match.pointsRules,
      status: 'completed',
      mvp: fields.mvp.value
    };
    payload.phaseType = competitionKind === 'league' ? 'league' : phase.type;
    payload.allowDraw = Boolean(match.allowDraw && phase?.type !== 'knockout');
    const tournamentValidation = validateMatchResult(payload, { allowDraw: payload.allowDraw });
    if (!tournamentValidation.valid) return showToast(tournamentValidation.message, 'warning', 6000);
    const allowedMvp = getMatchMvpNames(sportKey, payload.home, payload.away);
    if (payload.mvp && !allowedMvp.includes(payload.mvp)) {
      return showToast('MVP musi być zawodnikiem jednej z grających drużyn.', 'warning');
    }
    if (competitionKind === 'league') {
      const score = parseScore(payload.score);
      match.score = payload.score;
      match.setScores = globalThis.competitionModel.parseSetScores(payload.sets);
      match.status = 'completed';
      match.mvpId = getPlayerReferenceByName(payload.mvp);
      match.winnerId = score.home === score.away ? '' : score.home > score.away ? match.homeId : match.awayId;
      saveAndRefreshAdmin('Wynik ligowy został zapisany.');
      return;
    }

    try {
      if (tournamentSelection.phase.type === 'knockout') {
        globalThis.tournamentEngine.recordKnockoutResult(
          tournament.bracket,
          tournamentSelection.match.id,
          payload,
          { names: getTournamentParticipantNames(tournament) }
        );
      } else {
        globalThis.tournamentEngine.recordGroupResult(
          tournamentSelection.phase.container,
          tournamentSelection.match.id,
          payload
        );
      }
      normalizeTournament(tournament, leagueData);
      saveAndRefreshAdmin('Wynik turniejowy został zapisany.');
    } catch (error) {
      showToast(error.message || 'Nie udało się zapisać wyniku turniejowego.', 'warning', 6000);
    }
  });

  editor.querySelectorAll('.edit-schedule-match').forEach(button => button.addEventListener('click', () => {
    const match = (leagueData.matches || []).find(item => String(item.id) === String(button.dataset.match));
    if (!match) return;
    const { competition, stage } = getMatchCompetitionContext(match);
    scheduleFields.id.value = match.id;
    scheduleFields.sport.value = competition.sport;
    scheduleFields.season.value = competition.season;
    scheduleFields.roundNumber.value = match.roundNumber || 1;
    scheduleFields.scheduledAt.value = toDateTimeInputValue(match.scheduledAt);
    scheduleFields.venue.value = match.venue || '';
    refreshScheduleParticipants({
      level: stage.level || '',
      home: match.home,
      away: match.away
    });
    scheduleContextNote.textContent = match.status === 'completed'
      ? 'Mecz ma wynik. Możesz zmienić datę, miejsce lub kolejkę, ale nie uczestników.'
      : 'Edytujesz istniejącą pozycję terminarza.';
    scheduleForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  editor.querySelectorAll('.delete-schedule-match').forEach(button => button.addEventListener('click', () => {
    const match = (leagueData.matches || []).find(item => String(item.id) === String(button.dataset.match));
    if (!match) return;
    if (match.status === 'completed') {
      return showToast('Najpierw wyczyść wynik, aby usunąć mecz z terminarza.', 'warning', 6000);
    }
    leagueData.matches = leagueData.matches.filter(item => String(item.id) !== String(match.id));
    globalThis.competitionModel.installLegacyViews(leagueData);
    saveAndRefreshAdmin('Mecz został usunięty z terminarza.');
  }));

  editor.querySelectorAll('.edit-existing-result').forEach(button => button.addEventListener('click', () => {
    fields.sport.value = button.dataset.sport;
    fields.competition.value = button.dataset.kind;
    const options = button.dataset.kind === 'tournament'
      ? {
        tournament: button.dataset.tournament,
        phase: button.dataset.phase,
        match: button.dataset.match
      }
      : {
        level: button.dataset.level,
        match: button.dataset.match
      };
    refreshMode(options);
    saveAdminResultPreferences({
      sport: fields.sport.value,
      competition: fields.competition.value,
      level: fields.level.value,
      tournament: fields.tournament.value,
      phase: fields.phase.value,
      match: fields.match.value
    });
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  editor.querySelectorAll('.clear-existing-result').forEach(button => button.addEventListener('click', () => {
    const match = (leagueData.matches || []).find(item => String(item.id) === String(button.dataset.match));
    if (!match) return;
    if (button.dataset.kind === 'league') {
      match.status = 'scheduled';
      match.score = '';
      match.setScores = [];
      match.winnerId = '';
      match.mvpId = '';
      saveAndRefreshAdmin('Wynik ligowy został wyczyszczony, a mecz pozostał w terminarzu.');
      return;
    }
    const tournament = leagueData.tournaments.find(item => String(item.id) === button.dataset.tournament);
    const selection = validateTournamentMatchSelection(tournament, button.dataset.phase, button.dataset.match);
    if (!selection.valid) return showToast(selection.message, 'warning');
    try {
      if (selection.phase.type === 'knockout') {
        globalThis.tournamentEngine.clearKnockoutResult(
          tournament.bracket,
          selection.match.id,
          { names: getTournamentParticipantNames(tournament) }
        );
      } else {
        globalThis.tournamentEngine.clearGroupResult(selection.phase.container, selection.match.id);
      }
      normalizeTournament(tournament, leagueData);
      saveAndRefreshAdmin('Wynik turniejowy został wyczyszczony.');
    } catch (error) {
      showToast(error.message || 'Nie udało się wyczyścić wyniku.', 'warning', 6000);
    }
  }));
}

const TOURNAMENT_WIZARD_STEPS = [
  'Dane',
  'Uczestnicy',
  'Etapy',
  'Zasady',
  'Terminarz',
  'Podgląd'
];

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toDateTimeInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function createWizardStage(index, existing = null) {
  const type = existing?.type || (index === 0 ? 'groups' : 'knockout');
  return {
    id: existing?.id || '',
    name: existing?.name || (type === 'knockout' ? 'Play-off' : `Etap ${index + 1}`),
    type,
    seeding: existing?.seeding || 'manual',
    scoringProfile: existing?.scoringProfile || 'sets',
    allowDraws: type === 'knockout' ? false : Boolean(existing?.allowDraws ?? true),
    pointsRules: {
      win: Number(existing?.pointsRules?.win ?? 3),
      draw: Number(existing?.pointsRules?.draw ?? 1),
      loss: Number(existing?.pointsRules?.loss ?? 0)
    },
    groupConfig: {
      groupCount: Number(existing?.groupConfig?.groupCount) || (type === 'groups' ? 2 : 1),
      matchesPerPair: Number(existing?.groupConfig?.matchesPerPair) === 2 ? 2 : 1
    },
    thirdPlaceMatch: Boolean(existing?.thirdPlaceMatch),
    qualificationRule: index === 0 ? null : {
      type: existing?.qualificationRule?.type || 'places_per_group',
      count: Number(existing?.qualificationRule?.count) || 2,
      pairingRule: existing?.qualificationRule?.pairingRule || 'high_low',
      positions: [...(existing?.qualificationRule?.positions || [1, 2, 3, 4])],
      participantIds: [...(existing?.qualificationRule?.participantIds || [])]
    }
  };
}

function createTournamentWizardDraft(existing = null) {
  const sport = existing?.sport || 'tenis';
  const stages = existing?.stages?.length
    ? existing.stages.map((stage, index) => createWizardStage(index, stage))
    : [createWizardStage(0)];
  const firstMatch = existing
    ? leagueData.matches.find(match => String(match.competitionId) === String(existing.id) && match.scheduledAt)
    : null;
  return {
    editingId: existing?.id || '',
    step: 0,
    name: existing?.name || '',
    sport,
    status: existing?.status || 'draft',
    startDate: toDateInputValue(existing?.startDate),
    endDate: toDateInputValue(existing?.endDate),
    participantIds: [...(existing?.participantIds || [])],
    stages,
    scheduleStart: toDateTimeInputValue(firstMatch?.scheduledAt || existing?.startDate),
    matchesPerDay: 4,
    intervalDays: 1,
    venue: firstMatch?.venue || '',
    preview: null,
    previewError: ''
  };
}

function getTournamentWizardParticipants(sportKey) {
  return getEligibleTournamentParticipants(sportKey).map(participant => ({
    ...participant,
    reference: getParticipantReference(leagueData, sportKey, participant.name)
  })).filter(participant => participant.reference);
}

function ensureTournamentWizardStages(draft, count) {
  const stageCount = Math.max(1, Math.min(3, Number(count) || 1));
  while (draft.stages.length < stageCount) {
    draft.stages.push(createWizardStage(draft.stages.length));
  }
  draft.stages = draft.stages.slice(0, stageCount).map((stage, index) => {
    if (index === 0) stage.qualificationRule = null;
    else if (!stage.qualificationRule) stage.qualificationRule = createWizardStage(index).qualificationRule;
    return stage;
  });
}

function validateTournamentWizardStep(draft, step = draft.step) {
  if (step === 0) {
    if (!draft.name.trim()) return { valid: false, message: 'Podaj nazwę turnieju.' };
    if (!leagueData.sports[draft.sport]) return { valid: false, message: 'Wybierz prawidłową dyscyplinę.' };
    if (!draft.startDate || !draft.endDate) return { valid: false, message: 'Podaj datę rozpoczęcia i zakończenia.' };
    if (Date.parse(draft.endDate) < Date.parse(draft.startDate)) {
      return { valid: false, message: 'Data zakończenia nie może poprzedzać rozpoczęcia.' };
    }
  }
  if (step === 1) {
    const eligible = new Set(getTournamentWizardParticipants(draft.sport).map(participant => participant.reference));
    if (draft.participantIds.length < 2) return { valid: false, message: 'Wybierz co najmniej dwóch uczestników.' };
    if (draft.participantIds.some(reference => !eligible.has(reference))) {
      return { valid: false, message: 'Lista zawiera uczestnika spoza wybranej dyscypliny.' };
    }
  }
  if (step === 2) {
    if (draft.stages.length < 1 || draft.stages.length > 3) {
      return { valid: false, message: 'Turniej może mieć od jednego do trzech etapów.' };
    }
    if (draft.stages.some(stage => !['round_robin', 'groups', 'knockout'].includes(stage.type))) {
      return { valid: false, message: 'Wybierz prawidłowy typ każdego etapu.' };
    }
  }
  if (step === 3) {
    for (let index = 0; index < draft.stages.length; index += 1) {
      const stage = draft.stages[index];
      if (!stage.name.trim()) return { valid: false, message: `Podaj nazwę etapu ${index + 1}.` };
      if (stage.type === 'groups' && Number(stage.groupConfig.groupCount) < 1) {
        return { valid: false, message: `Etap ${index + 1} wymaga co najmniej jednej grupy.` };
      }
      if (stage.type === 'knockout' && stage.allowDraws) {
        return { valid: false, message: 'Faza play-off nie może dopuszczać remisu.' };
      }
      if (index > 0 && !stage.qualificationRule?.type) {
        return { valid: false, message: `Wybierz regułę awansu do etapu ${index + 1}.` };
      }
    }
  }
  if (step === 4) {
    if (!draft.scheduleStart) return { valid: false, message: 'Podaj termin pierwszego meczu.' };
    if (Number(draft.matchesPerDay) < 1) return { valid: false, message: 'Liczba meczów dziennie musi być większa od zera.' };
    if (Number(draft.intervalDays) < 0) return { valid: false, message: 'Odstęp dni nie może być ujemny.' };
  }
  return { valid: true, message: '' };
}

function tournamentWizardStageSignature(stage) {
  return {
    type: stage.type,
    seeding: stage.seeding,
    scoringProfile: stage.scoringProfile,
    allowDraws: stage.allowDraws,
    pointsRules: {
      win: Number(stage.pointsRules?.win ?? 3),
      draw: Number(stage.pointsRules?.draw ?? 1),
      loss: Number(stage.pointsRules?.loss ?? 0)
    },
    groupConfig: {
      groupCount: Number(stage.groupConfig?.groupCount) || 1,
      matchesPerPair: Number(stage.groupConfig?.matchesPerPair) === 2 ? 2 : 1
    },
    thirdPlaceMatch: stage.thirdPlaceMatch,
    qualificationRule: stage.qualificationRule ? {
      type: stage.qualificationRule.type,
      count: Number(stage.qualificationRule.count) || 0,
      pairingRule: stage.qualificationRule.pairingRule || '',
      positions: [...(stage.qualificationRule.positions || [])],
      participantIds: [...(stage.qualificationRule.participantIds || [])]
    } : null
  };
}

function tournamentStructureSignature(competition) {
  return JSON.stringify({
    sport: competition.sport,
    participantIds: competition.participantIds,
    stages: competition.stages.map(tournamentWizardStageSignature)
  });
}

function buildCompetitionFromTournamentDraft(draft) {
  const existing = leagueData.competitions.find(item => String(item.id) === String(draft.editingId));
  const token = Date.now().toString(36);
  const id = existing?.id || `competition:tournament:${globalThis.competitionModel.slugify(draft.name)}:${token}`;
  const stages = draft.stages.map((stage, index) => ({
    id: stage.id || `stage:${id}:${index + 1}`,
    competitionId: id,
    order: index + 1,
    name: stage.name.trim(),
    type: stage.type,
    role: stage.type === 'knockout' ? 'knockout' : stage.type === 'groups' ? 'groups' : '',
    seeding: stage.seeding,
    thirdPlaceMatch: Boolean(stage.thirdPlaceMatch),
    scoringProfile: stage.scoringProfile,
    allowDraws: stage.type === 'knockout' ? false : Boolean(stage.allowDraws),
    pointsRules: {
      win: Number(stage.pointsRules.win),
      draw: Number(stage.pointsRules.draw),
      loss: Number(stage.pointsRules.loss)
    },
    tieBreakOrder: [...DEFAULT_GROUP_CONFIG.tieBreakOrder],
    groupConfig: {
      groupCount: stage.type === 'groups' ? Number(stage.groupConfig.groupCount) : 1,
      matchesPerPair: Number(stage.groupConfig.matchesPerPair) === 2 ? 2 : 1
    },
    qualificationRule: index === 0 ? null : structuredClone(stage.qualificationRule),
    status: 'draft',
    participantIds: [],
    groups: []
  }));
  return globalThis.competitionModel.normalizeCompetition({
    id,
    legacyId: existing?.legacyId ?? null,
    slug: existing?.slug || globalThis.competitionModel.slugify(draft.name),
    name: draft.name.trim(),
    kind: 'tournament',
    sport: draft.sport,
    season: draft.startDate.slice(0, 4),
    participantType: leagueData.sports[draft.sport]?.type === 'team' ? 'team' : 'player',
    status: draft.status,
    startDate: `${draft.startDate}T00:00:00`,
    endDate: `${draft.endDate}T23:59:59`,
    participantIds: [...draft.participantIds],
    stages,
    finalClassification: existing?.finalClassification || []
  }, leagueData.competitions.length);
}

function assignTournamentWizardSchedule(matches, draft) {
  const start = new Date(draft.scheduleStart);
  const perDay = Math.max(1, Number(draft.matchesPerDay) || 1);
  const interval = Math.max(0, Number(draft.intervalDays) || 0);
  matches.forEach((match, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + Math.floor(index / perDay) * interval);
    match.scheduledAt = date.toISOString();
    match.venue = draft.venue.trim();
    match.roundNumber = match.roundNumber || Math.floor(index / perDay) + 1;
  });
}

function generateTournamentWizardPreview(draft) {
  const competition = buildCompetitionFromTournamentDraft(draft);
  const matches = [];
  const names = Object.fromEntries(draft.participantIds.map(reference => [
    reference,
    getParticipantNameFromReference(leagueData, reference)
  ]));
  globalThis.tournamentEngine.generateCompetitionStructure(competition, matches, { names });
  competition.stages[0].status = draft.status === 'draft'
    ? 'draft'
    : draft.status === 'published' ? 'scheduled' : 'ongoing';
  assignTournamentWizardSchedule(matches, draft);
  return { competition, matches, names };
}

function renderTournamentWizardBracket(competition, stage, matches) {
  const stageMatches = matches.filter(match => match.stageId === stage.id);
  if (!stageMatches.length) return '<p class="empty-state">Brak wygenerowanych meczów.</p>';
  const rounds = [...new Set(stageMatches.filter(match => !match.isThirdPlace).map(match => match.roundNumber))]
    .sort((left, right) => left - right);
  return `<div class="tournament-bracket-scroll wizard-bracket-preview" tabindex="0"><div class="tournament-bracket" style="--round-count:${rounds.length}">${rounds.map(round => {
    const roundMatches = stageMatches.filter(match => !match.isThirdPlace && match.roundNumber === round);
    return `<section class="tournament-round"><h4>${escapeHtml(roundMatches[0]?.roundLabel || `Runda ${round}`)}</h4><div class="tournament-round-matches">${roundMatches.map((match, index) => `<article class="bracket-game"><span class="bracket-game-number">Mecz ${index + 1}</span><div><span>${escapeHtml(getParticipantNameFromReference(leagueData, match.homeId) || match.homeLabel || 'Do ustalenia')}</span><strong>–</strong></div><div><span>${escapeHtml(getParticipantNameFromReference(leagueData, match.awayId) || match.awayLabel || 'Do ustalenia')}</span><strong>–</strong></div></article>`).join('')}</div></section>`;
  }).join('')}</div></div>`;
}

function estimateTournamentWizardStageSize(draft, stageIndex) {
  if (stageIndex === 0) return draft.participantIds.length;
  const stage = draft.stages[stageIndex];
  const previous = draft.stages[stageIndex - 1];
  const rule = stage.qualificationRule || {};
  if (rule.type === 'group_winners') return Math.max(1, Number(previous.groupConfig.groupCount) || 1);
  if (rule.type === 'places_per_group') {
    const groups = previous.type === 'groups' ? Number(previous.groupConfig.groupCount) || 1 : 1;
    return Math.max(2, groups * (Number(rule.count) || 1));
  }
  if (rule.type === 'best_overall') return Math.max(2, Number(rule.count) || 2);
  if (rule.type === 'stage_positions') return Math.max(2, rule.positions?.length || 2);
  if (rule.type === 'manual') return Math.max(2, rule.participantIds?.length || 2);
  return Math.max(2, Math.min(8, estimateTournamentWizardStageSize(draft, stageIndex - 1)));
}

function renderTournamentWizardFutureStage(draft, stage, index) {
  const count = estimateTournamentWizardStageSize(draft, index);
  const placeholders = Array.from({ length: count }, (_, participantIndex) => `seed:${index + 1}:${participantIndex + 1}`);
  if (stage.type === 'knockout') {
    try {
      const bracket = globalThis.tournamentEngine.createKnockoutBracket(placeholders, {
        tournamentId: `preview-${index + 1}`,
        seeding: 'manual',
        thirdPlaceMatch: stage.thirdPlaceMatch
      }).map(match => ({
        ...match,
        stageId: `preview-stage-${index + 1}`,
        roundNumber: match.roundIndex + 1,
        roundLabel: match.round,
        homeLabel: match.homeId ? `Seed ${placeholders.indexOf(match.homeId) + 1}` : '',
        awayLabel: match.awayId ? `Seed ${placeholders.indexOf(match.awayId) + 1}` : ''
      }));
      return `<section class="wizard-preview-surface"><div class="tournament-stage-heading"><div><span class="eyebrow">Etap ${index + 1}</span><h3>${escapeHtml(stage.name)}</h3></div><span class="tournament-stage-note">${count} miejsc po awansie</span></div>${renderTournamentWizardBracket({ id: 'preview' }, { id: `preview-stage-${index + 1}` }, bracket)}</section>`;
    } catch (error) {
      return `<p class="wizard-error">${escapeHtml(error.message)}</p>`;
    }
  }
  const groupCount = stage.type === 'round_robin' ? 1 : Math.max(1, Number(stage.groupConfig.groupCount) || 1);
  const groups = Array.from({ length: groupCount }, (_, groupIndex) => {
    const members = placeholders.filter((_, participantIndex) => participantIndex % groupCount === groupIndex);
    return `<article><h4>${stage.type === 'round_robin' ? 'Tabela' : `Grupa ${String.fromCharCode(65 + groupIndex)}`}</h4><ol>${members.map((_, memberIndex) => `<li>Seed ${groupIndex + memberIndex * groupCount + 1}</li>`).join('')}</ol><span>Skład ustali poprzedni etap</span></article>`;
  }).join('');
  return `<section class="wizard-preview-surface"><div class="tournament-stage-heading"><div><span class="eyebrow">Etap ${index + 1}</span><h3>${escapeHtml(stage.name)}</h3></div><span class="tournament-stage-note">${count} miejsc po awansie</span></div><div class="wizard-group-preview">${groups}</div></section>`;
}

function renderTournamentWizardPreview(draft) {
  try {
    const preview = generateTournamentWizardPreview(draft);
    draft.preview = preview;
    draft.previewError = '';
    const firstStage = preview.competition.stages[0];
    const firstMatches = preview.matches.filter(match => match.stageId === firstStage.id);
    const structure = preview.competition.stages.map(stage => `<article class="wizard-stage-summary"><span>Etap ${stage.order}</span><strong>${escapeHtml(stage.name)}</strong><small>${escapeHtml(getTournamentStageTypeLabel(stage.type))}</small></article>`).join('');
    const visual = firstStage.type === 'knockout'
      ? renderTournamentWizardBracket(preview.competition, firstStage, preview.matches)
      : `<div class="wizard-group-preview">${firstStage.groups.map(group => `<article><h4>${escapeHtml(group.name)}</h4><ol>${group.participantIds.map(reference => `<li>${escapeHtml(getParticipantNameFromReference(leagueData, reference))}</li>`).join('')}</ol><span>${firstMatches.filter(match => match.groupId === group.id).length} meczów</span></article>`).join('')}</div>`;
    const futureStages = draft.stages.slice(1).map((stage, index) => (
      renderTournamentWizardFutureStage(draft, stage, index + 1)
    )).join('');
    return `<div class="wizard-review"><div class="wizard-review-header"><div><span class="eyebrow">${escapeHtml(getSportName(draft.sport))}</span><h3>${escapeHtml(draft.name)}</h3><p>${escapeHtml(draft.startDate)} – ${escapeHtml(draft.endDate)} · ${draft.participantIds.length} uczestników</p></div><span class="tournament-status tournament-status-${escapeHtml(draft.status)}">${escapeHtml(getTournamentStatusLabel(draft.status))}</span></div><div class="wizard-stage-flow">${structure}</div><section class="wizard-preview-surface"><div class="tournament-stage-heading"><div><span class="eyebrow">Etap 1</span><h3>${escapeHtml(firstStage.name)}</h3></div><span class="tournament-stage-note">${firstMatches.length} meczów</span></div>${visual}</section>${futureStages}</div>`;
  } catch (error) {
    draft.preview = null;
    draft.previewError = error.message || 'Nie udało się wygenerować podglądu.';
    return `<p class="wizard-error">${escapeHtml(draft.previewError)}</p>`;
  }
}

function getTournamentStageTypeLabel(type) {
  return {
    round_robin: 'Każdy z każdym',
    groups: 'Grupy',
    knockout: 'Play-off'
  }[type] || type;
}

function renderTournamentWizardParticipantStep(draft) {
  const selected = new Set(draft.participantIds);
  const participants = getTournamentWizardParticipants(draft.sport);
  return `<div class="wizard-participant-list">${participants.map(participant => `<label class="wizard-participant-option"><input type="checkbox" data-participant value="${escapeHtml(participant.reference)}" ${selected.has(participant.reference) ? 'checked' : ''} /><span>${renderLogo(participant.name)}<strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(participant.club || '')}</small></span></label>`).join('')}</div><div class="wizard-selection-count"><strong>${draft.participantIds.length}</strong><span>wybranych uczestników</span></div>`;
}

function renderTournamentWizardRules(draft) {
  return `<div class="wizard-stage-config-list">${draft.stages.map((stage, index) => {
    const previous = draft.stages[index - 1];
    const groupFields = stage.type === 'groups' || stage.type === 'round_robin'
      ? `<label>${stage.type === 'groups' ? 'Liczba grup' : 'Grupy'}<input type="number" min="1" max="16" data-stage-field="groupCount" data-stage-index="${index}" value="${stage.type === 'round_robin' ? 1 : stage.groupConfig.groupCount}" ${stage.type === 'round_robin' ? 'disabled' : ''} /></label><label>Mecze każdej pary<select data-stage-field="matchesPerPair" data-stage-index="${index}"><option value="1" ${stage.groupConfig.matchesPerPair === 1 ? 'selected' : ''}>Jeden mecz</option><option value="2" ${stage.groupConfig.matchesPerPair === 2 ? 'selected' : ''}>Mecz i rewanż</option></select></label>`
      : `<label class="toggle-field"><input type="checkbox" data-stage-field="thirdPlaceMatch" data-stage-index="${index}" ${stage.thirdPlaceMatch ? 'checked' : ''} /><span>Mecz o trzecie miejsce</span></label>`;
    const qualification = index === 0 ? '' : `<div class="wizard-qualification"><h4>Awans z: ${escapeHtml(previous.name)}</h4><div class="admin-form-grid"><label>Reguła awansu<select data-stage-field="qualificationType" data-stage-index="${index}"><option value="places_per_group" ${stage.qualificationRule.type === 'places_per_group' ? 'selected' : ''}>Miejsca z każdej grupy</option><option value="group_winners" ${stage.qualificationRule.type === 'group_winners' ? 'selected' : ''}>Zwycięzcy grup</option><option value="best_overall" ${stage.qualificationRule.type === 'best_overall' ? 'selected' : ''}>Najlepsi ogółem</option><option value="stage_positions" ${stage.qualificationRule.type === 'stage_positions' ? 'selected' : ''}>Pozycje poprzedniego etapu</option><option value="manual" ${stage.qualificationRule.type === 'manual' ? 'selected' : ''}>Wybór ręczny</option></select></label>${['places_per_group', 'best_overall'].includes(stage.qualificationRule.type) ? `<label>Liczba awansujących<input type="number" min="1" data-stage-field="qualificationCount" data-stage-index="${index}" value="${stage.qualificationRule.count}" /></label>` : ''}${stage.type === 'knockout' ? `<label>Rozstawienie<select data-stage-field="pairingRule" data-stage-index="${index}"><option value="high_low" ${stage.qualificationRule.pairingRule === 'high_low' ? 'selected' : ''}>Najwyższy z najniższym</option><option value="cross_groups" ${stage.qualificationRule.pairingRule === 'cross_groups' ? 'selected' : ''}>Krzyżowo między grupami</option><option value="group_result" ${stage.qualificationRule.pairingRule === 'group_result' ? 'selected' : ''}>Według wyników grup</option><option value="random" ${stage.qualificationRule.pairingRule === 'random' ? 'selected' : ''}>Losowo</option></select></label>` : ''}</div></div>`;
    return `<article class="wizard-stage-config"><header><span>Etap ${index + 1}</span><h3>${escapeHtml(stage.name)}</h3><small>${escapeHtml(getTournamentStageTypeLabel(stage.type))}</small></header><div class="admin-form-grid"><label>Nazwa etapu<input type="text" data-stage-field="name" data-stage-index="${index}" value="${escapeHtml(stage.name)}" /></label><label>Rozstawienie<select data-stage-field="seeding" data-stage-index="${index}"><option value="manual" ${stage.seeding === 'manual' ? 'selected' : ''}>Ręczne / kolejność listy</option><option value="random" ${stage.seeding === 'random' ? 'selected' : ''}>Losowe</option><option value="group_result" ${stage.seeding === 'group_result' ? 'selected' : ''}>Według poprzedniego etapu</option></select></label><label>Format wyniku<select data-stage-field="scoringProfile" data-stage-index="${index}"><option value="sets" ${stage.scoringProfile === 'sets' ? 'selected' : ''}>Do dwóch wygranych setów</option><option value="volleyball" ${stage.scoringProfile === 'volleyball' ? 'selected' : ''}>Do trzech wygranych setów</option></select></label>${groupFields}${stage.type !== 'knockout' ? `<label class="toggle-field"><input type="checkbox" data-stage-field="allowDraws" data-stage-index="${index}" ${stage.allowDraws ? 'checked' : ''} /><span>Zezwól na remis 1:1</span></label>` : ''}<label>Punkty za wygraną<input type="number" min="0" data-stage-field="pointsWin" data-stage-index="${index}" value="${stage.pointsRules.win}" /></label><label>Punkty za remis<input type="number" min="0" data-stage-field="pointsDraw" data-stage-index="${index}" value="${stage.pointsRules.draw}" ${stage.type === 'knockout' ? 'disabled' : ''} /></label><label>Punkty za porażkę<input type="number" min="0" data-stage-field="pointsLoss" data-stage-index="${index}" value="${stage.pointsRules.loss}" /></label></div>${qualification}</article>`;
  }).join('')}</div>`;
}

function renderTournamentWizardStep(draft) {
  if (draft.step === 0) {
    return `<div class="admin-form-grid"><label>Nazwa turnieju<input type="text" data-wizard-field="name" value="${escapeHtml(draft.name)}" placeholder="np. Letni Puchar Tenisa" /></label><label>Dyscyplina<select data-wizard-field="sport">${getSportOptions(draft.sport)}</select></label><label>Status<select data-wizard-field="status"><option value="draft" ${draft.status === 'draft' ? 'selected' : ''}>Szkic</option><option value="published" ${draft.status === 'published' ? 'selected' : ''}>Opublikowany</option><option value="ongoing" ${draft.status === 'ongoing' ? 'selected' : ''}>W trakcie</option><option value="completed" ${draft.status === 'completed' ? 'selected' : ''}>Zakończony</option></select></label><label>Data rozpoczęcia<input type="date" data-wizard-field="startDate" value="${escapeHtml(draft.startDate)}" /></label><label>Data zakończenia<input type="date" data-wizard-field="endDate" value="${escapeHtml(draft.endDate)}" /></label></div>`;
  }
  if (draft.step === 1) return renderTournamentWizardParticipantStep(draft);
  if (draft.step === 2) {
    return `<div class="wizard-stage-count"><label>Liczba etapów<select data-wizard-field="stageCount"><option value="1" ${draft.stages.length === 1 ? 'selected' : ''}>1 etap</option><option value="2" ${draft.stages.length === 2 ? 'selected' : ''}>2 etapy</option><option value="3" ${draft.stages.length === 3 ? 'selected' : ''}>3 etapy</option></select></label></div><div class="wizard-stage-type-grid">${draft.stages.map((stage, index) => `<article class="wizard-stage-type"><span>Etap ${index + 1}</span><label>Nazwa<input type="text" data-stage-field="name" data-stage-index="${index}" value="${escapeHtml(stage.name)}" /></label><label>System<select data-stage-field="type" data-stage-index="${index}"><option value="round_robin" ${stage.type === 'round_robin' ? 'selected' : ''}>Każdy z każdym</option><option value="groups" ${stage.type === 'groups' ? 'selected' : ''}>Grupy</option><option value="knockout" ${stage.type === 'knockout' ? 'selected' : ''}>Play-off</option></select></label></article>`).join('')}</div>`;
  }
  if (draft.step === 3) return renderTournamentWizardRules(draft);
  if (draft.step === 4) {
    return `<div class="admin-form-grid"><label>Pierwszy mecz<input type="datetime-local" data-wizard-field="scheduleStart" value="${escapeHtml(draft.scheduleStart)}" /></label><label>Meczów dziennie<input type="number" min="1" max="32" data-wizard-field="matchesPerDay" value="${draft.matchesPerDay}" /></label><label>Odstęp między dniami<input type="number" min="0" max="30" data-wizard-field="intervalDays" value="${draft.intervalDays}" /></label><label>Miejsce<input type="text" data-wizard-field="venue" value="${escapeHtml(draft.venue)}" placeholder="np. Hala Centrum" /></label></div><p class="form-hint">Kreator rozkłada mecze pierwszego etapu od wskazanej daty. Daty kolejnych etapów będzie można uzupełnić po wyłonieniu uczestników.</p>`;
  }
  return renderTournamentWizardPreview(draft);
}

function updateTournamentWizardField(draft, target) {
  const field = target.dataset.wizardField;
  if (field) {
    if (field === 'stageCount') ensureTournamentWizardStages(draft, target.value);
    else if (['matchesPerDay', 'intervalDays'].includes(field)) draft[field] = Number(target.value);
    else draft[field] = target.value;
    if (field === 'sport') draft.participantIds = [];
    return;
  }
  if (target.matches('[data-participant]')) {
    const selected = new Set(draft.participantIds);
    if (target.checked) selected.add(target.value);
    else selected.delete(target.value);
    draft.participantIds = [...selected];
    return;
  }
  const stageField = target.dataset.stageField;
  if (!stageField) return;
  const stage = draft.stages[Number(target.dataset.stageIndex)];
  if (!stage) return;
  if (stageField === 'type') {
    const previousType = stage.type;
    stage.type = target.value;
    stage.allowDraws = target.value !== 'knockout' && previousType === 'knockout' ? true : stage.allowDraws;
    stage.thirdPlaceMatch = target.value === 'knockout' ? stage.thirdPlaceMatch : false;
    if (stage.type === 'round_robin') stage.groupConfig.groupCount = 1;
  } else if (stageField === 'name' || stageField === 'scoringProfile' || stageField === 'seeding') stage[stageField] = target.value;
  else if (stageField === 'allowDraws' || stageField === 'thirdPlaceMatch') stage[stageField] = target.checked;
  else if (stageField === 'groupCount' || stageField === 'matchesPerPair') stage.groupConfig[stageField] = Number(target.value);
  else if (stageField === 'pointsWin') stage.pointsRules.win = Number(target.value);
  else if (stageField === 'pointsDraw') stage.pointsRules.draw = Number(target.value);
  else if (stageField === 'pointsLoss') stage.pointsRules.loss = Number(target.value);
  else if (stageField === 'qualificationType') stage.qualificationRule.type = target.value;
  else if (stageField === 'qualificationCount') stage.qualificationRule.count = Number(target.value);
  else if (stageField === 'pairingRule') stage.qualificationRule.pairingRule = target.value;
}

function saveTournamentWizardDraft(draft) {
  for (let step = 0; step <= 4; step += 1) {
    const validation = validateTournamentWizardStep(draft, step);
    if (!validation.valid) {
      draft.step = step;
      return { saved: false, message: validation.message };
    }
  }
  let generated;
  try {
    generated = generateTournamentWizardPreview(draft);
  } catch (error) {
    draft.step = 5;
    return { saved: false, message: error.message || 'Nie udało się wygenerować turnieju.' };
  }
  const existingIndex = leagueData.competitions.findIndex(item => String(item.id) === String(draft.editingId));
  const existing = existingIndex >= 0 ? leagueData.competitions[existingIndex] : null;
  const existingMatches = existing
    ? leagueData.matches.filter(match => String(match.competitionId) === String(existing.id))
    : [];
  const structureChanged = existing
    ? tournamentStructureSignature(existing) !== tournamentStructureSignature(generated.competition)
    : true;
  if (existing && structureChanged && existingMatches.some(match => ['completed', 'walkover'].includes(match.status))) {
    return {
      saved: false,
      message: 'Nie można zmienić struktury turnieju z rozegranymi meczami. Najpierw wycofaj zależne wyniki.'
    };
  }
  if (existing && !structureChanged) {
    existing.name = generated.competition.name;
    existing.slug = generated.competition.slug;
    existing.status = generated.competition.status;
    existing.startDate = generated.competition.startDate;
    existing.endDate = generated.competition.endDate;
    existing.season = generated.competition.season;
    existingMatches.forEach(match => {
      if (draft.venue.trim()) match.venue = draft.venue.trim();
    });
    adminTournamentWizardState = createTournamentWizardDraft(existing);
    saveAndRefreshAdmin('Turniej został zaktualizowany.');
    return { saved: true, competition: existing };
  }
  if (existing) {
    leagueData.competitions.splice(existingIndex, 1, generated.competition);
    leagueData.matches = leagueData.matches.filter(match => String(match.competitionId) !== String(existing.id));
  } else {
    leagueData.competitions.push(generated.competition);
  }
  leagueData.matches.push(...generated.matches);
  globalThis.competitionModel.installLegacyViews(leagueData);
  adminTournamentWizardState = createTournamentWizardDraft(generated.competition);
  saveAndRefreshAdmin(existing ? 'Turniej został przebudowany.' : 'Turniej został utworzony.');
  return { saved: true, competition: generated.competition };
}

function renderTournamentWizard(editor, options = {}) {
  const existing = options.existing || null;
  if (!adminTournamentWizardState
      || String(adminTournamentWizardState.editingId || '') !== String(existing?.id || '')) {
    adminTournamentWizardState = createTournamentWizardDraft(existing);
  }
  const draft = adminTournamentWizardState;
  editor.innerHTML = `<section class="tournament-wizard" aria-labelledby="tournament-wizard-title"><header class="tournament-wizard-header"><div><span class="eyebrow">${existing ? 'Edycja turnieju' : 'Nowy turniej'}</span><h2 id="tournament-wizard-title">${existing ? escapeHtml(existing.name) : 'Kreator turnieju'}</h2></div>${options.backHref ? `<a class="button button-alt compact-button" href="${escapeHtml(options.backHref)}">Wróć do listy</a>` : ''}</header><nav class="wizard-stepper" aria-label="Etapy kreatora">${TOURNAMENT_WIZARD_STEPS.map((label, index) => `<button type="button" data-wizard-step="${index}" class="${index === draft.step ? 'is-current' : ''} ${index < draft.step ? 'is-complete' : ''}" aria-current="${index === draft.step ? 'step' : 'false'}"><span>${index + 1}</span>${escapeHtml(label)}</button>`).join('')}</nav><form id="tournament-wizard-form" class="admin-form tournament-wizard-form"><fieldset><legend>${escapeHtml(TOURNAMENT_WIZARD_STEPS[draft.step])}</legend><div class="wizard-step-content">${renderTournamentWizardStep(draft)}</div><div class="admin-actions wizard-actions">${draft.step > 0 ? '<button type="button" class="button-secondary" data-wizard-action="back">Wstecz</button>' : ''}<div class="wizard-actions-spacer"></div>${draft.step < TOURNAMENT_WIZARD_STEPS.length - 1 ? '<button type="button" data-wizard-action="next">Dalej</button>' : '<button type="submit">Zapisz turniej</button>'}</div></fieldset></form></section>`;
  const form = editor.querySelector('#tournament-wizard-form');
  form.addEventListener('input', event => {
    updateTournamentWizardField(draft, event.target);
    if (event.target.matches('[data-participant]')) {
      editor.querySelector('.wizard-selection-count strong').textContent = draft.participantIds.length;
    }
  });
  form.addEventListener('change', event => {
    const rerender = event.target.dataset.wizardField === 'sport'
      || event.target.dataset.wizardField === 'stageCount'
      || ['type', 'qualificationType'].includes(event.target.dataset.stageField);
    updateTournamentWizardField(draft, event.target);
    if (rerender) renderTournamentWizard(editor, options);
  });
  editor.querySelectorAll('[data-wizard-step]').forEach(button => button.addEventListener('click', () => {
    const nextStep = Number(button.dataset.wizardStep);
    if (nextStep > draft.step) {
      for (let step = draft.step; step < nextStep; step += 1) {
        const validation = validateTournamentWizardStep(draft, step);
        if (!validation.valid) return showToast(validation.message, 'warning', 5000);
      }
    }
    draft.step = nextStep;
    renderTournamentWizard(editor, options);
  }));
  editor.querySelector('[data-wizard-action="back"]')?.addEventListener('click', () => {
    draft.step = Math.max(0, draft.step - 1);
    renderTournamentWizard(editor, options);
  });
  editor.querySelector('[data-wizard-action="next"]')?.addEventListener('click', () => {
    const validation = validateTournamentWizardStep(draft);
    if (!validation.valid) return showToast(validation.message, 'warning', 5000);
    draft.step = Math.min(TOURNAMENT_WIZARD_STEPS.length - 1, draft.step + 1);
    renderTournamentWizard(editor, options);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const result = saveTournamentWizardDraft(draft);
    if (!result.saved) {
      showToast(result.message, 'warning', 6000);
      renderTournamentWizard(editor, options);
    }
  });
}

function renderTournamentAdminList(container) {
  const sortedTournaments = sortTournaments(leagueData.tournaments);
  container.innerHTML = `<div class="admin-table-block tournament-admin-list"><div class="admin-list-toolbar"><div><h4>Turnieje</h4><p>${sortedTournaments.length} wydarzeń</p></div></div><div class="admin-table-scroll"><table><thead><tr><th>#</th><th>Turniej</th><th>Dyscyplina</th><th>Status</th><th>Etapy</th><th>Uczestnicy</th><th>Daty</th><th>Akcje</th></tr></thead><tbody>${sortedTournaments.length ? sortedTournaments.map((tournament, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(tournament.name)}</strong></td><td>${escapeHtml(getSportName(tournament.sport))}</td><td>${escapeHtml(getTournamentStatusLabel(tournament.status))}</td><td>${tournament.stages.length}</td><td>${tournament.participantIds.length}</td><td>${escapeHtml(toDateInputValue(tournament.startDate) || '–')}<br />${escapeHtml(toDateInputValue(tournament.endDate) || '–')}</td><td><div class="table-actions"><a class="compact-button" href="admin-turniej.html?id=${encodeURIComponent(tournament.id)}">Zarządzaj</a><a class="compact-button button-secondary" href="turniej.html?id=${encodeURIComponent(tournament.id)}">Podgląd</a><button type="button" class="compact-button danger-button delete-tournament" data-id="${escapeHtml(tournament.id)}">Usuń</button></div></td></tr>`).join('') : '<tr><td colspan="8">Brak turniejów.</td></tr>'}</tbody></table></div></div>`;
  container.querySelectorAll('.delete-tournament').forEach(button => button.addEventListener('click', () => {
    const tournamentId = button.dataset.id;
    const tournament = leagueData.competitions.find(item => String(item.id) === String(tournamentId));
    if (!tournament) return;
    const completed = leagueData.matches.some(match => (
      String(match.competitionId) === String(tournamentId)
      && ['completed', 'walkover'].includes(match.status)
    ));
    if (completed && !window.confirm('Turniej ma zapisane wyniki. Usunąć turniej wraz ze wszystkimi meczami?')) return;
    leagueData.competitions = leagueData.competitions.filter(item => String(item.id) !== String(tournamentId));
    leagueData.matches = leagueData.matches.filter(match => String(match.competitionId) !== String(tournamentId));
    globalThis.competitionModel.installLegacyViews(leagueData);
    adminTournamentWizardState = createTournamentWizardDraft();
    saveAndRefreshAdmin('Turniej został usunięty.');
  }));
}

function renderAdminTournaments() {
  const editor = document.getElementById('tournaments-editor');
  if (!editor) return;
  editor.innerHTML = '<div id="tournament-wizard-root"></div><div id="tournament-list-root"></div>';
  renderTournamentWizard(editor.querySelector('#tournament-wizard-root'));
  renderTournamentAdminList(editor.querySelector('#tournament-list-root'));
}

function renderAdminTournamentManagement() {
  const editor = document.getElementById('admin-tournament-editor');
  if (!editor) return;
  const tournamentId = new URLSearchParams(window.location.search).get('id');
  const tournament = leagueData.competitions.find(item => (
    item.kind === 'tournament' && String(item.id) === String(tournamentId)
  ));
  if (!tournament) {
    editor.innerHTML = '<section class="empty-state"><h2>Nie znaleziono turnieju</h2><a class="button compact-button" href="admin-turnieje.html">Wróć do listy</a></section>';
    return;
  }
  editor.innerHTML = '<div id="admin-tournament-wizard-root"></div><div id="admin-tournament-matches-root"></div>';
  renderTournamentWizard(editor.querySelector('#admin-tournament-wizard-root'), {
    existing: tournament,
    backHref: 'admin-turnieje.html'
  });
  const matchRoot = editor.querySelector('#admin-tournament-matches-root');
  matchRoot.innerHTML = `<section class="tournament-management-results"><div class="section-lead"><span class="eyebrow">Obsługa meczów</span><h2>Terminarz i wyniki turnieju</h2><p>Wybierz mecz bezpośrednio z grupy albo drabinki. Formularz wyników otworzy się z prawidłową dyscypliną i etapem.</p></div>${renderTournamentGroups(tournament, { adminEdit: true })}${renderTournamentBracket(tournament, { adminEdit: true })}</section>`;
}

function initAdminPanel() {
  if (!document.getElementById('admin-content')) return;
  initAdminNavigation();
  const logoutButton = document.getElementById('admin-logout');
  if (logoutButton) logoutButton.addEventListener('click', async () => {
    try {
      await window.leagueStore?.signOut();
    } catch (error) {
      console.error('Błąd wylogowania.', error);
    }
    showToast('Wylogowano.', 'info', 2000);
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
  });
  saveAndRefreshAdmin();
  if (window.leagueStore?.loadState === 'missing') {
    saveLeagueData(leagueData)
      .then(() => showToast('Utworzono pierwszy wspólny zapis danych ligi.', 'success'))
      .catch(error => {
        console.error('Nie udało się utworzyć pierwszego zapisu.', error);
        showToast('Nie udało się utworzyć wspólnego zapisu danych.', 'error', 6000);
      });
  }
}

async function initPage() {
  await window.leagueDataReady;
  const page = document.body.dataset.page || document.documentElement.dataset.page;
  if (page === 'home') return renderHomeTournaments();
  if (page === 'login') return initLoginPage();
  if (page?.startsWith('admin')) {
    if (!await requireAdminAuth()) return;
    return initAdminPanel();
  }
  if (page === 'clubs') return renderClubsPage();
  if (page === 'players') return renderPlayersPage();
  if (page === 'rankings') return renderPublicRankingsPage();
  if (page === 'tournaments') return renderPublicTournamentsPage();
  if (page === 'tournament') return renderTournamentDetailPage();
  if (page === 'calendar') return renderCalendarPage();
  if (page === 'sport') {
    renderSportStandings();
    renderTeams();
    renderResults();
    renderSportTournaments();
    renderMvp();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initHeaderScrollState();
  initStaticForms();
  initPage();
});
