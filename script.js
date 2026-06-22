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

function isAdminLoggedIn() {
  const auth = localStorage.getItem('ligaLgbtAdmin');
  if (!auth) return false;
  try {
    return JSON.parse(auth).loggedIn === true;
  } catch {
    return false;
  }
}

function initNavigation() {
  const navs = document.querySelectorAll('.main-nav');
  if (!navs.length) return;
  const closeTimers = new WeakMap();

  function clearCloseTimer(group) {
    const timer = closeTimers.get(group);
    if (!timer) return;
    window.clearTimeout(timer);
    closeTimers.delete(group);
  }

  function closeGroup(group) {
    clearCloseTimer(group);
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
    clearCloseTimer(group);
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
        if (isOpen) {
          closeGroup(group);
        } else {
          openGroup(group);
        }
      });
    });

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      nav.querySelectorAll('.nav-group').forEach(group => {
        group.addEventListener('mouseenter', () => openGroup(group));
      });
    }

    nav.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const openGroup = nav.querySelector('.nav-group.is-open');
      if (!openGroup) return;
      closeGroup(openGroup);
      openGroup.querySelector('.nav-trigger')?.focus();
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
    const formData = new FormData(form);
    const password = formData.get('password').toString().trim();

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
  leagueData.teams.forEach(team => {
    const card = document.createElement('article');
    card.className = 'team-card';
    card.innerHTML = `<h3>${team.name}</h3><p>${team.description}</p>`;
    section.appendChild(card);
  });
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

  section.innerHTML = '';
  if (!sport.results.length) {
    section.innerHTML = '<p class="empty-state">Brak aktualnych wyników.</p>';
    return;
  }

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Poziom</th><th>Drużyna 1</th><th>Wynik</th><th>Drużyna 2</th></tr></thead>';
  const body = document.createElement('tbody');
  sport.results.slice(0, 8).forEach(match => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${match.level || '-'}</td><td>${match.home}</td><td><strong>${match.score}</strong></td><td>${match.away}</td>`;
    body.appendChild(row);
  });
  table.appendChild(body);
  section.appendChild(table);
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

  section.innerHTML = '';
  if (!sport.mvp.length) {
    section.innerHTML = '<p class="empty-state">Brak rankingu MVP.</p>';
    return;
  }

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>#</th><th>Zawodnik</th><th>Drużyna</th><th>Punkty</th></tr></thead>';
  const body = document.createElement('tbody');
  sport.mvp.slice().sort((a, b) => b.points - a.points).forEach((player, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${index + 1}</td><td>${player.player}</td><td>${player.team}</td><td><strong>${player.points}</strong></td>`;
    body.appendChild(row);
  });
  table.appendChild(body);
  section.appendChild(table);
}

function buildSportOptions(select) {
  select.innerHTML = '';
  Object.keys(leagueData.sports).forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = leagueData.sports[key].name;
    select.appendChild(option);
  });
}

function initAdminPanel() {
  const editor = document.getElementById('team-editor');
  if (!editor) return;

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

  editor.innerHTML = '';
  const form = document.createElement('form');
  form.innerHTML = `
    <fieldset>
      <legend>Dodaj lub edytuj zespół</legend>
      <label>Nazwa zespołu<input type="text" name="name" required /></label>
      <label>Miasto<input type="text" name="city" required /></label>
      <label>Opis<textarea name="description" required></textarea></label>
      <label>Logo (URL)<input type="url" name="logo" placeholder="https://" /></label>
      <button type="submit">Zapisz zespół</button>
    </fieldset>
  `;
  editor.appendChild(form);

  const list = document.createElement('div');
  editor.appendChild(list);

  function refreshTeamList() {
    list.innerHTML = '<h4>Aktualne zespoły</h4>';
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Nazwa</th><th>Miasto</th><th>Akcje</th></tr></thead>';
    const body = document.createElement('tbody');
    leagueData.teams.forEach(team => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${team.name}</td><td>${team.city}</td><td><button type="button" data-id="${team.id}" class="edit-team compact-button">Edytuj</button></td>`;
      body.appendChild(row);
    });
    table.appendChild(body);
    list.appendChild(table);
  }

  refreshTeamList();

  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = formData.get('name').toString().trim();
    const city = formData.get('city').toString().trim();
    const description = formData.get('description').toString().trim();
    const logo = formData.get('logo').toString().trim();

    if (!name || !city || !description) {
      showToast('Uzupełnij nazwę, miasto i opis zespołu.', 'error');
      return;
    }
    if (name.length < 3) {
      showToast('Nazwa zespołu powinna mieć co najmniej 3 znaki.', 'warning');
      return;
    }
    if (description.length < 10) {
      showToast('Opis powinien mieć co najmniej 10 znaków.', 'warning');
      return;
    }

    const existing = leagueData.teams.find(team => team.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.city = city;
      existing.description = description;
      existing.logo = logo;
      showToast(`Zespół "${name}" został zaktualizowany.`, 'success');
    } else {
      const nextId = Math.max(0, ...leagueData.teams.map(team => team.id)) + 1;
      leagueData.teams.push({ id: nextId, name, city, description, logo });
      showToast(`Dodano zespół "${name}".`, 'success');
    }

    saveLeagueData(leagueData);
    refreshTeamList();
    form.reset();
    renderTeams();
  });

  list.addEventListener('click', event => {
    if (!event.target.matches('.edit-team')) return;
    const id = Number(event.target.dataset.id);
    const team = leagueData.teams.find(item => item.id === id);
    if (!team) return;
    form.name.value = team.name;
    form.city.value = team.city;
    form.description.value = team.description;
    form.logo.value = team.logo;
  });

  initResultsEditor();
  initMvpEditor();
}

function initResultsEditor() {
  const editor = document.getElementById('results-editor');
  if (!editor) return;

  editor.innerHTML = '';
  const nav = document.createElement('div');
  nav.className = 'editor-toolbar';
  nav.innerHTML = '<label>Wybierz dyscyplinę<select id="results-sport"></select></label>';
  editor.appendChild(nav);

  const form = document.createElement('form');
  form.innerHTML = `
    <fieldset>
      <legend>Dodaj wynik</legend>
      <label>Dyscyplina<select name="sport" id="editor-sport" required></select></label>
      <label>Poziom<input type="text" name="level" placeholder="B, B-, C, D" /></label>
      <label>Drużyna 1<select name="home" required></select></label>
      <label>Wynik<input type="text" name="score" required placeholder="3:1" /></label>
      <label>Drużyna 2<select name="away" required></select></label>
      <button type="submit">Dodaj wynik</button>
    </fieldset>
  `;
  editor.appendChild(form);

  const list = document.createElement('div');
  editor.appendChild(list);

  const editorSport = form.querySelector('#editor-sport');
  const resultsSport = nav.querySelector('#results-sport');
  if (!editorSport || !resultsSport) return;

  buildSportOptions(editorSport);
  buildSportOptions(resultsSport);

  function refreshList() {
    const sportKey = resultsSport.value;
    const sport = leagueData.sports[sportKey];
    list.innerHTML = '<h4>Wyniki</h4>';
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Poziom</th><th>Drużyna 1</th><th>Wynik</th><th>Drużyna 2</th></tr></thead>';
    const body = document.createElement('tbody');
    sport.results.slice(0, 8).forEach(match => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${match.level || '-'}</td><td>${match.home}</td><td>${match.score}</td><td>${match.away}</td>`;
      body.appendChild(row);
    });
    table.appendChild(body);
    list.appendChild(table);
  }

  function fillTeamSelects() {
    const teamOptions = leagueData.teams.map(team => `<option value="${team.name}">${team.name}</option>`).join('');
    form.home.innerHTML = teamOptions;
    form.away.innerHTML = teamOptions;
  }

  refreshList();
  fillTeamSelects();
  resultsSport.addEventListener('change', refreshList);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const sportKey = formData.get('sport').toString();
    const level = formData.get('level').toString().trim();
    const home = formData.get('home').toString();
    const away = formData.get('away').toString();
    const score = formData.get('score').toString().trim();

    if (!home || !away || !score) {
      showToast('Wybierz drużyny i wpisz wynik.', 'error');
      return;
    }
    if (home === away) {
      showToast('Drużyny w jednym meczu muszą być różne.', 'warning');
      return;
    }
    if (!/^\d+:\d+$/.test(score)) {
      showToast('Wynik wpisz w formacie X:Y, np. 3:1.', 'warning');
      return;
    }

    const sport = leagueData.sports[sportKey];
    if (!sport) {
      showToast('Wybrana dyscyplina nie istnieje.', 'error');
      return;
    }
    if (sport.results.length >= 8) {
      showToast('Maksymalnie 8 wyników dla jednej dyscypliny.', 'warning');
      return;
    }

    const nextId = Math.max(0, ...sport.results.map(item => item.id)) + 1;
    sport.results.push({ id: nextId, home, away, score, level });
    saveLeagueData(leagueData);
    refreshList();
    renderResults();
    form.reset();
    showToast(`Dodano wynik ${home} ${score} ${away}.`, 'success');
  });
}

function initMvpEditor() {
  const editor = document.getElementById('mvp-editor');
  if (!editor) return;

  editor.innerHTML = '';
  const nav = document.createElement('div');
  nav.className = 'editor-toolbar';
  nav.innerHTML = '<label>Wybierz dyscyplinę<select id="mvp-sport"></select></label>';
  editor.appendChild(nav);

  const form = document.createElement('form');
  form.innerHTML = `
    <fieldset>
      <legend>Dodaj zawodnika MVP</legend>
      <label>Dyscyplina<select name="sport" id="editor-mvp-sport" required></select></label>
      <label>Zawodnik<input type="text" name="player" required /></label>
      <label>Drużyna<input type="text" name="team" required /></label>
      <label>Punkty<input type="number" name="points" required min="0" /></label>
      <button type="submit">Dodaj MVP</button>
    </fieldset>
  `;
  editor.appendChild(form);

  const list = document.createElement('div');
  editor.appendChild(list);

  const sportSelect = form.querySelector('#editor-mvp-sport');
  const mvpSport = nav.querySelector('#mvp-sport');
  if (!sportSelect || !mvpSport) return;

  buildSportOptions(sportSelect);
  buildSportOptions(mvpSport);

  function refreshList() {
    const sportKey = mvpSport.value;
    const sport = leagueData.sports[sportKey];
    list.innerHTML = '<h4>Ranking MVP</h4>';
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>#</th><th>Zawodnik</th><th>Drużyna</th><th>Punkty</th></tr></thead>';
    const body = document.createElement('tbody');
    sport.mvp.slice().sort((a, b) => b.points - a.points).forEach((player, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${index + 1}</td><td>${player.player}</td><td>${player.team}</td><td>${player.points}</td>`;
      body.appendChild(row);
    });
    table.appendChild(body);
    list.appendChild(table);
  }

  refreshList();
  mvpSport.addEventListener('change', refreshList);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const sportKey = formData.get('sport').toString();
    const player = formData.get('player').toString().trim();
    const team = formData.get('team').toString().trim();
    const points = Number(formData.get('points'));

    if (!player || !team || Number.isNaN(points) || points < 0) {
      showToast('Uzupełnij zawodnika, drużynę i poprawną liczbę punktów.', 'error');
      return;
    }
    if (player.length < 3) {
      showToast('Imię lub nazwa zawodnika powinna mieć co najmniej 3 znaki.', 'warning');
      return;
    }
    if (points > 999) {
      showToast('Punkty są zbyt wysokie. Maksymalna wartość to 999.', 'warning');
      return;
    }

    const sport = leagueData.sports[sportKey];
    if (!sport) {
      showToast('Wybrana dyscyplina nie istnieje.', 'error');
      return;
    }

    const nextId = Math.max(0, ...sport.mvp.map(item => item.id)) + 1;
    sport.mvp.push({ id: nextId, player, team, points });
    saveLeagueData(leagueData);
    refreshList();
    renderMvp();
    form.reset();
    showToast(`Dodano zawodnika "${player}" do rankingu MVP.`, 'success');
  });
}

function initPage() {
  const page = document.body.dataset.page || document.documentElement.dataset.page;
  if (page === 'home') return;
  if (page === 'login') {
    initLoginPage();
    return;
  }
  if (page === 'admin') {
    requireAdminAuth();
    initAdminPanel();
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
