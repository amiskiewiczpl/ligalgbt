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
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    points: 0
  };
}

function applyMatchToRow(row, match, side) {
  const score = parseScore(deriveScore(match));
  const own = side === 'home' ? score.home : score.away;
  const other = side === 'home' ? score.away : score.home;
  const setPairs = parseSetPairs(match.sets);
  row.played += 1;
  row.wins += own > other ? 1 : 0;
  row.losses += own < other ? 1 : 0;
  row.setsWon += own;
  row.setsLost += other;
  row.points += getMatchPoints(match, side);
  setPairs.forEach(([homePoints, awayPoints]) => {
    row.pointsFor += side === 'home' ? homePoints : awayPoints;
    row.pointsAgainst += side === 'home' ? awayPoints : homePoints;
  });
}

function compareBaseStandings(a, b) {
  return b.points - a.points
    || b.wins - a.wins
    || b.setsWon - a.setsWon
    || b.pointsFor - a.pointsFor;
}

function calculateHeadToHeadRows(sportKey, names, level = '') {
  const rows = new Map(names.map(name => [name, createStandingsRow(name, level)]));
  const sport = leagueData.sports[sportKey];
  if (!sport) return [];
  sport.results
    .filter(match => (!level || match.level === level) && names.includes(match.home) && names.includes(match.away))
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

function calculateStandings(sportKey, level = '') {
  const rows = new Map();
  const sport = leagueData.sports[sportKey];
  if (!sport) return [];

  if (sport.type === 'team') {
    leagueData.clubTeams
      .filter(team => team.sport === sportKey && (!level || team.level === level))
      .forEach(team => {
        if (!rows.has(team.name)) rows.set(team.name, createStandingsRow(team.name, team.level || level));
      });
  }

  sport.results
    .filter(match => !level || match.level === level)
    .forEach(match => {
      ['home', 'away'].forEach(side => {
        const name = match[side];
        if (!rows.has(name)) rows.set(name, createStandingsRow(name, match.level || level));
        applyMatchToRow(rows.get(name), match, side);
      });
    });
  return [...rows.values()].sort(compareStandingsRows(sportKey, level));
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

function renderClubsPage() {
  const grid = document.querySelector('.clubs-grid');
  if (!grid) return;
  grid.innerHTML = sortClubs(leagueData.teams).map(team => {
    const participantCount = leagueData.clubTeams.filter(entry => entry.club === team.name).length;
    const playerCount = leagueData.players.filter(player => player.club === team.name).length;
    return `<article class="club-card"><div class="club-header"><h3>${renderLogo(team.name)} ${escapeHtml(team.name)}</h3><p class="club-city">${escapeHtml(team.city)}</p></div><p class="club-description">${escapeHtml(team.description)}</p><div class="club-stats"><div class="stat"><span class="stat-label">Drużyny</span><span class="stat-value">${participantCount}</span></div><div class="stat"><span class="stat-label">Zawodnicy</span><span class="stat-value">${playerCount}</span></div></div></article>`;
  }).join('');
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

function renderStandingsTable(sportKey) {
  const rows = calculateStandings(sportKey);
  if (!rows.length) return '<p class="empty-state">Brak wyników do klasyfikacji.</p>';
  return renderStandingsRows(rows, sportKey);
}

function getStandingsRowStatus(row, index, rows, level) {
  if (!level) return '';
  if (level === 'A' && index === 0) return 'champion';
  if (level !== 'A' && index === 0) return 'promoted';
  if (rows.length > 1 && index === rows.length - 1) return 'relegated';
  return '';
}

function getStandingsStatusLabel(status) {
  return {
    champion: 'Mistrzostwo',
    promoted: 'Awans',
    relegated: 'Spadek'
  }[status] || '';
}

function renderStandingsRows(rows, sportKey, level = '') {
  const body = rows.map((row, index) => {
    const status = getStandingsRowStatus(row, index, rows, level);
    const statusLabel = getStandingsStatusLabel(status);
    return `<tr class="${status ? `standing-${status}` : ''}"><td>${index + 1}</td><td>${renderLogo(row.name)}</td><td><div class="standing-team-cell"><strong>${escapeHtml(row.name)}</strong>${statusLabel ? `<span class="standing-status">${escapeHtml(statusLabel)}</span>` : ''}</div></td><td>${row.played}</td><td>${row.wins}</td><td>${row.losses}</td><td>${row.setsWon}:${row.setsLost}</td><td>${row.pointsFor}:${row.pointsAgainst}</td><td><strong>${row.points}</strong></td></tr>`;
  }).join('');
  const tieBreakers = renderHeadToHeadBreakers(sportKey, rows, level);
  return `<table class="standings-table"><thead><tr><th>#</th><th>Logo</th><th>Drużyna</th><th>M</th><th>W</th><th>P</th><th>Sety</th><th>Małe punkty</th><th>Punkty</th></tr></thead><tbody>${body}</tbody></table>${tieBreakers}`;
}

function renderHeadToHeadBreakers(sportKey, rows, level = '') {
  const groups = getTieGroups(rows);
  if (!groups.length) return '';
  return `<div class="head-to-head-list">${groups.map(group => {
    const names = group.map(row => row.name);
    const directRows = calculateHeadToHeadRows(sportKey, names, level);
    return `<div class="head-to-head-card"><h4>Bilans bezpośredni: ${names.map(escapeHtml).join(' / ')}</h4><table><thead><tr><th>Drużyna</th><th>M</th><th>W</th><th>Sety</th><th>Małe punkty</th><th>Punkty</th></tr></thead><tbody>${directRows.map(row => `<tr><td>${escapeHtml(row.name)}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.setsWon}:${row.setsLost}</td><td>${row.pointsFor}:${row.pointsAgainst}</td><td>${row.points}</td></tr>`).join('')}</tbody></table></div>`;
  }).join('')}</div>`;
}

function renderSportStandings() {
  const sportKey = getSportKey();
  const section = document.getElementById('sport-standings');
  if (!section || !sportKey) return;
  const sport = leagueData.sports[sportKey];
  if (!sport) return;
  if (sport.type !== 'team' || !sport.levels?.length) {
    section.innerHTML = renderStandingsTable(sportKey);
    return;
  }
  section.innerHTML = `<div class="standings-legend"><span class="legend-champion">Mistrz poziomu A</span><span class="legend-promoted">Awans</span><span class="legend-relegated">Spadek</span></div>${sport.levels.map(level => {
    const rows = calculateStandings(sportKey, level);
    const empty = `<p class="empty-state">Brak drużyn zapisanych na poziom ${escapeHtml(level)}.</p>`;
    return `<article class="level-standings"><div class="level-standings-header"><span class="eyebrow">Poziom</span><h3>${escapeHtml(level)}</h3></div>${rows.length ? renderStandingsRows(rows, sportKey, level) : empty}</article>`;
  }).join('')}`;
}

function renderPublicRankingsPage() {
  const main = document.querySelector('main.container');
  if (!main) return;
  const legend = sortClubs(leagueData.teams).map(team => `<span>${renderLogo(team.name)} ${escapeHtml(team.name)}</span>`).join('');
  const sportSections = Object.keys(leagueData.sports).map(key => {
    const sport = leagueData.sports[key];
    const resultRows = sport.results.length
      ? sport.results.map(match => `<tr><td>${escapeHtml(match.level || '-')}</td><td>${escapeHtml(match.home)}</td><td>${renderLogo(match.home)}</td><td><strong>${escapeHtml(deriveScore(match))}</strong></td><td>${escapeHtml(match.sets || '-')}</td><td>${renderLogo(match.away)}</td><td>${escapeHtml(match.away)}</td><td>${escapeHtml(match.mvp || '-')}</td></tr>`).join('')
      : '<tr><td colspan="8">Brak wyników.</td></tr>';
    const mvpRows = calculateMvpRows(key);
    return `<section class="rankings-section"><h2>${escapeHtml(sport.name)}</h2><div class="rankings-container"><div class="ranking-view"><h3>Klasyfikacja</h3>${renderStandingsTable(key)}</div><div class="ranking-view"><h3>Wyniki meczów</h3><table><thead><tr><th>Poziom</th><th>Uczestnik 1</th><th>Logo</th><th>Wynik</th><th>Sety</th><th>Logo</th><th>Uczestnik 2</th><th>MVP</th></tr></thead><tbody>${resultRows}</tbody></table></div><div class="ranking-view"><h3>MVP z meczów</h3>${mvpRows.length ? `<table><thead><tr><th>#</th><th>Zawodnik</th><th>Klub</th><th>Logo</th><th>Wybory</th></tr></thead><tbody>${mvpRows.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.player)}</td><td>${escapeHtml(row.club)}</td><td>${renderLogo(row.club)}</td><td><strong>${row.awards}</strong></td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">Brak MVP.</p>'}</div></div></section>`;
  }).join('');
  const tournaments = renderTournamentSections();
  main.innerHTML = `<section class="page-intro"><span class="eyebrow">Wyniki</span><h2>Klasyfikacje liczone automatycznie</h2><p>Siatkówka: 3:0 i 3:1 dają 3 punkty, 3:2 daje 2 punkty, porażka 2:3 daje 1 punkt. Tryb turniejowy może liczyć wygrane sety jako punkty.</p></section><section class="legend-strip" aria-label="Legenda klubów">${legend}</section>${sportSections}${tournaments}`;
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

function renderTournamentGroupTable(tournament, group, isFinalGroup = false) {
  const standings = globalThis.tournamentEngine
    ? globalThis.tournamentEngine.calculateGroupStandings(group, {
      tieBreakOrder: tournament.groupConfig?.tieBreakOrder,
      manualTieBreaks: group.manualTieBreaks
    })
    : [];
  if (!standings.length) return '<p class="empty-state">Brak uczestników w grupie.</p>';
  const qualifiers = isFinalGroup ? 0 : Number(tournament.groupConfig?.qualifiersPerGroup) || 0;
  return `<div class="tournament-table-scroll"><table class="tournament-group-table"><thead><tr><th>#</th><th>Uczestnik</th><th>M</th><th>W</th><th>R</th><th>P</th><th>Sety</th><th>Małe punkty</th><th>Pkt</th></tr></thead><tbody>${standings.map(row => {
    const name = getTournamentParticipantName(tournament, row.participantId);
    return `<tr class="${row.position <= qualifiers ? 'is-qualified' : ''}"><td>${row.position}</td><td><div class="tournament-participant">${renderLogo(name)}<strong>${escapeHtml(name)}</strong></div></td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.setsWon}:${row.setsLost}</td><td>${row.pointsFor}:${row.pointsAgainst}</td><td><strong>${row.points}</strong></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderTournamentMatchRows(tournament, matches) {
  if (!matches?.length) return '<p class="empty-state">Terminarz nie został jeszcze wygenerowany.</p>';
  return `<div class="tournament-match-list">${matches.map(match => {
    const home = getTournamentParticipantName(tournament, match.homeId, match.home);
    const away = getTournamentParticipantName(tournament, match.awayId, match.away);
    const score = match.status === 'completed' ? (match.score || deriveScore(match)) : '–';
    const status = match.status === 'completed' ? 'Zakończony' : match.status === 'bye' ? 'Wolny los' : 'Zaplanowany';
    return `<article class="tournament-match-row"><span class="tournament-match-status">${status}</span><div class="tournament-match-side">${home ? renderLogo(home) : ''}<strong>${escapeHtml(home || 'Do ustalenia')}</strong></div><span class="tournament-match-score">${escapeHtml(score)}</span><div class="tournament-match-side tournament-match-side-away"><strong>${escapeHtml(away || 'Do ustalenia')}</strong>${away ? renderLogo(away) : ''}</div>${match.sets ? `<small>${escapeHtml(match.sets)}</small>` : ''}</article>`;
  }).join('')}</div>`;
}

function renderTournamentGroups(tournament) {
  const groups = [...(tournament.groups || [])];
  if (tournament.finalGroup) groups.push(tournament.finalGroup);
  if (!groups.length) return '';
  return `<section class="tournament-stage"><div class="tournament-stage-heading"><div><span class="eyebrow">Faza grupowa</span><h3>Grupy i tabele</h3></div><span class="tournament-stage-note">${Number(tournament.groupConfig?.matchesPerPair) === 2 ? 'Mecz i rewanż' : 'Jeden mecz każdej pary'}</span></div><div class="tournament-groups-grid">${groups.map(group => {
    const isFinalGroup = group === tournament.finalGroup;
    return `<article class="tournament-group${isFinalGroup ? ' is-final-group' : ''}"><div class="tournament-group-header"><h4>${escapeHtml(group.name)}</h4><span>${group.participantIds?.length || group.participants?.length || 0} uczestników</span></div>${renderTournamentGroupTable(tournament, group, isFinalGroup)}<div class="tournament-group-matches"><h5>Mecze</h5>${renderTournamentMatchRows(tournament, group.matches)}</div></article>`;
  }).join('')}</div></section>`;
}

function getBracketSideScore(match, side) {
  if (match.status === 'bye') return side === 'home' ? 'BYE' : '–';
  if (match.status !== 'completed') return '–';
  const score = parseScore(match.score || deriveScore(match));
  return side === 'home' ? String(score.home) : String(score.away);
}

function renderTournamentBracket(tournament) {
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
    return `<article class="bracket-game ${match.status === 'completed' || match.status === 'bye' ? 'is-complete' : ''}"><span class="bracket-game-number">Mecz ${match.matchIndex + 1}</span><div class="${match.winnerId && match.winnerId === match.homeId ? 'is-winner' : ''}"><span>${home ? renderLogo(home) : ''}${escapeHtml(home || 'Do ustalenia')}</span><strong>${escapeHtml(getBracketSideScore(match, 'home'))}</strong></div><div class="${match.winnerId && match.winnerId === match.awayId ? 'is-winner' : ''}"><span>${away ? renderLogo(away) : ''}${escapeHtml(away || 'Do ustalenia')}</span><strong>${escapeHtml(getBracketSideScore(match, 'away'))}</strong></div>${match.sets ? `<small>${escapeHtml(match.sets)}</small>` : ''}</article>`;
  }).join('')}</div></section>`).join('')}</div></div>${thirdPlace ? `<div class="tournament-third-place"><h4>Mecz o 3. miejsce</h4>${renderTournamentMatchRows(tournament, [thirdPlace])}</div>` : ''}</section>`;
}

function renderTournamentFlow(tournament) {
  if (tournament.format === 'knockout') return '';
  const finalLabel = tournament.format === 'groups_final_group' ? 'Grupa finałowa' : 'Drabinka play-off';
  const groupCount = tournament.groups?.length || tournament.groupConfig?.groupCount || 0;
  return `<div class="tournament-flow" aria-label="Przebieg turnieju"><span>${groupCount} ${groupCount === 1 ? 'grupa' : 'grupy'}</span><i aria-hidden="true"></i><span>${Number(tournament.groupConfig?.qualifiersPerGroup) || 1} awansujących z grupy</span><i aria-hidden="true"></i><strong>${finalLabel}</strong></div>`;
}

function renderTournamentFull(tournament) {
  return `<article class="tournament-detail-view"><header class="tournament-detail-header"><div><span class="eyebrow">${escapeHtml(getSportName(tournament.sport))}</span><h2>${escapeHtml(tournament.name)}</h2><p>${escapeHtml(getTournamentFormatLabel(tournament.format))} · ${escapeHtml(getTournamentStatusLabel(tournament.status))}</p></div><div class="tournament-meta"><span>${tournament.participants?.length || 0} uczestników</span><span>${tournament.allowDraws ? 'Remis 1:1 dozwolony' : 'Bez remisów'}</span></div></header>${renderTournamentFlow(tournament)}${renderTournamentGroups(tournament)}${renderTournamentBracket(tournament)}<section class="tournament-stage"><div class="tournament-stage-heading"><div><span class="eyebrow">Podsumowanie</span><h3>Klasyfikacja końcowa</h3></div></div>${renderTournamentClassification(tournament)}</section></article>`;
}

function renderTournamentSummary(tournament) {
  const completedMatches = [
    ...(tournament.groups || []).flatMap(group => group.matches || []),
    ...(tournament.finalGroup?.matches || []),
    ...(tournament.bracket || [])
  ].filter(match => match.status === 'completed').length;
  return `<article class="tournament-summary"><div class="tournament-summary-header"><div><span class="eyebrow">${escapeHtml(getSportName(tournament.sport))}</span><h3>${escapeHtml(tournament.name)}</h3></div><span class="tournament-status tournament-status-${escapeHtml(tournament.status)}">${escapeHtml(getTournamentStatusLabel(tournament.status))}</span></div><div class="tournament-summary-meta"><span>${escapeHtml(getTournamentFormatLabel(tournament.format))}</span><span>${tournament.participants?.length || 0} uczestników</span><span>${completedMatches} rozegranych meczów</span></div>${renderTournamentClassification(tournament, true)}<a class="button button-alt compact-button" href="turniej.html?id=${encodeURIComponent(tournament.id)}">Zobacz grupy i drabinkę</a></article>`;
}

function renderTournamentSections() {
  if (!leagueData.tournaments.length) return '';
  return `<section class="rankings-section"><div class="section-lead"><span class="eyebrow">Turnieje</span><h2>Końcowe klasyfikacje</h2><p>Pełne grupy, wyniki i drabinki są dostępne w szczegółach każdego turnieju.</p></div><div class="tournament-summary-list">${sortTournaments(leagueData.tournaments).map(renderTournamentSummary).join('')}</div></section>`;
}

function renderSportTournaments() {
  const container = document.getElementById('sport-tournaments');
  const sportKey = getSportKey();
  if (!container || !sportKey) return;
  const tournaments = sortTournaments(leagueData.tournaments.filter(tournament => tournament.sport === sportKey));
  container.innerHTML = tournaments.length
    ? `<div class="tournament-detail-list">${tournaments.map(renderTournamentFull).join('')}</div>`
    : '<p class="empty-state">Brak turniejów dla tej dyscypliny.</p>';
}

function renderHomeTournaments() {
  const container = document.getElementById('home-tournaments');
  const section = document.getElementById('home-tournaments-section');
  if (!container) return;
  if (!leagueData.tournaments.length) {
    if (section) section.hidden = true;
    return;
  }
  container.innerHTML = `<div class="tournament-summary-list">${sortTournaments(leagueData.tournaments).map(renderTournamentSummary).join('')}</div>`;
}

function renderTournamentDetailPage() {
  const container = document.getElementById('tournament-detail');
  if (!container) return;
  const tournamentId = new URLSearchParams(window.location.search).get('id');
  const tournament = leagueData.tournaments.find(item => String(item.id) === String(tournamentId));
  if (!tournament) {
    container.innerHTML = '<section class="page-intro"><span class="eyebrow">Turniej</span><h2>Nie znaleziono turnieju</h2><p>Sprawdź adres albo wróć do listy wyników.</p><a class="button compact-button" href="klasyfikacje.html">Wróć do wyników</a></section>';
    return;
  }
  document.title = `${tournament.name} | Liga LGBT`;
  container.innerHTML = renderTournamentFull(tournament);
}

function saveAndRefreshAdmin(message) {
  renderAdminDashboard();
  renderAdminStandings();
  renderAdminTeams();
  renderAdminClubTeams();
  renderAdminPlayers();
  renderAdminResults();
  renderAdminTournaments();
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
  navigation.querySelectorAll('[data-admin-page]').forEach(link => {
    if (link.dataset.adminPage === page) link.setAttribute('aria-current', 'page');
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
  container.innerHTML = Object.keys(leagueData.sports).map(key => `<div class="admin-table-block"><h4>${escapeHtml(getSportName(key))}</h4>${renderStandingsTable(key)}</div>`).join('');
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

function renderAdminResults() {
  const editor = document.getElementById('results-editor');
  if (!editor) return;
  const tournamentRows = sortTournaments(leagueData.tournaments).flatMap(tournament => (
    getTournamentPhaseEntries(tournament).flatMap(phase => (
      phase.matches.map(match => {
        const completed = match.status === 'completed';
        const canEdit = match.status !== 'bye' && match.home && match.away;
        return `<tr><td>${escapeHtml(tournament.name)}</td><td>${escapeHtml(getSportName(tournament.sport))}</td><td>${escapeHtml(phase.label)}</td><td>${escapeHtml(match.home || 'Do ustalenia')}</td><td><strong>${completed ? escapeHtml(deriveScore(match)) : '-'}</strong></td><td>${escapeHtml(match.away || 'Do ustalenia')}</td><td>${escapeHtml(match.mvp || '-')}</td><td><div class="table-actions">${canEdit ? `<button type="button" class="compact-button edit-tournament-result" data-tournament="${escapeHtml(tournament.id)}" data-phase="${escapeHtml(phase.key)}" data-match="${escapeHtml(match.id)}">${completed ? 'Edytuj' : 'Wpisz wynik'}</button>` : ''}${completed ? `<button type="button" class="compact-button danger-button clear-tournament-result" data-tournament="${escapeHtml(tournament.id)}" data-phase="${escapeHtml(phase.key)}" data-match="${escapeHtml(match.id)}">Wyczyść</button>` : ''}</div></td></tr>`;
      })
    ))
  ));
  editor.innerHTML = `<form id="result-form" class="admin-form"><input type="hidden" name="id" /><input type="hidden" name="originalSport" /><fieldset><legend>Dodaj lub edytuj wynik</legend><div class="admin-form-grid result-form-flow"><label>Dyscyplina<select name="sport" required>${getSportOptions()}</select></label><label>Rodzaj rozgrywek<select name="competition" required><option value="league">Liga</option><option value="tournament">Turniej</option></select></label><label data-result-field="level">Poziom<select name="level"></select></label><label data-result-field="tournament" hidden>Turniej<select name="tournament"></select></label><label data-result-field="phase" hidden>Faza<select name="phase"></select></label><label data-result-field="match" hidden>Mecz<select name="match"></select></label><label>Uczestnik 1<select name="home" required></select></label><label>Uczestnik 2<select name="away" required></select></label><label>Format wyniku<select name="score" required></select></label><label>MVP meczu<select name="mvp"><option value="">Brak</option></select></label></div><p class="result-context-note" id="result-context-note"></p><div class="set-fields" id="set-fields"></div><div class="admin-actions"><button type="submit">Zapisz wynik</button><button type="reset" class="button-secondary">Wyczyść formularz</button></div></fieldset></form>${Object.keys(leagueData.sports).map(key => {
    const sport = leagueData.sports[key];
    const rows = sport.results.length ? sport.results.map(match => `<tr><td>${escapeHtml(sport.name)}</td><td>${escapeHtml(match.level || '-')}</td><td>${escapeHtml(match.home)}</td><td>${renderLogo(match.home)}</td><td><strong>${escapeHtml(deriveScore(match))}</strong></td><td>${escapeHtml(match.sets || '-')}</td><td>${renderLogo(match.away)}</td><td>${escapeHtml(match.away)}</td><td>${escapeHtml(match.mvp || '-')}</td><td><div class="table-actions"><button type="button" class="compact-button edit-result" data-sport="${key}" data-id="${match.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-result" data-sport="${key}" data-id="${match.id}">Usuń</button></div></td></tr>`).join('') : `<tr><td colspan="10">Brak wyników: ${escapeHtml(sport.name)}</td></tr>`;
    return `<div class="admin-table-block"><h4>${escapeHtml(sport.name)}</h4><table><thead><tr><th>Dyscyplina</th><th>Poziom</th><th>Uczestnik 1</th><th>Logo</th><th>Wynik</th><th>Sety</th><th>Logo</th><th>Uczestnik 2</th><th>MVP</th><th>Akcje</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('')}<div class="admin-table-block"><h4>Wyniki turniejowe</h4><table><thead><tr><th>Turniej</th><th>Dyscyplina</th><th>Faza</th><th>Uczestnik 1</th><th>Wynik</th><th>Uczestnik 2</th><th>MVP</th><th>Akcje</th></tr></thead><tbody>${tournamentRows.length ? tournamentRows.join('') : '<tr><td colspan="8">Brak wygenerowanych meczów turniejowych.</td></tr>'}</tbody></table></div>`;
  const form = editor.querySelector('#result-form');
  const setFields = editor.querySelector('#set-fields');
  const contextNote = editor.querySelector('#result-context-note');
  const fields = {
    id: form.elements.namedItem('id'),
    originalSport: form.elements.namedItem('originalSport'),
    sport: form.elements.namedItem('sport'),
    competition: form.elements.namedItem('competition'),
    level: form.elements.namedItem('level'),
    tournament: form.elements.namedItem('tournament'),
    phase: form.elements.namedItem('phase'),
    match: form.elements.namedItem('match'),
    home: form.elements.namedItem('home'),
    away: form.elements.namedItem('away'),
    score: form.elements.namedItem('score'),
    mvp: form.elements.namedItem('mvp')
  };
  const fieldWrappers = Object.fromEntries(
    [...form.querySelectorAll('[data-result-field]')].map(node => [node.dataset.resultField, node])
  );

  function clearEditReference() {
    fields.id.value = '';
    fields.originalSport.value = '';
  }

  function refreshScoreFields(score = fields.score.value, sets = '') {
    setFields.innerHTML = renderSetInputs(score, sets);
  }

  function refreshMvpOptions(mvp = '') {
    fields.mvp.innerHTML = `<option value="">Brak</option>${getMatchMvpOptions(fields.sport.value, fields.home.value, fields.away.value, mvp)}`;
  }

  function setParticipants(home = '', away = '', locked = false) {
    if (locked) {
      fields.home.innerHTML = home
        ? `<option value="${escapeHtml(home)}">${escapeHtml(home)}</option>`
        : '<option value="">Do ustalenia</option>';
      fields.away.innerHTML = away
        ? `<option value="${escapeHtml(away)}">${escapeHtml(away)}</option>`
        : '<option value="">Do ustalenia</option>';
      fields.home.setAttribute('aria-readonly', 'true');
      fields.away.setAttribute('aria-readonly', 'true');
      return;
    }
    fields.home.removeAttribute('aria-readonly');
    fields.away.removeAttribute('aria-readonly');
    const participants = getLeagueParticipants(fields.sport.value, fields.level.value);
    fields.home.innerHTML = getFilteredParticipantOptions(participants, home, away, 'Wybierz uczestnika 1');
    fields.away.innerHTML = getFilteredParticipantOptions(participants, away, fields.home.value, 'Wybierz uczestnika 2');
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
    setParticipants(options.home || '', options.away || '');
    const scoring = sport?.defaultScoring || 'volleyball';
    form.dataset.scoring = scoring;
    fields.score.innerHTML = getScoreOptions(scoring, options.score || '', { allowDraw: false });
    refreshScoreFields(fields.score.value, options.sets || '');
    refreshMvpOptions(options.mvp || '');
    contextNote.textContent = levels.length
      ? 'Lista uczestników jest ograniczona do drużyn zapisanych na wybrany poziom.'
      : 'Lista uczestników jest ograniczona do zawodników wybranej dyscypliny.';
  }

  function refreshTournamentMatch(options = {}) {
    const tournament = leagueData.tournaments.find(item => String(item.id) === String(fields.tournament.value));
    const selection = getTournamentMatchSelection(tournament, fields.phase.value, fields.match.value);
    const match = selection.match;
    setParticipants(match?.home || '', match?.away || '', true);
    if (!match) {
      form.dataset.scoring = tournament?.scoring || 'sets';
      form.dataset.allowDraw = 'false';
      fields.score.innerHTML = '<option value="">Najpierw wybierz mecz</option>';
      fields.mvp.innerHTML = '<option value="">Brak</option>';
      setFields.innerHTML = '';
      contextNote.textContent = 'Wybierz mecz z wygenerowanego terminarza.';
      return;
    }
    const scoring = match?.scoring || tournament?.scoring || 'sets';
    const allowDraw = Boolean(match?.allowDraw && selection.phase?.type !== 'knockout');
    form.dataset.scoring = scoring;
    form.dataset.allowDraw = String(allowDraw);
    fields.score.innerHTML = getScoreOptions(scoring, options.score || match?.score || '', { allowDraw });
    refreshScoreFields(fields.score.value, options.sets ?? match?.sets ?? '');
    refreshMvpOptions(options.mvp ?? match?.mvp ?? '');
    const drawNote = allowDraw ? ' Remis 1:1 jest dozwolony w tej fazie.' : ' Ta faza wymaga rozstrzygnięcia meczu.';
    contextNote.textContent = `${selection.phase.label}: ${match.home || 'do ustalenia'} - ${match.away || 'do ustalenia'}.${drawNote}`;
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
    refreshTournamentMatch(options);
  }

  function refreshTournamentPhaseOptions(selectedPhase = '', selectedMatch = '', options = {}) {
    const tournament = leagueData.tournaments.find(item => String(item.id) === String(fields.tournament.value));
    const phases = getTournamentPhaseEntries(tournament);
    fields.phase.innerHTML = `<option value="">Wybierz fazę</option>${phases.map(phase => `<option value="${escapeHtml(phase.key)}" ${phase.key === selectedPhase ? 'selected' : ''}>${escapeHtml(phase.label)}</option>`).join('')}`;
    refreshTournamentMatchOptions(selectedMatch, options);
    if (tournament && !phases.length) contextNote.textContent = 'Ten turniej nie ma jeszcze wygenerowanego terminarza.';
  }

  function refreshTournamentOptions(selectedTournament = '', selectedPhase = '', selectedMatch = '', options = {}) {
    const tournaments = getTournamentsForSport(fields.sport.value);
    fields.tournament.innerHTML = `<option value="">Wybierz turniej</option>${tournaments.map(tournament => `<option value="${escapeHtml(tournament.id)}" ${String(tournament.id) === String(selectedTournament) ? 'selected' : ''}>${escapeHtml(tournament.name)}</option>`).join('')}`;
    refreshTournamentPhaseOptions(selectedPhase, selectedMatch, options);
    if (!tournaments.length) contextNote.textContent = 'Brak turniejów dla wybranej dyscypliny.';
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
    clearEditReference();
    fields.competition.value = 'league';
    fields.level.value = '';
    refreshMode();
  }

  refreshMode();
  fields.sport.addEventListener('change', () => {
    clearEditReference();
    refreshMode();
  });
  fields.competition.addEventListener('change', () => {
    clearEditReference();
    refreshMode();
  });
  fields.level.addEventListener('change', () => {
    setParticipants();
    refreshMvpOptions();
    contextNote.textContent = 'Po zmianie poziomu uczestnicy i MVP zostali wyczyszczeni.';
  });
  fields.tournament.addEventListener('change', () => refreshTournamentPhaseOptions());
  fields.phase.addEventListener('change', () => refreshTournamentMatchOptions());
  fields.match.addEventListener('change', () => refreshTournamentMatch());
  fields.score.addEventListener('change', () => refreshScoreFields(fields.score.value));
  fields.home.addEventListener('change', () => {
    const participants = getLeagueParticipants(fields.sport.value, fields.level.value);
    const selectedAway = fields.away.value === fields.home.value ? '' : fields.away.value;
    fields.away.innerHTML = getFilteredParticipantOptions(participants, selectedAway, fields.home.value, 'Wybierz uczestnika 2');
    refreshMvpOptions();
  });
  fields.away.addEventListener('change', () => refreshMvpOptions());
  form.addEventListener('reset', () => setTimeout(resetFormState));

  form.addEventListener('submit', event => {
    event.preventDefault();
    const sportKey = fields.sport.value;
    const competition = fields.competition.value;
    const scoring = form.dataset.scoring || leagueData.sports[sportKey]?.defaultScoring || 'sets';
    const payload = {
      level: competition === 'league' ? fields.level.value.trim() : '',
      home: fields.home.value,
      away: fields.away.value,
      score: fields.score.value,
      sets: collectSetScores(form),
      scoring,
      phaseType: competition === 'league' ? 'league' : '',
      allowDraw: competition === 'tournament' && form.dataset.allowDraw === 'true',
      pointsRules: competition === 'tournament'
        ? { win: 3, draw: 1, loss: 0 }
        : { win: 3, draw: 0, loss: 0 },
      status: 'completed',
      mvp: fields.mvp.value
    };

    if (competition === 'league') {
      const selection = validateLeagueMatchSelection(sportKey, payload.level, payload.home, payload.away);
      if (!selection.valid) return showToast(selection.message, 'warning');
      const resultValidation = validateMatchResult(payload, { allowDraw: false });
      if (!resultValidation.valid) return showToast(resultValidation.message, 'warning', 6000);
      const allowedMvp = getMatchMvpNames(sportKey, payload.home, payload.away);
      if (payload.mvp && !allowedMvp.includes(payload.mvp)) {
        return showToast('MVP musi być zawodnikiem jednej z grających drużyn.', 'warning');
      }
      const id = Number(fields.id.value);
      const originalSport = fields.originalSport.value;
      if (id && originalSport && originalSport !== sportKey && leagueData.sports[originalSport]) {
        leagueData.sports[originalSport].results = leagueData.sports[originalSport].results.filter(match => match.id !== id);
      }
      const sport = leagueData.sports[sportKey];
      const existing = originalSport && originalSport !== sportKey ? null : sport.results.find(match => match.id === id);
      if (existing) Object.assign(existing, payload);
      else sport.results.push({ id: Math.max(0, ...sport.results.map(match => Number(match.id) || 0)) + 1, ...payload });
      saveAndRefreshAdmin(existing ? 'Wynik został zaktualizowany.' : 'Dodano wynik.');
      return;
    }

    const tournament = leagueData.tournaments.find(item => (
      String(item.id) === String(fields.tournament.value)
      && item.sport === sportKey
    ));
    const selection = validateTournamentMatchSelection(tournament, fields.phase.value, fields.match.value);
    if (!selection.valid) return showToast(selection.message, 'warning', 6000);
    if (selection.match.home !== payload.home || selection.match.away !== payload.away) {
      return showToast('Uczestnicy nie zgadzają się z parą zapisaną w terminarzu.', 'warning');
    }
    payload.phaseType = selection.phase.type;
    payload.allowDraw = Boolean(selection.match.allowDraw && selection.phase.type !== 'knockout');
    payload.pointsRules = tournament.pointsRules;
    const tournamentValidation = validateMatchResult(payload, { allowDraw: payload.allowDraw });
    if (!tournamentValidation.valid) return showToast(tournamentValidation.message, 'warning', 6000);
    const allowedMvp = getMatchMvpNames(sportKey, payload.home, payload.away);
    if (payload.mvp && !allowedMvp.includes(payload.mvp)) {
      return showToast('MVP musi być zawodnikiem jednej z grających drużyn.', 'warning');
    }
    try {
      if (selection.phase.type === 'knockout') {
        globalThis.tournamentEngine.recordKnockoutResult(
          tournament.bracket,
          selection.match.id,
          payload,
          { names: getTournamentParticipantNames(tournament) }
        );
      } else {
        globalThis.tournamentEngine.recordGroupResult(selection.phase.container, selection.match.id, payload);
      }
      normalizeTournament(tournament, leagueData);
      saveAndRefreshAdmin('Wynik turniejowy został zapisany.');
    } catch (error) {
      showToast(error.message || 'Nie udało się zapisać wyniku turniejowego.', 'warning', 6000);
    }
  });

  editor.querySelectorAll('.edit-result').forEach(button => button.addEventListener('click', () => {
    const sportKey = button.dataset.sport;
    const match = leagueData.sports[sportKey].results.find(item => item.id === Number(button.dataset.id));
    if (!match) return;
    fields.id.value = match.id;
    fields.originalSport.value = sportKey;
    fields.sport.value = sportKey;
    fields.competition.value = 'league';
    refreshMode({
      level: match.level || '',
      home: match.home,
      away: match.away,
      score: deriveScore(match),
      sets: match.sets || '',
      mvp: match.mvp || ''
    });
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  editor.querySelectorAll('.delete-result').forEach(button => button.addEventListener('click', () => {
    const sportKey = button.dataset.sport;
    leagueData.sports[sportKey].results = leagueData.sports[sportKey].results.filter(match => match.id !== Number(button.dataset.id));
    saveAndRefreshAdmin('Wynik został usunięty.');
  }));

  editor.querySelectorAll('.edit-tournament-result').forEach(button => button.addEventListener('click', () => {
    const tournament = leagueData.tournaments.find(item => String(item.id) === button.dataset.tournament);
    if (!tournament) return;
    fields.sport.value = tournament.sport;
    fields.competition.value = 'tournament';
    clearEditReference();
    refreshMode({
      tournament: tournament.id,
      phase: button.dataset.phase,
      match: button.dataset.match
    });
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  editor.querySelectorAll('.clear-tournament-result').forEach(button => button.addEventListener('click', () => {
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

function renderAdminTournaments() {
  const editor = document.getElementById('tournaments-editor');
  if (!editor) return;
  const sortedTournaments = sortTournaments(leagueData.tournaments);
  editor.innerHTML = `<form id="tournament-form" class="admin-form"><input type="hidden" name="id" /><fieldset><legend>Dodaj lub edytuj turniej</legend><div class="admin-form-grid"><label>Nazwa turnieju<input type="text" name="name" required placeholder="np. Letni Puchar Tenisa" /></label><label>Dyscyplina<select name="sport" required>${getSportOptions('tenis')}</select></label><label>Status<select name="status"><option value="planned">Planowany</option><option value="ongoing">W trakcie</option><option value="completed">Zakończony</option></select></label><label>Zapisani uczestnicy<select name="participants" multiple size="7" required></select></label></div><p class="form-hint">Uczestnicy są pobierani wyłącznie z zawodników lub drużyn przypisanych do wybranej dyscypliny.</p><label>Klasyfikacja końcowa<textarea name="finalClassification" required placeholder="1|Dariusz Karpuk&#10;2|Krzysztof Sobanowski"></textarea></label><label>Drabinka<textarea name="bracket" required placeholder="Półfinał|Dariusz Karpuk|2:0|Sebastian Górski&#10;Finał|Dariusz Karpuk|2:1|Krzysztof Sobanowski"></textarea></label><p class="form-hint">W klasyfikacji i drabince można użyć tylko osób zaznaczonych na liście zapisanych uczestników.</p><div class="admin-actions"><button type="submit">Zapisz turniej</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form><div class="admin-table-block"><h4>Turnieje</h4><table><thead><tr><th>Nazwa</th><th>Dyscyplina</th><th>Status</th><th>Uczestnicy</th><th>Klasyfikacja</th><th>Mecze drabinki</th><th>Akcje</th></tr></thead><tbody>${sortedTournaments.length ? sortedTournaments.map(tournament => `<tr><td>${escapeHtml(tournament.name)}</td><td>${escapeHtml(getSportName(tournament.sport))}</td><td>${escapeHtml(tournament.status || '-')}</td><td>${escapeHtml((tournament.participants || []).join(', ') || '-')}</td><td>${escapeHtml((tournament.finalClassification || []).map(row => `${row.place}. ${row.participant}`).join(', ') || '-')}</td><td>${(tournament.bracket || []).length}</td><td><div class="table-actions"><button type="button" class="compact-button edit-tournament" data-id="${tournament.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-tournament" data-id="${tournament.id}">Usuń</button></div></td></tr>`).join('') : '<tr><td colspan="7">Brak turniejów.</td></tr>'}</tbody></table></div>`;
  const form = editor.querySelector('#tournament-form');
  function refreshTournamentParticipants(selected = []) {
    form.participants.innerHTML = getTournamentParticipantOptions(form.sport.value, selected);
  }
  refreshTournamentParticipants();
  form.sport.addEventListener('change', () => refreshTournamentParticipants());
  form.addEventListener('reset', () => {
    setTimeout(() => refreshTournamentParticipants());
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = Number(data.get('id'));
    const existing = leagueData.tournaments.find(tournament => tournament.id === id);
    const sportKey = data.get('sport').toString();
    const participants = data.getAll('participants').map(item => item.toString());
    const participantSet = new Set(participants);
    const finalClassification = parseClassificationText(data.get('finalClassification').toString())
      .map(row => ({ ...row, club: getParticipantClubName(row.participant) }));
    const bracket = parseBracketText(data.get('bracket').toString());
    const invalidClassification = finalClassification.some(row => !participantSet.has(row.participant));
    const invalidBracket = bracket.some(match => !participantSet.has(match.home) || !participantSet.has(match.away));
    const duplicateClassification = new Set(finalClassification.map(row => row.participant)).size !== finalClassification.length;
    const selfMatch = bracket.some(match => match.home === match.away);
    const format = existing?.format || 'knockout';
    const allowDraws = typeof existing?.allowDraws === 'boolean'
      ? existing.allowDraws
      : format !== 'knockout';
    const invalidDraw = bracket.some(match => match.score === '1:1' && !allowDraws);
    const payload = {
      name: data.get('name').toString().trim(),
      sport: sportKey,
      format,
      participantType: leagueData.sports[sportKey]?.type === 'team' ? 'team' : 'player',
      scoring: 'sets',
      seeding: existing?.seeding || 'manual',
      status: data.get('status').toString().trim() || 'completed',
      allowDraws,
      pointsRules: existing?.pointsRules || { win: 3, draw: 1, loss: 0 },
      groupConfig: existing?.groupConfig || structuredClone(DEFAULT_GROUP_CONFIG),
      finalStageConfig: existing?.finalStageConfig || structuredClone(DEFAULT_FINAL_STAGE_CONFIG),
      groups: existing?.groups || [],
      participants,
      finalClassification,
      bracket
    };
    if (participants.length < 2) return showToast('Wybierz co najmniej dwóch zapisanych uczestników turnieju.', 'warning');
    if (participants.some(name => !isEligibleParticipant(sportKey, name))) {
      return showToast('Lista zawiera uczestnika nieprzypisanego do wybranej dyscypliny.', 'warning');
    }
    if (invalidClassification || invalidBracket) {
      return showToast('Klasyfikacja i drabinka mogą zawierać tylko zapisanych uczestników turnieju.', 'warning', 6000);
    }
    if (duplicateClassification) return showToast('Zawodnik może wystąpić w klasyfikacji tylko raz.', 'warning');
    if (selfMatch) return showToast('Uczestnik turnieju nie może grać przeciwko sobie.', 'warning');
    if (invalidDraw) return showToast('Remis 1:1 nie jest dozwolony w fazie play-off.', 'warning');
    if (!payload.name || !payload.finalClassification.length || !payload.bracket.length) return showToast('Uzupełnij nazwę, klasyfikację i drabinkę turnieju.', 'warning');
    if (existing) {
      Object.assign(existing, payload);
      normalizeTournament(existing, leagueData);
      saveAndRefreshAdmin('Turniej został zaktualizowany.');
    } else {
      const tournament = normalizeTournament({
        id: Math.max(0, ...leagueData.tournaments.map(item => item.id)) + 1,
        ...payload
      }, leagueData);
      leagueData.tournaments.push(tournament);
      saveAndRefreshAdmin('Dodano turniej.');
    }
  });
  editor.querySelectorAll('.edit-tournament').forEach(button => button.addEventListener('click', () => {
    const tournament = leagueData.tournaments.find(item => item.id === Number(button.dataset.id));
    if (!tournament) return;
    form.id.value = tournament.id;
    form.name.value = tournament.name;
    form.sport.value = tournament.sport;
    form.status.value = tournament.status || 'completed';
    form.finalClassification.value = stringifyClassification(tournament.finalClassification);
    form.bracket.value = stringifyBracket(tournament.bracket);
    refreshTournamentParticipants(tournament.participants || []);
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  editor.querySelectorAll('.delete-tournament').forEach(button => button.addEventListener('click', () => {
    leagueData.tournaments = leagueData.tournaments.filter(tournament => tournament.id !== Number(button.dataset.id));
    saveAndRefreshAdmin('Turniej został usunięty.');
  }));
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
  if (page === 'tournament') return renderTournamentDetailPage();
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
