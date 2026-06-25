const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const baseUrl = process.env.VISUAL_BASE_URL || 'http://127.0.0.1:4179';
const outputDirectory = process.env.VISUAL_OUTPUT_DIR || path.join(os.tmpdir(), 'ligalgbt-visual-audit');
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean);
const chromePath = chromeCandidates.find(candidate => fs.existsSync(candidate));
if (!chromePath) throw new Error('Nie znaleziono Chrome/Edge. Ustaw CHROME_PATH.');

fs.mkdirSync(outputDirectory, { recursive: true });

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForDebugger(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {}
    await delay(100);
  }
  throw new Error('Chrome DevTools Protocol nie uruchomił się.');
}

async function waitForPage(cdp, sessionId, expectedUrl) {
  const expectedPathname = new URL(expectedUrl).pathname;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const evaluation = await cdp.send('Runtime.evaluate', {
      expression: `({ ready: document.readyState, url: location.href })`,
      returnByValue: true
    }, sessionId);
    const value = evaluation.result.value;
    if (value.ready === 'complete' && new URL(value.url).pathname === expectedPathname) return;
    await delay(100);
  }
  throw new Error(`Strona nie zakończyła nawigacji: ${expectedUrl}`);
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    const key = `${message.sessionId || 'browser'}:${message.method}`;
    const callbacks = listeners.get(key) || [];
    callbacks.splice(0).forEach(callback => callback(message.params));
  });

  function send(method, params = {}, sessionId = undefined) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  function once(method, sessionId = undefined) {
    const key = `${sessionId || 'browser'}:${method}`;
    return new Promise(resolve => {
      const callbacks = listeners.get(key) || [];
      callbacks.push(resolve);
      listeners.set(key, callbacks);
    });
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout połączenia z Chrome DevTools Protocol.')), 5000);
    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve({ socket, send, once });
    });
    socket.addEventListener('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

const scenarios = [
  { name: 'sport', path: '/siatkowka.html' },
  { name: 'tournament', path: '/tests/tournament-preview.html' },
  { name: 'tournament-wizard', path: '/tests/tournament-wizard-preview.html?step=5' },
  { name: 'admin-results', path: '/tests/result-form-preview.html?mode=tournament' },
  { name: 'standings', path: '/tests/standings-preview.html' },
  { name: 'public-results', path: '/tests/public-results-preview.html?sport=siatkowka&season=2026&rozgrywki=league&level=B' },
  { name: 'public-tournaments', path: '/tests/public-tournaments-preview.html' },
  { name: 'calendar', path: '/tests/calendar-preview.html' },
  { name: 'admin-players', path: '/tests/player-directory-preview.html?sort=club&mobile=1' }
];
const viewports = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 }
];

const auditExpression = `(() => {
  const ignored = '.tournament-flow, .tournament-bracket-scroll, .tournament-table-scroll, .player-table-scroll, .admin-table-scroll, .standings-table-scroll, .wizard-stepper, table';
  const elements = [...document.body.querySelectorAll('*')];
  const unexpectedOverflow = elements.filter(element => {
    if (element.closest(ignored)) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') return false;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    return rect.left < -1 || rect.right > innerWidth + 1;
  }).slice(0, 10).map(element => ({
    tag: element.tagName,
    id: element.id,
    className: String(element.className || '').slice(0, 80)
  }));
  const bracket = document.querySelector('.tournament-bracket-scroll');
  const header = document.querySelector('.site-header');
  return {
    viewport: { width: innerWidth, height: innerHeight },
    document: {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    },
    unexpectedOverflow,
    bracket: bracket ? {
      clientWidth: bracket.clientWidth,
      scrollWidth: bracket.scrollWidth,
      controlled: bracket.scrollWidth >= bracket.clientWidth
    } : null,
    headerPresent: Boolean(header),
    charset: document.characterSet,
    replacementCharacters: (document.body.innerText.match(/\\uFFFD/g) || []).length,
    bodyText: document.body.innerText.slice(0, 180),
    previewLength: document.getElementById('preview')?.innerHTML.length ?? null
  };
})()`;

async function run() {
  const debuggerPort = 9300 + Math.floor(Math.random() * 300);
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ligalgbt-chrome-'));
  const browser = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${debuggerPort}`,
    `--user-data-dir=${profileDirectory}`,
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const version = await waitForDebugger(debuggerPort);
    const cdp = await createCdpClient(version.webSocketDebuggerUrl);
    const results = [];

    for (const viewport of viewports) {
      for (const scenario of scenarios) {
        const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
        const attachment = await cdp.send('Target.attachToTarget', {
          targetId: target.targetId,
          flatten: true
        });
        const sessionId = attachment.sessionId;
        await cdp.send('Page.enable', {}, sessionId);
        await cdp.send('Runtime.enable', {}, sessionId);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: false,
          screenWidth: viewport.width,
          screenHeight: viewport.height
        }, sessionId);
        const targetUrl = `${baseUrl}${scenario.path}`;
        await cdp.send('Page.navigate', { url: targetUrl }, sessionId);
        await waitForPage(cdp, sessionId, targetUrl);
        await delay(900);

        const evaluation = await cdp.send('Runtime.evaluate', {
          expression: auditExpression,
          returnByValue: true
        }, sessionId);
        const metrics = evaluation.result.value;
        if (metrics.document.overflow || metrics.unexpectedOverflow.length || (scenario.name === 'tournament' && !metrics.bracket)) {
          console.error(JSON.stringify({ scenario: scenario.name, viewport, metrics }, null, 2));
        }
        assert.equal(metrics.viewport.width, viewport.width, `${scenario.name}: zła szerokość viewportu`);
        assert.equal(metrics.document.overflow, false, `${scenario.name} ${viewport.width}: poziomy overflow dokumentu`);
        assert.deepEqual(metrics.unexpectedOverflow, [], `${scenario.name} ${viewport.width}: element poza viewportem`);
        assert.equal(metrics.charset, 'UTF-8');
        assert.equal(metrics.replacementCharacters, 0);
        if (scenario.name === 'tournament' && viewport.width <= 768) {
          assert.equal(metrics.bracket?.controlled, true, 'Drabinka nie ma kontrolowanego przewijania');
        }

        if (metrics.headerPresent && scenario.name !== 'admin-players') {
          await cdp.send('Runtime.evaluate', { expression: 'scrollTo(0, 140)' }, sessionId);
          await delay(150);
          const collapsed = await cdp.send('Runtime.evaluate', {
            expression: `document.querySelector('.site-header').classList.contains('is-condensed')`,
            returnByValue: true
          }, sessionId);
          await cdp.send('Runtime.evaluate', { expression: 'scrollTo(0, 80)' }, sessionId);
          await delay(150);
          const hysteresis = await cdp.send('Runtime.evaluate', {
            expression: `document.querySelector('.site-header').classList.contains('is-condensed')`,
            returnByValue: true
          }, sessionId);
          if (viewport.width >= 981) {
            assert.equal(collapsed.result.value, true, 'Nagłówek nie kurczy się po przewinięciu');
            assert.equal(hysteresis.result.value, true, 'Nagłówek tańczy w strefie histerezy');
          } else {
            assert.equal(collapsed.result.value, false, 'Mobilny nagłówek nie powinien być fixed/condensed');
          }
        }

        const screenshot = await cdp.send('Page.captureScreenshot', {
          format: 'png',
          fromSurface: true,
          captureBeyondViewport: false
        }, sessionId);
        const fileName = `${scenario.name}-${viewport.width}x${viewport.height}.png`;
        fs.writeFileSync(path.join(outputDirectory, fileName), Buffer.from(screenshot.data, 'base64'));
        results.push({ scenario: scenario.name, ...viewport, metrics, screenshot: fileName });
        await cdp.send('Target.closeTarget', { targetId: target.targetId });
      }
    }

    cdp.socket.close();
    console.log(JSON.stringify({ outputDirectory, results }, null, 2));
  } finally {
    browser.kill();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
