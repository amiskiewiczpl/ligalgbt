function getSportKey() {
  return document.body.dataset.sport || document.documentElement.dataset.sport || null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
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
  return leagueData.teams.map(team => `<option value="${escapeHtml(team.name)}" ${team.name === selected ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('');
}

function getSportOptions(selected = '') {
  return Object.keys(leagueData.sports).map(key => `<option value="${key}" ${key === selected ? 'selected' : ''}>${escapeHtml(getSportName(key))}</option>`).join('');
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
    ? leagueData.clubTeams.filter(team => team.sport === sportKey)
    : leagueData.players.filter(player => !player.sports?.length || player.sports.includes(sportKey));
  return source.map(item => {
    const value = item.name;
    const detail = item.club ? ` (${item.club})` : '';
    return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value + detail)}</option>`;
  }).join('');
}

function getPlayerOptions(sportKey, selected = '') {
  return leagueData.players
    .filter(player => !sportKey || !player.sports?.length || player.sports.includes(sportKey))
    .map(player => `<option value="${escapeHtml(player.name)}" ${player.name === selected ? 'selected' : ''}>${escapeHtml(player.name)} (${escapeHtml(player.club)})</option>`)
    .join('');
}

function getPlayersForClub(club) {
  return leagueData.players.filter(player => player.club === club);
}

function getRosterSelectOptions(club, selected = []) {
  const selectedSet = new Set(selected || []);
  const players = getPlayersForClub(club);
  const selectedOnly = [...selectedSet]
    .filter(name => !players.some(player => player.name === name))
    .map(name => ({ name, club }));
  return [...players, ...selectedOnly]
    .map(player => `<option value="${escapeHtml(player.name)}" ${selectedSet.has(player.name) ? 'selected' : ''}>${escapeHtml(player.name)}</option>`)
    .join('');
}

function getTeamSelectOptions(club, selected = []) {
  const selectedSet = new Set(selected || []);
  return leagueData.clubTeams
    .filter(team => team.club === club)
    .map(team => `<option value="${escapeHtml(team.name)}" ${selectedSet.has(team.name) ? 'selected' : ''}>${escapeHtml(team.name)} (${escapeHtml(getSportName(team.sport))}${team.level ? `, ${escapeHtml(team.level)}` : ''})</option>`)
    .join('');
}

function getPlayerTeamNames(playerName) {
  return leagueData.clubTeams
    .filter(team => (team.roster || []).includes(playerName))
    .map(team => team.name);
}

function setPlayerTeams(playerName, teamNames) {
  const selected = new Set(teamNames || []);
  leagueData.clubTeams.forEach(team => {
    const roster = new Set(team.roster || []);
    if (selected.has(team.name)) roster.add(playerName);
    else roster.delete(playerName);
    team.roster = [...roster];
  });
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
    names = [...(homeTeam?.roster || []), ...(awayTeam?.roster || [])];
  } else {
    names = [home, away].filter(Boolean);
  }
  if (selected && !names.includes(selected)) names.push(selected);
  return [...new Set(names)];
}

function getScoreOptions(scoring = 'volleyball', selected = '') {
  const scores = scoring === 'sets' ? ['2:0', '2:1', '0:2', '1:2'] : ['3:0', '3:1', '3:2', '0:3', '1:3', '2:3'];
  return scores.map(score => `<option value="${score}" ${score === selected ? 'selected' : ''}>${score}</option>`).join('');
}

function getSetCountFromScore(score) {
  const parsed = parseScore(score);
  const count = parsed.home + parsed.away;
  return count > 0 ? count : 3;
}

function renderSetInputs(score, sets = '') {
  const pairs = parseSetPairs(sets);
  const count = getSetCountFromScore(score);
  return Array.from({ length: count }, (_, index) => {
    const [home = '', away = ''] = pairs[index] || [];
    return `<div class="set-score-row"><span>Set ${index + 1}</span><label>Drużyna 1<input type="number" min="0" name="setHome" value="${escapeHtml(home)}" required /></label><label>Drużyna 2<input type="number" min="0" name="setAway" value="${escapeHtml(away)}" required /></label></div>`;
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

function renderRoster(roster) {
  if (!roster?.length) return '<p class="empty-state team-roster-empty">Skład nie został jeszcze uzupełniony.</p>';
  return `<div class="team-roster" aria-label="Skład drużyny">${roster.map(player => `<span>${escapeHtml(player)}</span>`).join('')}</div>`;
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

function getMatchPoints(match, side) {
  const scoring = match.scoring || 'volleyball';
  const score = parseScore(deriveScore(match));
  const own = side === 'home' ? score.home : score.away;
  const other = side === 'home' ? score.away : score.home;
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
  return [...rows.values()].sort((a, b) => compareBaseStandings(a, b) || a.name.localeCompare(b.name));
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
  return [...rows.values()].sort((a, b) => b.awards - a.awards || a.player.localeCompare(b.player));
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
  if (!window.leagueStore?.isConfigured) {
    form.querySelector('button[type="submit"]').disabled = true;
    showToast('Baza danych nie jest jeszcze skonfigurowana. Uzupełnij config.js.', 'warning', 8000);
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
    ? leagueData.clubTeams.filter(team => team.sport === sportKey)
    : leagueData.players.filter(player => player.sports?.includes(sportKey));
  section.innerHTML = entries.map(entry => {
    const meta = entry.level ? `${entry.club} · poziom ${entry.level}` : entry.club;
    const description = entry.description ? `<p>${escapeHtml(entry.description)}</p>` : '';
    const roster = sport?.type === 'team' ? `<div class="team-roster-block"><h4>Skład</h4>${renderRoster(entry.roster)}</div>` : '';
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
  grid.innerHTML = leagueData.teams.map(team => {
    const participantCount = leagueData.clubTeams.filter(entry => entry.club === team.name).length;
    const playerCount = leagueData.players.filter(player => player.club === team.name).length;
    return `<article class="club-card"><div class="club-header"><h3>${renderLogo(team.name)} ${escapeHtml(team.name)}</h3><p class="club-city">${escapeHtml(team.city)}</p></div><p class="club-description">${escapeHtml(team.description)}</p><div class="club-stats"><div class="stat"><span class="stat-label">Drużyny</span><span class="stat-value">${participantCount}</span></div><div class="stat"><span class="stat-label">Zawodnicy</span><span class="stat-value">${playerCount}</span></div></div></article>`;
  }).join('');
}

function renderPlayersPage() {
  const grid = document.querySelector('.players-grid');
  if (!grid) return;
  grid.innerHTML = leagueData.players.map(player => {
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
  const legend = leagueData.teams.map(team => `<span>${renderLogo(team.name)} ${escapeHtml(team.name)}</span>`).join('');
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

function renderTournamentSections() {
  if (!leagueData.tournaments.length) return '';
  return `<section class="rankings-section"><h2>Turnieje</h2>${leagueData.tournaments.map(tournament => `<div class="ranking-view"><h3>${escapeHtml(tournament.name)}</h3><p class="empty-state">Na stronie publicznej pokazujemy końcową klasyfikację, a poniżej osobno przebieg drabinki.</p><table><thead><tr><th>Miejsce</th><th>Uczestnik</th><th>Klub</th><th>Logo</th></tr></thead><tbody>${tournament.finalClassification.map(row => `<tr><td>${row.place}</td><td>${escapeHtml(row.participant)}</td><td>${escapeHtml(row.club)}</td><td>${renderLogo(row.club)}</td></tr>`).join('')}</tbody></table><div class="bracket-grid">${tournament.bracket.map(match => `<article class="bracket-match"><span>${escapeHtml(match.round)}</span><strong>${escapeHtml(match.home)} ${escapeHtml(match.score)} ${escapeHtml(match.away)}</strong></article>`).join('')}</div></div>`).join('')}</section>`;
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
  if (!oldName || oldName === newName) return;
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
    sport.results.forEach(match => {
      if (match.mvp === name) match.mvp = '';
    });
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
    .filter(row => row.participant && row.club);
}

function stringifyClassification(rows) {
  return (rows || []).map(row => `${row.place}|${row.participant}|${row.club}`).join('\n');
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

function renderAdminStandings() {
  const container = document.getElementById('admin-standings-preview');
  if (!container) return;
  container.innerHTML = Object.keys(leagueData.sports).map(key => `<div class="admin-table-block"><h4>${escapeHtml(getSportName(key))}</h4>${renderStandingsTable(key)}</div>`).join('');
}

function renderAdminTeams() {
  const editor = document.getElementById('team-editor');
  if (!editor) return;
  editor.innerHTML = `<form id="team-form" class="admin-form"><input type="hidden" name="id" /><fieldset><legend>Dodaj lub edytuj klub</legend><div class="admin-form-grid"><label>Nazwa klubu<input type="text" name="name" required /></label><label>Miasto<input type="text" name="city" required /></label><label>Logo URL<input type="url" name="logo" placeholder="https://" /></label></div><label>Opis<textarea name="description" required></textarea></label><div class="admin-actions"><button type="submit">Zapisz klub</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form><div class="admin-table-block"><h4>Kluby</h4><table><thead><tr><th>Logo</th><th>Nazwa</th><th>Miasto</th><th>Opis</th><th>Akcje</th></tr></thead><tbody>${leagueData.teams.map(team => `<tr><td>${renderLogo(team.name)}</td><td>${escapeHtml(team.name)}</td><td>${escapeHtml(team.city)}</td><td>${escapeHtml(team.description)}</td><td><div class="table-actions"><button type="button" class="compact-button edit-team" data-id="${team.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-team" data-id="${team.id}">Usuń</button></div></td></tr>`).join('')}</tbody></table></div>`;
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
  editor.innerHTML = `<form id="club-team-form" class="admin-form"><input type="hidden" name="id" /><fieldset><legend>Dodaj lub edytuj drużynę uczestniczącą</legend><div class="admin-form-grid"><label>Nazwa drużyny<input type="text" name="name" required placeholder="np. Orion Poznań B" /></label><label>Klub<select name="club" required>${getClubOptions()}</select></label><label>Dyscyplina<select name="sport" required>${getSportOptions('siatkowka')}</select></label><label>Poziom<select name="level"></select></label></div><label>Opis drużyny<textarea name="description" placeholder="Opcjonalnie: opis tej konkretnej drużyny, nie opis całego klubu."></textarea></label><label>Skład drużyny<select name="roster" multiple size="6"></select></label><p class="form-hint">Skład wybierasz z zawodników przypisanych do wybranego klubu. Nowych zawodników dodasz w sekcji Zawodnicy.</p><div class="admin-actions"><button type="submit">Zapisz drużynę</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form><div class="admin-table-block"><h4>Drużyny uczestniczące</h4><table><thead><tr><th>Logo</th><th>Drużyna</th><th>Klub</th><th>Dyscyplina</th><th>Poziom</th><th>Skład</th><th>Opis</th><th>Akcje</th></tr></thead><tbody>${leagueData.clubTeams.map(team => `<tr><td>${renderLogo(team.name)}</td><td>${escapeHtml(team.name)}</td><td>${escapeHtml(team.club)}</td><td>${escapeHtml(getSportName(team.sport))}</td><td>${escapeHtml(team.level || '-')}</td><td>${escapeHtml((team.roster || []).join(', ') || '-')}</td><td>${escapeHtml(team.description || '-')}</td><td><div class="table-actions"><button type="button" class="compact-button edit-club-team" data-id="${team.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-club-team" data-id="${team.id}">Usuń</button></div></td></tr>`).join('')}</tbody></table></div>`;
  const form = editor.querySelector('#club-team-form');
  function refreshRosterOptions(selected = []) {
    form.roster.innerHTML = getRosterSelectOptions(form.club.value, selected);
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
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = Number(data.get('id'));
    const payload = { name: data.get('name').toString().trim(), club: data.get('club').toString(), sport: data.get('sport').toString(), level: data.get('level').toString().trim(), description: data.get('description').toString().trim(), roster: data.getAll('roster').map(item => item.toString()) };
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
  editor.innerHTML = `<form id="player-form" class="admin-form"><input type="hidden" name="id" /><fieldset><legend>Dodaj lub edytuj zawodnika</legend><div class="admin-form-grid"><label>Zawodnik<input type="text" name="name" required /></label><label>Klub<select name="club" required>${getClubOptions()}</select></label><label>Sporty<input type="text" name="sports" placeholder="siatkowka,badminton" /></label><label>Drużyny<select name="teams" multiple size="5"></select></label></div><label>Opis zawodnika<textarea name="bio" placeholder="Krótki opis profilu, stylu gry albo roli w klubie."></textarea></label><p class="form-hint">Drużyny są zawężone do wybranego klubu. Odznaczenie drużyny usuwa zawodnika z jej składu.</p><div class="admin-actions"><button type="submit">Zapisz zawodnika</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form><div class="admin-table-block"><h4>Zawodnicy</h4><table><thead><tr><th>Logo</th><th>Zawodnik</th><th>Klub</th><th>Drużyny</th><th>Sporty</th><th>Akcje</th></tr></thead><tbody>${leagueData.players.map(player => `<tr><td>${renderLogo(player.club)}</td><td>${escapeHtml(player.name)}</td><td>${escapeHtml(player.club)}</td><td>${escapeHtml(getPlayerTeamNames(player.name).join(', ') || '-')}</td><td>${escapeHtml((player.sports || []).join(', '))}</td><td><div class="table-actions"><button type="button" class="compact-button edit-player" data-id="${player.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-player" data-id="${player.id}">Usuń</button></div></td></tr>`).join('')}</tbody></table></div>`;
  const form = editor.querySelector('#player-form');
  function refreshPlayerTeamOptions(selected = []) {
    form.teams.innerHTML = getTeamSelectOptions(form.club.value, selected);
  }
  refreshPlayerTeamOptions();
  form.club.addEventListener('change', () => refreshPlayerTeamOptions());
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = Number(data.get('id'));
    const payload = { name: data.get('name').toString().trim(), club: data.get('club').toString(), sports: data.get('sports').toString().split(',').map(item => item.trim()).filter(Boolean), bio: data.get('bio').toString().trim() };
    const teams = data.getAll('teams').map(item => item.toString());
    if (!payload.name || !payload.club) return showToast('Uzupełnij zawodnika i klub.', 'error');
    const existing = leagueData.players.find(player => player.id === id);
    if (existing) {
      const oldName = existing.name;
      Object.assign(existing, payload);
      syncPlayerName(oldName, payload.name);
      setPlayerTeams(payload.name, teams);
      saveAndRefreshAdmin('Zawodnik został zaktualizowany.');
    } else {
      leagueData.players.push({ id: Math.max(0, ...leagueData.players.map(player => player.id)) + 1, ...payload });
      setPlayerTeams(payload.name, teams);
      saveAndRefreshAdmin('Dodano zawodnika.');
    }
  });
  editor.querySelectorAll('.edit-player').forEach(button => button.addEventListener('click', () => {
    const player = leagueData.players.find(item => item.id === Number(button.dataset.id));
    if (!player) return;
    form.id.value = player.id; form.name.value = player.name; form.club.value = player.club; form.sports.value = (player.sports || []).join(','); form.bio.value = player.bio || ''; refreshPlayerTeamOptions(getPlayerTeamNames(player.name));
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  editor.querySelectorAll('.delete-player').forEach(button => button.addEventListener('click', () => {
    const removed = leagueData.players.find(player => player.id === Number(button.dataset.id));
    leagueData.players = leagueData.players.filter(player => player.id !== Number(button.dataset.id));
    if (removed) removePlayerReferences(removed.name);
    saveAndRefreshAdmin('Zawodnik został usunięty.');
  }));
}

function renderAdminResults() {
  const editor = document.getElementById('results-editor');
  if (!editor) return;
  editor.innerHTML = `<form id="result-form" class="admin-form"><input type="hidden" name="id" /><input type="hidden" name="originalSport" /><fieldset><legend>Dodaj lub edytuj wynik</legend><div class="admin-form-grid"><label>Dyscyplina<select name="sport" required>${getSportOptions()}</select></label><label>Tryb punktacji<select name="scoring"><option value="volleyball">Liga 3/2/1</option><option value="sets">Turniej: sety = punkty</option></select></label><label>Poziom<select name="level"></select></label><label>Uczestnik 1<select name="home" required></select></label><label>Wynik meczu<select name="score" required></select></label><label>Uczestnik 2<select name="away" required></select></label><label>MVP meczu<select name="mvp"><option value="">Brak</option></select></label></div><div class="set-fields" id="set-fields"></div><div class="admin-actions"><button type="submit">Zapisz wynik</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form>${Object.keys(leagueData.sports).map(key => {
    const sport = leagueData.sports[key];
    const rows = sport.results.length ? sport.results.map(match => `<tr><td>${escapeHtml(sport.name)}</td><td>${escapeHtml(match.level || '-')}</td><td>${escapeHtml(match.home)}</td><td>${renderLogo(match.home)}</td><td><strong>${escapeHtml(deriveScore(match))}</strong></td><td>${escapeHtml(match.sets || '-')}</td><td>${renderLogo(match.away)}</td><td>${escapeHtml(match.away)}</td><td>${escapeHtml(match.mvp || '-')}</td><td><div class="table-actions"><button type="button" class="compact-button edit-result" data-sport="${key}" data-id="${match.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-result" data-sport="${key}" data-id="${match.id}">Usuń</button></div></td></tr>`).join('') : `<tr><td colspan="10">Brak wyników: ${escapeHtml(sport.name)}</td></tr>`;
    return `<div class="admin-table-block"><h4>${escapeHtml(sport.name)}</h4><table><thead><tr><th>Dyscyplina</th><th>Poziom</th><th>Uczestnik 1</th><th>Logo</th><th>Wynik</th><th>Sety</th><th>Logo</th><th>Uczestnik 2</th><th>MVP</th><th>Akcje</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('')}`;
  const form = editor.querySelector('#result-form');
  const setFields = editor.querySelector('#set-fields');
  function refreshScoreFields(score = form.score.value, sets = '') {
    setFields.innerHTML = renderSetInputs(score, sets);
  }
  function refreshMvpOptions(mvp = '') {
    form.mvp.innerHTML = `<option value="">Brak</option>${getMatchMvpOptions(form.sport.value, form.home.value, form.away.value, mvp)}`;
  }
  function refreshFormOptions(home = '', away = '', mvp = '', score = '', level = '') {
    const sportKey = form.sport.value;
    const defaultScoring = leagueData.sports[sportKey].defaultScoring || 'volleyball';
    form.home.innerHTML = getParticipantOptions(sportKey, home);
    form.away.innerHTML = getParticipantOptions(sportKey, away);
    form.level.innerHTML = getLevelOptions(sportKey, level || form.level.value || '', true);
    form.scoring.value = defaultScoring;
    form.score.innerHTML = getScoreOptions(defaultScoring, score);
    refreshMvpOptions(mvp);
    refreshScoreFields(form.score.value);
  }
  refreshFormOptions();
  form.sport.addEventListener('change', () => {
    form.level.value = '';
    refreshFormOptions();
  });
  form.scoring.addEventListener('change', () => {
    form.score.innerHTML = getScoreOptions(form.scoring.value);
    refreshScoreFields(form.score.value);
    refreshMvpOptions();
  });
  form.score.addEventListener('change', () => refreshScoreFields(form.score.value));
  form.home.addEventListener('change', () => refreshMvpOptions());
  form.away.addEventListener('change', () => refreshMvpOptions());
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const sportKey = data.get('sport').toString();
    const originalSport = data.get('originalSport').toString();
    const id = Number(data.get('id'));
    const payload = { level: data.get('level').toString().trim(), home: data.get('home').toString(), away: data.get('away').toString(), score: data.get('score').toString(), sets: collectSetScores(form), scoring: data.get('scoring').toString(), mvp: data.get('mvp').toString() };
    if (payload.home === payload.away) return showToast('Uczestnicy meczu muszą być różni.', 'warning');
    if (!parseSetPairs(payload.sets).length) return showToast('Uzupełnij punkty setów.', 'warning');
    if (deriveScore(payload) !== payload.score) return showToast('Punkty setów nie zgadzają się z wybranym wynikiem meczu.', 'warning');
    const allowedMvp = getMatchMvpNames(sportKey, payload.home, payload.away);
    if (payload.mvp && !allowedMvp.includes(payload.mvp)) return showToast('MVP musi być zawodnikiem jednej z grających drużyn.', 'warning');
    if (id && originalSport && originalSport !== sportKey && leagueData.sports[originalSport]) {
      leagueData.sports[originalSport].results = leagueData.sports[originalSport].results.filter(match => match.id !== id);
    }
    const sport = leagueData.sports[sportKey];
    const existing = originalSport && originalSport !== sportKey ? null : sport.results.find(match => match.id === id);
    if (existing) {
      Object.assign(existing, payload);
      saveAndRefreshAdmin('Wynik został zaktualizowany.');
    } else {
      sport.results.push({ id: Math.max(0, ...sport.results.map(match => match.id)) + 1, ...payload });
      saveAndRefreshAdmin('Dodano wynik.');
    }
  });
  editor.querySelectorAll('.edit-result').forEach(button => button.addEventListener('click', () => {
    const sportKey = button.dataset.sport;
    const match = leagueData.sports[sportKey].results.find(item => item.id === Number(button.dataset.id));
    if (!match) return;
    form.id.value = match.id; form.originalSport.value = sportKey; form.sport.value = sportKey; form.scoring.value = match.scoring || leagueData.sports[sportKey].defaultScoring || 'volleyball'; refreshFormOptions(match.home, match.away, match.mvp || '', deriveScore(match), match.level || ''); form.level.value = match.level || ''; form.scoring.value = match.scoring || leagueData.sports[sportKey].defaultScoring || 'volleyball'; form.score.innerHTML = getScoreOptions(form.scoring.value, deriveScore(match)); refreshScoreFields(deriveScore(match), match.sets || ''); refreshMvpOptions(match.mvp || ''); form.mvp.value = match.mvp || '';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  editor.querySelectorAll('.delete-result').forEach(button => button.addEventListener('click', () => {
    const sportKey = button.dataset.sport;
    leagueData.sports[sportKey].results = leagueData.sports[sportKey].results.filter(match => match.id !== Number(button.dataset.id));
    saveAndRefreshAdmin('Wynik został usunięty.');
  }));
}

function renderAdminTournaments() {
  const editor = document.getElementById('tournaments-editor');
  if (!editor) return;
  editor.innerHTML = `<form id="tournament-form" class="admin-form"><input type="hidden" name="id" /><fieldset><legend>Dodaj lub edytuj turniej</legend><div class="admin-form-grid"><label>Nazwa turnieju<input type="text" name="name" required placeholder="np. Letni Puchar Tenisa" /></label><label>Dyscyplina<select name="sport" required>${getSportOptions('tenis')}</select></label><label>Status<input type="text" name="status" placeholder="completed, planned" /></label></div><label>Klasyfikacja końcowa<textarea name="finalClassification" required placeholder="1|Dariusz Karpuk|Unicorns Łódź&#10;2|Krzysztof Sobanowski|Dragons Kraków"></textarea></label><label>Drabinka<textarea name="bracket" required placeholder="Półfinał|Dariusz Karpuk|2:0|Sebastian Górski&#10;Finał|Dariusz Karpuk|2:1|Krzysztof Sobanowski"></textarea></label><div class="admin-actions"><button type="submit">Zapisz turniej</button><button type="reset" class="button-secondary">Wyczyść</button></div></fieldset></form><div class="admin-table-block"><h4>Turnieje</h4><table><thead><tr><th>Nazwa</th><th>Dyscyplina</th><th>Status</th><th>Klasyfikacja</th><th>Mecze drabinki</th><th>Akcje</th></tr></thead><tbody>${leagueData.tournaments.length ? leagueData.tournaments.map(tournament => `<tr><td>${escapeHtml(tournament.name)}</td><td>${escapeHtml(getSportName(tournament.sport))}</td><td>${escapeHtml(tournament.status || '-')}</td><td>${escapeHtml((tournament.finalClassification || []).map(row => `${row.place}. ${row.participant}`).join(', ') || '-')}</td><td>${(tournament.bracket || []).length}</td><td><div class="table-actions"><button type="button" class="compact-button edit-tournament" data-id="${tournament.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-tournament" data-id="${tournament.id}">Usuń</button></div></td></tr>`).join('') : '<tr><td colspan="6">Brak turniejów.</td></tr>'}</tbody></table></div>`;
  const form = editor.querySelector('#tournament-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = Number(data.get('id'));
    const payload = {
      name: data.get('name').toString().trim(),
      sport: data.get('sport').toString(),
      scoring: 'sets',
      status: data.get('status').toString().trim() || 'completed',
      finalClassification: parseClassificationText(data.get('finalClassification').toString()),
      bracket: parseBracketText(data.get('bracket').toString())
    };
    if (!payload.name || !payload.finalClassification.length || !payload.bracket.length) return showToast('Uzupełnij nazwę, klasyfikację i drabinkę turnieju.', 'warning');
    const existing = leagueData.tournaments.find(tournament => tournament.id === id);
    if (existing) {
      Object.assign(existing, payload);
      saveAndRefreshAdmin('Turniej został zaktualizowany.');
    } else {
      leagueData.tournaments.push({ id: Math.max(0, ...leagueData.tournaments.map(tournament => tournament.id)) + 1, ...payload });
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
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  editor.querySelectorAll('.delete-tournament').forEach(button => button.addEventListener('click', () => {
    leagueData.tournaments = leagueData.tournaments.filter(tournament => tournament.id !== Number(button.dataset.id));
    saveAndRefreshAdmin('Turniej został usunięty.');
  }));
}

function initAdminPanel() {
  if (!document.getElementById('admin-content')) return;
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
  if (page === 'login') return initLoginPage();
  if (page === 'admin') {
    if (!await requireAdminAuth()) return;
    return initAdminPanel();
  }
  if (page === 'clubs') return renderClubsPage();
  if (page === 'players') return renderPlayersPage();
  if (page === 'rankings') return renderPublicRankingsPage();
  if (page === 'sport') {
    renderSportStandings();
    renderTeams();
    renderResults();
    renderMvp();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initHeaderScrollState();
  initStaticForms();
  initPage();
});
