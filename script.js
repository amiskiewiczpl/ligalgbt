function getSportKey() {
  return document.body.dataset.sport || document.documentElement.dataset.sport || null;
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function isAdminLoggedIn() {
  const auth = localStorage.getItem('ligaLgbtAdmin');
  if (!auth) return false;
  try {
    return JSON.parse(auth).loggedIn === true;
  } catch {
    return false;
  }
}

const clubBadgeMap = [
  { key: 'dragons', label: 'DK', className: 'club-dragons', names: ['dragons', 'kraków', 'krakow'] },
  { key: 'neon', label: 'NW', className: 'club-neon', names: ['neon', 'wrocław', 'wroclaw'] },
  { key: 'orion', label: 'OP', className: 'club-orion', names: ['orion', 'poznań', 'poznan'] },
  { key: 'volup', label: 'VW', className: 'club-volup', names: ['volup', 'warszawa'] },
  { key: 'unicorns', label: 'UL', className: 'club-unicorns', names: ['unicorns', 'łódź', 'lodz'] }
];

function getClubByName(name) {
  return leagueData.teams.find(team => team.name === name) || null;
}

function getParticipantByName(name) {
  return leagueData.clubTeams.find(team => team.name === name) || null;
}

function getParticipantClubName(value) {
  const participant = getParticipantByName(value);
  return participant?.club || value;
}

function getClubBadge(value) {
  const normalized = String(value || '').toLowerCase();
  const clubName = getParticipantClubName(value);
  const team = getClubByName(clubName);
  const club = clubBadgeMap.find(item => item.names.some(name => normalized.includes(name))) || null;
  const label = club?.label || String(value || '?').slice(0, 2).toUpperCase();
  const className = club?.className || '';
  const title = team?.name || clubName || value || 'Klub';
  return `<span class="club-badge ${className}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
}

function renderLogo(value) {
  const team = getClubByName(getParticipantClubName(value));
  if (team?.logo) {
    return `<img class="club-logo" src="${escapeHtml(team.logo)}" alt="${escapeHtml(team.name)}" />`;
  }
  return getClubBadge(value);
}

function getSportName(key) {
  return leagueData.sports[key]?.name || key;
}

function getClubOptions(selected = '') {
  return leagueData.teams
    .map(team => `<option value="${escapeHtml(team.name)}" ${team.name === selected ? 'selected' : ''}>${escapeHtml(team.name)}</option>`)
    .join('');
}

function getParticipantOptions(sportKey, selected = '') {
  const participants = sportKey === 'siatkowka'
    ? leagueData.clubTeams.filter(team => team.sport === sportKey)
    : leagueData.teams;
  const source = participants.length ? participants : leagueData.teams;
  return source
    .map(item => {
      const value = item.name;
      const label = item.club ? `${item.name} (${item.club})` : item.name;
      return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

function getSportOptions(selected = '') {
  return Object.keys(leagueData.sports)
    .map(key => `<option value="${key}" ${key === selected ? 'selected' : ''}>${escapeHtml(getSportName(key))}</option>`)
    .join('');
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
    nav.querySelectorAll('.nav-menu').forEach(menu => {
      menu.hidden = true;
    });

    nav.querySelectorAll('.nav-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const group = trigger.closest('.nav-group');
        if (!group) return;
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        isOpen ? closeGroup(group) : openGroup(group);
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
  function update() {
    header.classList.toggle('is-condensed', window.scrollY > 80);
    ticking = false;
  }

  update();
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
}

function initStaticForms() {
  document.querySelectorAll('.newsletter-form, .contact-form').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      showToast('Dziękujemy. Formularz jest gotowy wizualnie, ale wymaga podpięcia obsługi wysyłki.', 'info');
    });
  });
}

function initLoginPage() {
  if (isAdminLoggedIn()) {
    window.location.href = 'admin.html';
    return;
  }

  const form = document.getElementById('login-form');
  if (!form) return;
  const passwordInput = form.querySelector('input[name="password"]');

  form.addEventListener('submit', event => {
    event.preventDefault();
    const password = new FormData(form).get('password').toString().trim();

    if (!password) {
      showToast('Wpisz hasło administratora.', 'warning');
      return;
    }

    if (password === leagueData.admin.password) {
      localStorage.setItem('ligaLgbtAdmin', JSON.stringify({ loggedIn: true }));
      showToast('Zalogowano. Przekierowuję do panelu.', 'success', 2000);
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 800);
      return;
    }

    showToast('Nieprawidłowe hasło. Spróbuj ponownie.', 'error');
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.focus();
    }
  });
}

function requireAdminAuth() {
  if (!isAdminLoggedIn()) {
    showToast('Brak dostępu. Zaloguj się jako administrator.', 'warning', 3000);
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 500);
  }
}

function renderTeams() {
  const sportKey = getSportKey();
  const section = document.getElementById('sport-teams');
  if (!section || !sportKey) return;

  section.innerHTML = '';
  const entries = sportKey === 'siatkowka'
    ? leagueData.clubTeams.filter(team => team.sport === sportKey)
    : leagueData.teams.map(team => ({ ...team, club: team.name, level: 'indywidualnie' }));

  entries.forEach(team => {
    const card = document.createElement('article');
    card.className = 'team-card';
    const club = getClubByName(team.club || team.name);
    card.innerHTML = `<h3>${renderLogo(team.name)} ${escapeHtml(team.name)}</h3><p>${escapeHtml(club?.description || '')}</p><p class="club-city">${escapeHtml(team.club || team.name)} · ${escapeHtml(team.level || '')}</p>`;
    section.appendChild(card);
  });
}

function renderClubsPage() {
  const grid = document.querySelector('.clubs-grid');
  if (!grid) return;

  grid.innerHTML = leagueData.teams.map(team => {
    const participantCount = leagueData.clubTeams.filter(entry => entry.club === team.name).length;
    return `
      <article class="club-card">
        <div class="club-header">
          <h3>${renderLogo(team.name)} ${escapeHtml(team.name)}</h3>
          <p class="club-city">${escapeHtml(team.city)}</p>
        </div>
        <p class="club-description">${escapeHtml(team.description)}</p>
        <div class="club-stats">
          <div class="stat"><span class="stat-label">Drużyny</span><span class="stat-value">${participantCount}</span></div>
          <div class="stat"><span class="stat-label">Sporty</span><span class="stat-value">${participantCount ? 1 : 0}</span></div>
        </div>
      </article>
    `;
  }).join('');
}

function renderPublicRankingsPage() {
  const main = document.querySelector('main.container');
  if (!main) return;

  const legend = leagueData.teams.map(team => `<span>${renderLogo(team.name)} ${escapeHtml(team.name)}</span>`).join('');
  const sportSections = Object.keys(leagueData.sports).map(key => {
    const sport = leagueData.sports[key];
    const resultsRows = sport.results.length
      ? sport.results.map(match => `
          <tr><td>${escapeHtml(match.level || '-')}</td><td>${escapeHtml(match.home)}</td><td>${renderLogo(match.home)}</td><td><strong>${escapeHtml(match.score)}</strong></td><td>${renderLogo(match.away)}</td><td>${escapeHtml(match.away)}</td></tr>
        `).join('')
      : '<tr><td colspan="6">Brak wyników dla tej dyscypliny.</td></tr>';
    const playerRows = sport.mvp.length
      ? sport.mvp.slice().sort((a, b) => b.points - a.points).map((player, index) => `
          <tr><td>${index + 1}</td><td>${escapeHtml(player.player)}</td><td>${escapeHtml(player.team)}</td><td>${renderLogo(player.team)}</td><td><strong>${player.points}</strong></td></tr>
        `).join('')
      : '<tr><td colspan="5">Brak zawodników w rankingu.</td></tr>';

    return `
      <section class="rankings-section">
        <h2>${escapeHtml(sport.name)}</h2>
        <div class="rankings-container">
          <div class="ranking-view">
            <h3>Wyniki</h3>
            <table><thead><tr><th>Poziom</th><th>Drużyna / reprezentant 1</th><th>Logo</th><th>Wynik</th><th>Logo</th><th>Drużyna / reprezentant 2</th></tr></thead><tbody>${resultsRows}</tbody></table>
          </div>
          <div class="ranking-view">
            <h3>Zawodnicy</h3>
            <table><thead><tr><th>#</th><th>Zawodnik</th><th>Drużyna / klub</th><th>Logo</th><th>Punkty</th></tr></thead><tbody>${playerRows}</tbody></table>
          </div>
        </div>
      </section>
    `;
  }).join('');

  main.innerHTML = `
    <section class="page-intro">
      <span class="eyebrow">Wyniki</span>
      <h2>Kluby, drużyny uczestniczące i zawodnicy</h2>
      <p>W siatkówce klub wystawia drużyny. W zawodach indywidualnych zawodnik reprezentuje bezpośrednio klub.</p>
    </section>
    <section class="legend-strip" aria-label="Legenda klubów">${legend}</section>
    ${sportSections}
  `;
}

function renderResults() {
  const sportKey = getSportKey();
  const section = document.getElementById('sport-results');
  if (!section || !sportKey) return;

  const sport = leagueData.sports[sportKey];
  if (!sport) {
    section.innerHTML = '<p>Brak danych dla tej dyscypliny.</p>';
    return;
  }

  if (!sport.results.length) {
    section.innerHTML = '<p class="empty-state">Brak aktualnych wyników.</p>';
    return;
  }

  const rows = sport.results.slice(0, 8).map(match => `
    <tr>
      <td>${escapeHtml(match.level || '-')}</td>
      <td>${escapeHtml(match.home)}</td>
      <td>${renderLogo(match.home)}</td>
      <td><strong>${escapeHtml(match.score)}</strong></td>
      <td>${renderLogo(match.away)}</td>
      <td>${escapeHtml(match.away)}</td>
    </tr>
  `).join('');
  section.innerHTML = `
    <table>
      <thead><tr><th>Poziom</th><th>Drużyna 1</th><th>Logo</th><th>Wynik</th><th>Logo</th><th>Drużyna 2</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderMvp() {
  const sportKey = getSportKey();
  const section = document.getElementById('sport-mvp');
  if (!section || !sportKey) return;

  const sport = leagueData.sports[sportKey];
  if (!sport) {
    section.innerHTML = '<p>Brak danych dla tej dyscypliny.</p>';
    return;
  }

  if (!sport.mvp.length) {
    section.innerHTML = '<p class="empty-state">Brak rankingu MVP.</p>';
    return;
  }

  const rows = sport.mvp.slice().sort((a, b) => b.points - a.points).map((player, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(player.player)}</td>
      <td>${escapeHtml(player.team)}</td>
      <td>${renderLogo(player.team)}</td>
      <td><strong>${player.points}</strong></td>
    </tr>
  `).join('');
  section.innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Zawodnik</th><th>Drużyna / klub</th><th>Logo</th><th>Punkty</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function saveAndRefreshAdmin(message) {
  saveLeagueData(leagueData);
  renderAdminDashboard();
  renderAdminStandings();
  renderAdminTeams();
  renderAdminClubTeams();
  renderAdminResults();
  renderAdminPlayers();
  if (message) showToast(message, 'success');
}

function syncClubName(oldName, newName) {
  if (!oldName || oldName === newName) return;
  leagueData.clubTeams.forEach(team => {
    if (team.club === oldName) team.club = newName;
  });
  Object.values(leagueData.sports).forEach(sport => {
    sport.results.forEach(match => {
      if (match.home === oldName) match.home = newName;
      if (match.away === oldName) match.away = newName;
    });
    sport.mvp.forEach(player => {
      if (player.team === oldName) player.team = newName;
    });
  });
}

function syncParticipantName(oldName, newName) {
  if (!oldName || oldName === newName) return;
  Object.values(leagueData.sports).forEach(sport => {
    sport.results.forEach(match => {
      if (match.home === oldName) match.home = newName;
      if (match.away === oldName) match.away = newName;
    });
    sport.mvp.forEach(player => {
      if (player.team === oldName) player.team = newName;
    });
  });
}

function renderAdminDashboard() {
  const resultsCount = Object.values(leagueData.sports).reduce((sum, sport) => sum + sport.results.length, 0);
  const playersCount = Object.values(leagueData.sports).reduce((sum, sport) => sum + sport.mvp.length, 0);
  const teamsCount = document.getElementById('admin-teams-count');
  const entriesCount = document.getElementById('admin-entries-count');
  const results = document.getElementById('admin-results-count');
  const players = document.getElementById('admin-players-count');
  const sports = document.getElementById('admin-sports-count');
  if (teamsCount) teamsCount.textContent = leagueData.teams.length;
  if (entriesCount) entriesCount.textContent = leagueData.clubTeams.length;
  if (results) results.textContent = resultsCount;
  if (players) players.textContent = playersCount;
  if (sports) sports.textContent = Object.keys(leagueData.sports).length;
}

function renderAdminStandings() {
  const container = document.getElementById('admin-standings-preview');
  if (!container) return;

  container.innerHTML = Object.keys(leagueData.sports).map(key => {
    const sport = leagueData.sports[key];
    const rows = sport.results.length
      ? sport.results.map(match => `
          <tr><td>${escapeHtml(match.level || '-')}</td><td>${escapeHtml(match.home)}</td><td>${renderLogo(match.home)}</td><td><strong>${escapeHtml(match.score)}</strong></td><td>${renderLogo(match.away)}</td><td>${escapeHtml(match.away)}</td></tr>
        `).join('')
      : '<tr><td colspan="6">Brak wyników dla tej dyscypliny.</td></tr>';
    return `
      <div class="admin-table-block">
        <h4>${escapeHtml(sport.name)}</h4>
        <table><thead><tr><th>Poziom</th><th>Drużyna 1</th><th>Logo</th><th>Wynik</th><th>Logo</th><th>Drużyna 2</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }).join('');
}

function renderAdminTeams() {
  const editor = document.getElementById('team-editor');
  if (!editor) return;

  editor.innerHTML = `
    <form id="team-form" class="admin-form">
      <input type="hidden" name="id" />
      <fieldset>
        <legend>Dodaj lub edytuj klub</legend>
        <div class="admin-form-grid">
          <label>Nazwa klubu<input type="text" name="name" required /></label>
          <label>Miasto<input type="text" name="city" required /></label>
          <label>Logo URL<input type="url" name="logo" placeholder="https://" /></label>
        </div>
        <label>Opis<textarea name="description" required></textarea></label>
        <div class="admin-actions"><button type="submit">Zapisz klub</button><button type="reset" class="button-secondary">Wyczyść</button></div>
      </fieldset>
    </form>
    <div class="admin-table-block">
      <h4>Kluby</h4>
      <table>
        <thead><tr><th>Logo</th><th>Nazwa</th><th>Miasto</th><th>Opis</th><th>Akcje</th></tr></thead>
        <tbody>
          ${leagueData.teams.map(team => `
            <tr>
              <td>${renderLogo(team.name)}</td>
              <td>${escapeHtml(team.name)}</td>
              <td>${escapeHtml(team.city)}</td>
              <td>${escapeHtml(team.description)}</td>
              <td><div class="table-actions"><button type="button" class="compact-button edit-team" data-id="${team.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-team" data-id="${team.id}">Usuń</button></div></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const form = editor.querySelector('#team-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const id = Number(formData.get('id'));
    const name = formData.get('name').toString().trim();
    const city = formData.get('city').toString().trim();
    const logo = formData.get('logo').toString().trim();
    const description = formData.get('description').toString().trim();

    if (!name || !city || !description) {
      showToast('Uzupełnij nazwę, miasto i opis klubu.', 'error');
      return;
    }

    const existing = leagueData.teams.find(team => team.id === id);
    if (existing) {
      const oldName = existing.name;
      existing.name = name;
      existing.city = city;
      existing.logo = logo;
      existing.description = description;
      syncClubName(oldName, name);
      saveAndRefreshAdmin('Klub został zaktualizowany.');
    } else {
      const nextId = Math.max(0, ...leagueData.teams.map(team => team.id)) + 1;
      leagueData.teams.push({ id: nextId, name, city, logo, description });
      saveAndRefreshAdmin('Dodano klub.');
    }
  });

  editor.querySelectorAll('.edit-team').forEach(button => {
    button.addEventListener('click', () => {
      const team = leagueData.teams.find(item => item.id === Number(button.dataset.id));
      if (!team) return;
      form.id.value = team.id;
      form.name.value = team.name;
      form.city.value = team.city;
      form.logo.value = team.logo || '';
      form.description.value = team.description;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  editor.querySelectorAll('.delete-team').forEach(button => {
    button.addEventListener('click', () => {
      const removed = leagueData.teams.find(team => team.id === Number(button.dataset.id));
      leagueData.teams = leagueData.teams.filter(team => team.id !== Number(button.dataset.id));
      if (removed) {
        leagueData.clubTeams = leagueData.clubTeams.filter(team => team.club !== removed.name);
      }
      saveAndRefreshAdmin('Klub został usunięty.');
    });
  });
}

function renderAdminClubTeams() {
  const editor = document.getElementById('club-team-editor');
  if (!editor) return;

  editor.innerHTML = `
    <form id="club-team-form" class="admin-form">
      <input type="hidden" name="id" />
      <fieldset>
        <legend>Dodaj lub edytuj drużynę uczestniczącą</legend>
        <div class="admin-form-grid">
          <label>Nazwa drużyny<input type="text" name="name" required placeholder="np. Orion Poznań B" /></label>
          <label>Klub<select name="club" required>${getClubOptions()}</select></label>
          <label>Dyscyplina<select name="sport" required>${getSportOptions('siatkowka')}</select></label>
          <label>Poziom<input type="text" name="level" placeholder="B, B-, C, D" /></label>
        </div>
        <div class="admin-actions"><button type="submit">Zapisz drużynę</button><button type="reset" class="button-secondary">Wyczyść</button></div>
      </fieldset>
    </form>
    <div class="admin-table-block">
      <h4>Drużyny uczestniczące</h4>
      <table>
        <thead><tr><th>Logo</th><th>Drużyna</th><th>Klub</th><th>Dyscyplina</th><th>Poziom</th><th>Akcje</th></tr></thead>
        <tbody>
          ${leagueData.clubTeams.map(team => `
            <tr>
              <td>${renderLogo(team.name)}</td>
              <td>${escapeHtml(team.name)}</td>
              <td>${escapeHtml(team.club)}</td>
              <td>${escapeHtml(getSportName(team.sport))}</td>
              <td>${escapeHtml(team.level || '-')}</td>
              <td><div class="table-actions"><button type="button" class="compact-button edit-club-team" data-id="${team.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-club-team" data-id="${team.id}">Usuń</button></div></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const form = editor.querySelector('#club-team-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const id = Number(formData.get('id'));
    const name = formData.get('name').toString().trim();
    const club = formData.get('club').toString();
    const sport = formData.get('sport').toString();
    const level = formData.get('level').toString().trim();
    if (!name || !club || !sport) {
      showToast('Uzupełnij nazwę drużyny, klub i dyscyplinę.', 'error');
      return;
    }
    const existing = leagueData.clubTeams.find(team => team.id === id);
    if (existing) {
      const oldName = existing.name;
      Object.assign(existing, { name, club, sport, level });
      syncParticipantName(oldName, name);
      saveAndRefreshAdmin('Drużyna uczestnicząca została zaktualizowana.');
    } else {
      const nextId = Math.max(0, ...leagueData.clubTeams.map(team => team.id)) + 1;
      leagueData.clubTeams.push({ id: nextId, name, club, sport, level });
      saveAndRefreshAdmin('Dodano drużynę uczestniczącą.');
    }
  });

  editor.querySelectorAll('.edit-club-team').forEach(button => {
    button.addEventListener('click', () => {
      const team = leagueData.clubTeams.find(item => item.id === Number(button.dataset.id));
      if (!team) return;
      form.id.value = team.id;
      form.name.value = team.name;
      form.club.value = team.club;
      form.sport.value = team.sport;
      form.level.value = team.level || '';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  editor.querySelectorAll('.delete-club-team').forEach(button => {
    button.addEventListener('click', () => {
      leagueData.clubTeams = leagueData.clubTeams.filter(team => team.id !== Number(button.dataset.id));
      saveAndRefreshAdmin('Drużyna uczestnicząca została usunięta.');
    });
  });
}

function renderAdminResults() {
  const editor = document.getElementById('results-editor');
  if (!editor) return;

  editor.innerHTML = `
    <form id="result-form" class="admin-form">
      <input type="hidden" name="id" />
      <fieldset>
        <legend>Dodaj lub edytuj wynik</legend>
        <div class="admin-form-grid">
          <label>Dyscyplina<select name="sport" required>${getSportOptions()}</select></label>
          <label>Poziom<input type="text" name="level" placeholder="B, B-, C, D" /></label>
          <label>Drużyna / reprezentant 1<select name="home" required>${getParticipantOptions('siatkowka')}</select></label>
          <label>Wynik<input type="text" name="score" required placeholder="3:1" /></label>
          <label>Drużyna / reprezentant 2<select name="away" required>${getParticipantOptions('siatkowka')}</select></label>
        </div>
        <div class="admin-actions"><button type="submit">Zapisz wynik</button><button type="reset" class="button-secondary">Wyczyść</button></div>
      </fieldset>
    </form>
    ${Object.keys(leagueData.sports).map(key => {
      const sport = leagueData.sports[key];
      const rows = sport.results.length
        ? sport.results.map(match => `
            <tr><td>${escapeHtml(sport.name)}</td><td>${escapeHtml(match.level || '-')}</td><td>${escapeHtml(match.home)}</td><td>${renderLogo(match.home)}</td><td><strong>${escapeHtml(match.score)}</strong></td><td>${renderLogo(match.away)}</td><td>${escapeHtml(match.away)}</td><td><div class="table-actions"><button type="button" class="compact-button edit-result" data-sport="${key}" data-id="${match.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-result" data-sport="${key}" data-id="${match.id}">Usuń</button></div></td></tr>
          `).join('')
        : `<tr><td colspan="8">Brak wyników: ${escapeHtml(sport.name)}</td></tr>`;
      return `<div class="admin-table-block"><h4>${escapeHtml(sport.name)}</h4><table><thead><tr><th>Dyscyplina</th><th>Poziom</th><th>Drużyna 1</th><th>Logo</th><th>Wynik</th><th>Logo</th><th>Drużyna 2</th><th>Akcje</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join('')}
  `;

  const form = editor.querySelector('#result-form');
  function refreshResultParticipantOptions(selectedHome = '', selectedAway = '') {
    const sportKey = form.sport.value;
    form.home.innerHTML = getParticipantOptions(sportKey, selectedHome);
    form.away.innerHTML = getParticipantOptions(sportKey, selectedAway);
  }
  form.sport.addEventListener('change', () => refreshResultParticipantOptions());

  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const sportKey = formData.get('sport').toString();
    const id = Number(formData.get('id'));
    const level = formData.get('level').toString().trim();
    const home = formData.get('home').toString();
    const away = formData.get('away').toString();
    const score = formData.get('score').toString().trim();

    if (home === away) {
      showToast('Drużyny w jednym meczu muszą być różne.', 'warning');
      return;
    }
    if (!/^\d+:\d+$/.test(score)) {
      showToast('Wynik wpisz w formacie X:Y, np. 3:1.', 'warning');
      return;
    }

    const sport = leagueData.sports[sportKey];
    const existing = sport.results.find(result => result.id === id);
    if (existing) {
      Object.assign(existing, { level, home, away, score });
      saveAndRefreshAdmin('Wynik został zaktualizowany.');
    } else {
      const nextId = Math.max(0, ...sport.results.map(item => item.id)) + 1;
      sport.results.push({ id: nextId, level, home, away, score });
      saveAndRefreshAdmin('Dodano wynik.');
    }
  });

  editor.querySelectorAll('.edit-result').forEach(button => {
    button.addEventListener('click', () => {
      const sportKey = button.dataset.sport;
      const match = leagueData.sports[sportKey].results.find(item => item.id === Number(button.dataset.id));
      if (!match) return;
      form.id.value = match.id;
      form.sport.value = sportKey;
      form.level.value = match.level || '';
      refreshResultParticipantOptions(match.home, match.away);
      form.home.value = match.home;
      form.score.value = match.score;
      form.away.value = match.away;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  editor.querySelectorAll('.delete-result').forEach(button => {
    button.addEventListener('click', () => {
      const sportKey = button.dataset.sport;
      leagueData.sports[sportKey].results = leagueData.sports[sportKey].results.filter(match => match.id !== Number(button.dataset.id));
      saveAndRefreshAdmin('Wynik został usunięty.');
    });
  });
}

function renderAdminPlayers() {
  const editor = document.getElementById('players-editor');
  if (!editor) return;

  editor.innerHTML = `
    <form id="player-form" class="admin-form">
      <input type="hidden" name="id" />
      <fieldset>
        <legend>Dodaj lub edytuj zawodnika</legend>
        <div class="admin-form-grid">
          <label>Dyscyplina<select name="sport" required>${getSportOptions()}</select></label>
          <label>Zawodnik<input type="text" name="player" required /></label>
          <label>Reprezentowany klub<select name="team" required>${getClubOptions()}</select></label>
          <label>Punkty<input type="number" name="points" required min="0" /></label>
        </div>
        <div class="admin-actions"><button type="submit">Zapisz zawodnika</button><button type="reset" class="button-secondary">Wyczyść</button></div>
      </fieldset>
    </form>
    ${Object.keys(leagueData.sports).map(key => {
      const sport = leagueData.sports[key];
      const rows = sport.mvp.length
        ? sport.mvp.slice().sort((a, b) => b.points - a.points).map((player, index) => `
            <tr><td>${index + 1}</td><td>${escapeHtml(sport.name)}</td><td>${escapeHtml(player.player)}</td><td>${escapeHtml(player.team)}</td><td>${renderLogo(player.team)}</td><td><strong>${player.points}</strong></td><td><div class="table-actions"><button type="button" class="compact-button edit-player" data-sport="${key}" data-id="${player.id}">Edytuj</button><button type="button" class="compact-button danger-button delete-player" data-sport="${key}" data-id="${player.id}">Usuń</button></div></td></tr>
          `).join('')
        : `<tr><td colspan="7">Brak zawodników: ${escapeHtml(sport.name)}</td></tr>`;
      return `<div class="admin-table-block"><h4>${escapeHtml(sport.name)}</h4><table><thead><tr><th>#</th><th>Dyscyplina</th><th>Zawodnik</th><th>Klub</th><th>Logo</th><th>Punkty</th><th>Akcje</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join('')}
  `;

  const form = editor.querySelector('#player-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const sportKey = formData.get('sport').toString();
    const id = Number(formData.get('id'));
    const player = formData.get('player').toString().trim();
    const team = formData.get('team').toString();
    const points = Number(formData.get('points'));

    if (!player || Number.isNaN(points) || points < 0) {
      showToast('Uzupełnij zawodnika i poprawną liczbę punktów.', 'error');
      return;
    }

    const sport = leagueData.sports[sportKey];
    const existing = sport.mvp.find(item => item.id === id);
    if (existing) {
      Object.assign(existing, { player, team, points });
      saveAndRefreshAdmin('Zawodnik został zaktualizowany.');
    } else {
      const nextId = Math.max(0, ...sport.mvp.map(item => item.id)) + 1;
      sport.mvp.push({ id: nextId, player, team, points });
      saveAndRefreshAdmin('Dodano zawodnika.');
    }
  });

  editor.querySelectorAll('.edit-player').forEach(button => {
    button.addEventListener('click', () => {
      const sportKey = button.dataset.sport;
      const player = leagueData.sports[sportKey].mvp.find(item => item.id === Number(button.dataset.id));
      if (!player) return;
      form.id.value = player.id;
      form.sport.value = sportKey;
      form.player.value = player.player;
      form.team.value = player.team;
      form.points.value = player.points;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  editor.querySelectorAll('.delete-player').forEach(button => {
    button.addEventListener('click', () => {
      const sportKey = button.dataset.sport;
      leagueData.sports[sportKey].mvp = leagueData.sports[sportKey].mvp.filter(player => player.id !== Number(button.dataset.id));
      saveAndRefreshAdmin('Zawodnik został usunięty.');
    });
  });
}

function initAdminPanel() {
  if (!document.getElementById('admin-content')) return;

  const logoutButton = document.getElementById('admin-logout');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('ligaLgbtAdmin');
      showToast('Wylogowano.', 'info', 2000);
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 800);
    });
  }

  saveAndRefreshAdmin();
}

function initPage() {
  const page = document.body.dataset.page || document.documentElement.dataset.page;
  if (page === 'login') {
    initLoginPage();
    return;
  }
  if (page === 'admin') {
    requireAdminAuth();
    initAdminPanel();
    return;
  }
  if (page === 'clubs') {
    renderClubsPage();
    return;
  }
  if (page === 'rankings') {
    renderPublicRankingsPage();
    return;
  }
  if (page === 'sport') {
    renderTeams();
    renderResults();
    renderMvp();
  }
}

window.addEventListener('DOMContentLoaded', initPage);
window.addEventListener('DOMContentLoaded', initNavigation);
window.addEventListener('DOMContentLoaded', initHeaderScrollState);
window.addEventListener('DOMContentLoaded', initStaticForms);
