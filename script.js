function getSportKey() {
  const sport = document.body.dataset.sport;
  return sport || null;
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

function initLoginPage() {
  if (isAdminLoggedIn()) {
    window.location.href = 'admin.html';
    return;
  }

  const form = document.getElementById('login-form');
  if (!form) return;

  const errorElement = document.createElement('p');
  errorElement.className = 'login-error';
  form.appendChild(errorElement);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const password = formData.get('password').toString().trim();
    if (password === leagueData.admin.password) {
      localStorage.setItem('ligaLgbtAdmin', JSON.stringify({ loggedIn: true }));
      window.location.href = 'admin.html';
      return;
    }
    errorElement.textContent = 'Nieprawidłowe hasło. Spróbuj ponownie.';
  });
}

function requireAdminAuth() {
  if (!isAdminLoggedIn()) {
    window.location.href = 'login.html';
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
    section.innerHTML = '<p>Brak aktualnych wyników.</p>';
    return;
  }

  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Poziom</th><th>Drużyna 1</th><th>Wynik</th><th>Drużyna 2</th></tr></thead>`;
  const body = document.createElement('tbody');
  sport.results.slice(0, 8).forEach(match => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${match.level || '-'}</td><td>${match.home}</td><td>${match.score}</td><td>${match.away}</td>`;
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
    section.innerHTML = '<p>Brak rankingu MVP.</p>';
    return;
  }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>#</th><th>Zawodnik</th><th>Drużyna</th><th>Punkty</th></tr></thead>`;
  const body = document.createElement('tbody');
  sport.mvp.sort((a, b) => b.points - a.points).forEach((player, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${index + 1}</td><td>${player.player}</td><td>${player.team}</td><td>${player.points}</td>`;
    body.appendChild(row);
  });
  table.appendChild(body);
  section.appendChild(table);
}

function initAdminPanel() {
  const editor = document.getElementById('team-editor');
  if (!editor) return;

  const logoutButton = document.getElementById('admin-logout');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('ligaLgbtAdmin');
      window.location.href = 'login.html';
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
    table.innerHTML = `<thead><tr><th>Nazwa</th><th>Miasto</th><th>Akcje</th></tr></thead>`;
    const body = document.createElement('tbody');
    leagueData.teams.forEach(team => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${team.name}</td><td>${team.city}</td><td><button type="button" data-id="${team.id}" class="edit-team">Edytuj</button></td>`;
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

    const existing = leagueData.teams.find(team => team.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.city = city;
      existing.description = description;
      existing.logo = logo;
    } else {
      const nextId = Math.max(0, ...leagueData.teams.map(team => team.id)) + 1;
      leagueData.teams.push({ id: nextId, name, city, description, logo });
    }

    saveLeagueData(leagueData);
    refreshTeamList();
    form.reset();
    renderTeams();
  });

  list.addEventListener('click', event => {
    if (event.target.matches('.edit-team')) {
      const id = Number(event.target.dataset.id);
      const team = leagueData.teams.find(item => item.id === id);
      if (!team) return;
      form.name.value = team.name;
      form.city.value = team.city;
      form.description.value = team.description;
      form.logo.value = team.logo;
    }
  });

  initResultsEditor();
  initMvpEditor();
}

function initResultsEditor() {
  const editor = document.getElementById('results-editor');
  if (!editor) return;
  editor.innerHTML = '';
  const nav = document.createElement('div');
  nav.className = 'results-nav';
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

  function buildSportOptions(select) {
    select.innerHTML = '';
    Object.keys(leagueData.sports).forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = leagueData.sports[key].name;
      select.appendChild(option);
    });
  }

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
    table.innerHTML = `<thead><tr><th>Poziom</th><th>Drużyna 1</th><th>Wynik</th><th>Drużyna 2</th></tr></thead>`;
    const body = document.createElement('tbody');
    sport.results.slice(0, 8).forEach(match => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${match.level || '-'}</td><td>${match.home}</td><td>${match.score}</td><td>${match.away}</td>`;
      body.appendChild(row);
    });
    table.appendChild(body);
    list.appendChild(table);
  }

  refreshList();
  resultsSport.addEventListener('change', refreshList);

  function fillTeamSelects() {
    const teamOptions = leagueData.teams.map(team => `<option value="${team.name}">${team.name}</option>`).join('');
    form.home.innerHTML = teamOptions;
    form.away.innerHTML = teamOptions;
  }
  fillTeamSelects();

  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const sportKey = formData.get('sport').toString();
    const level = formData.get('level').toString().trim();
    const home = formData.get('home').toString();
    const away = formData.get('away').toString();
    const score = formData.get('score').toString().trim();

    const sport = leagueData.sports[sportKey];
    if (!sport) return;
    if (sport.results.length >= 8) {
      alert('Maksymalnie 8 wyników można przechowywać dla dyscypliny.');
      return;
    }
    const nextId = Math.max(0, ...sport.results.map(item => item.id)) + 1;
    sport.results.push({ id: nextId, home, away, score, level });
    saveLeagueData(leagueData);
    refreshList();
    renderResults();
    form.reset();
  });
}

function initMvpEditor() {
  const editor = document.getElementById('mvp-editor');
  if (!editor) return;
  editor.innerHTML = '';
  const nav = document.createElement('div');
  nav.className = 'mvp-nav';
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

  function buildSportOptions(select) {
    select.innerHTML = '';
    Object.keys(leagueData.sports).forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = leagueData.sports[key].name;
      select.appendChild(option);
    });
  }
  buildSportOptions(sportSelect);
  buildSportOptions(mvpSport);

  function refreshList() {
    const sportKey = mvpSport.value;
    const sport = leagueData.sports[sportKey];
    list.innerHTML = '<h4>Ranking MVP</h4>';
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>#</th><th>Zawodnik</th><th>Drużyna</th><th>Punkty</th></tr></thead>`;
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

    const sport = leagueData.sports[sportKey];
    if (!sport) return;

    const nextId = Math.max(0, ...sport.mvp.map(item => item.id)) + 1;
    sport.mvp.push({ id: nextId, player, team, points });
    saveLeagueData(leagueData);
    refreshList();
    renderMvp();
    form.reset();
  });
}

function initPage() {
  const page = document.body.dataset.page;
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
