// Standalone release check: node tests/pwa-update.cjs
// Requires desktop Chrome and an interactive desktop. Uses loopback and fresh profiles only.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const revision = '3b0455b';
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const old = new Map();
const current = new Map();
const assets = ['index.html', 'app.js', 'style.css', 'sw.js', 'import.js', 'manifest.json', 'favicon.png', 'icon-192.png', 'icon-512.png'];
const git = (...args) => execFileSync('git', args, { cwd: root });
const digest = value => createHash('sha256').update(value).digest('hex');
const cacheName = files => files.get('sw.js').toString().match(/CACHE_NAME = '([^']+)'/)[1];
const precache = files => Array.from(files.get('sw.js').toString().split('];')[0].matchAll(/'\.\/([^']*)'/g), m => `/${m[1]}`).sort();
const snapshot = page => page.evaluate(() => ({
  storage: Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])),
  state: JSON.parse(JSON.stringify({ programs: app.programs, currentProgramId: app.currentProgramId,
    logs: app.workoutLogs, active: app.activeWorkout }))
}));

async function exercise(page) {
  await page.locator('[data-day-id="a"]').click();
  for (const [field, value] of [['weight', '65'], ['reps', '8']]) {
    await page.locator(`.metric-btn[onclick*="'${field}'"]`).first().click();
    for (const digit of value) await page.locator('#numpadSheet').getByRole('button', { name: digit, exact: true }).click();
    await page.locator('#numpadSheet').getByRole('button', { name: 'Готово' }).click();
  }
}

async function verify(page, files, before) {
  const responses = new Map();
  const collect = response => {
    const name = new URL(response.url()).pathname.slice(1);
    if (['app.js', 'style.css', 'import.js', 'index.html'].includes(name)) responses.set(name, response);
  };
  page.on('response', collect);
  try { await page.reload({ waitUntil: 'load', timeout: 12000 }); }
  finally { page.off('response', collect); }
  await expect(page.locator('#viewProgram')).toHaveClass(/active/);
  for (const name of ['index.html', 'app.js', 'style.css', ...(files.has('import.js') ? ['import.js'] : [])]) {
    const response = responses.get(name);
    const body = await response.body();
    // Chrome CDP can strip a UTF-8 BOM from text response bodies.
    const content = value => value.toString('utf8').replace(/^\uFEFF/, '');
    assert.equal(digest(content(body)), digest(content(files.get(name))), `${name} (${response.status()}, ${body.length} bytes)`);
  }
  assert.deepEqual(await snapshot(page), before);
  await page.locator('.active-card').click();
  await expect(page.locator('.metric-btn[onclick*="\'weight\'"]').first()).toHaveText('65 кг');
  await expect(page.locator('.metric-btn[onclick*="\'reps\'"]').first()).toHaveText('8 раз');
}

async function scenario(kind) {
  const profile = await fs.mkdtemp(path.join(process.env.PWA_TEST_TEMP || os.tmpdir(), 'gym-pwa-'));
  let mode = 'old';
  const rejected = [];
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://127.0.0.1').pathname.slice(1) || 'index.html';
    if (mode === 'offline') return req.socket.destroy();
    if ((mode === 'reject-worker' && name === 'sw.js') || (mode === 'missing-asset' && name === 'import.js')) {
      rejected.push(name);
      res.writeHead(503).end();
      return;
    }
    const body = (mode === 'old' || mode === 'reject-worker' ? old : current).get(name);
    if (!body) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': mime[path.extname(name)], 'Cache-Control': 'no-store' }).end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const manifestId = `${origin}/index.html`;
  let context, cdp, installed = false;
  const diagnostics = [];
  try {
    context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: false, viewport: { width: 390, height: 844 } });
    context.on('console', msg => { if (['error', 'warning'].includes(msg.type()) || msg.text().includes('ServiceWorker error:')) diagnostics.push(msg.text()); });
    const observe = page => page.on('pageerror', err => diagnostics.push(`pageerror: ${err.message}`));
    const tab = context.pages()[0];
    observe(tab);
    await tab.goto(manifestId);
    await tab.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');
    cdp = await context.newCDPSession(tab);
    let page = tab;
    await cdp.send('PWA.install', { manifestId, installUrlOrBundleUrl: manifestId });
    installed = true;
    await cdp.send('PWA.changeAppUserSettings', { manifestId, displayMode: 'standalone' });
    const launch = async () => {
      const next = context.waitForEvent('page', { timeout: 15000 });
      await cdp.send('PWA.launch', { manifestId });
      const window = await next;
      observe(window);
      await window.waitForFunction(() => !!document.querySelector('#viewProgram.active'), null, { timeout: 10000 });
      const display = await window.evaluate(() => ['standalone', 'minimal-ui', 'browser'].find(mode => matchMedia(`(display-mode: ${mode})`).matches));
      console.log(`${kind}: Chrome launch display mode: ${display}`);
      assert.equal(display, 'standalone');
      return window;
    };
    page = await launch();
    await tab.goto('about:blank'); // Keep CDP available without a second app client.
    await page.evaluate(() => {
      const exercise = { id: 'pwa-exercise', name: 'Synthetic exercise', targetWeight: 50, targetReps: '10', targetSets: 3, notes: '' };
      localStorage.setItem('gym_programs_v1', JSON.stringify([{ id: 'pwa-program', name: 'Synthetic program', days: [
        { id: 'a', name: 'Synthetic A', exercises: [exercise] }, { id: 'b', name: 'Synthetic B', exercises: [exercise] }
      ] }]));
      localStorage.setItem('gym_current_program_id_v1', 'pwa-program');
      localStorage.setItem('gym_workout_logs_v1', JSON.stringify([{ id: 'synthetic-log', date: '2026-10-01T10:00:00Z', dayId: 'b', dayName: 'Synthetic B', entries: [{ exerciseId: exercise.id, sets: [{ weight: 40, reps: 12, timestamp: 1000 }] }] }]));
    });
    await page.reload();
    await exercise(page);
    const before = await snapshot(page);
    assert.equal(before.state.logs.length, 1);
    assert.equal(before.state.programs[0].days.length, 2);
    assert.equal(before.state.active.inputs['pwa-exercise'].weight, 65);
    const list = () => page.evaluate(() => caches.keys());
    const keys = name => page.evaluate(async name => (await (await caches.open(name)).keys()).map(req => new URL(req.url).pathname).sort(), name);
    const checkPrecache = async files => {
      const cached = await keys(cacheName(files));
      assert.deepEqual(precache(files).filter(url => !cached.includes(url)), []);
      console.log(`${kind}: ${precache(files).length} precached assets present in ${cacheName(files)}`);
    };
    await checkPrecache(old);
    mode = 'offline';
    await verify(page, old, before);
    page.on('console', msg => { if (msg.text().startsWith('Cache addAll')) console.log(msg.text()); });
    const sw = await context.newCDPSession(page);
    sw.on('ServiceWorker.workerErrorReported', ({ errorMessage }) => diagnostics.push(`worker: ${errorMessage.errorMessage}`));
    await sw.send('ServiceWorker.enable');
    const watch = client => client.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      window.originalController = navigator.serviceWorker.controller;
      window.candidate = null;
      reg.onupdatefound = () => { window.candidate = reg.installing; };
    });
    const requestUpdate = () => page.evaluate(async () => {
      try { await (await navigator.serviceWorker.getRegistration()).update(); return 'resolved'; }
      catch (error) { return error.message; }
    });
    const waitForNewController = client => client.waitForFunction(() => {
      const controller = navigator.serviceWorker.controller;
      return controller !== window.originalController && controller?.state === 'activated';
    });
    const reopen = async () => {
      await page.close();
      page = await launch();
    };
    const verifySuccessfulUpdate = async (secondary) => {
      await waitForNewController(page);
      if (secondary) await waitForNewController(secondary);
      assert.deepEqual(await list(), [cacheName(current)]);
      assert.deepEqual(await snapshot(page), before);
      console.log(`${kind}: new controller active; only ${cacheName(current)} remains${secondary ? '; both open clients claimed' : ''}`);
      await checkPrecache(current);
      await verify(page, current, before);
      mode = 'offline';
      await verify(page, current, before);
      await reopen();
      await verify(page, current, before);
      console.log(`${kind}: offline standalone restart; data and current assets verified`);
    };
    await watch(page);
    if (kind === 'current') {
      mode = 'old';
      const secondary = await context.newPage();
      await secondary.goto(manifestId);
      await secondary.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');
      await watch(secondary);
      mode = 'current';
      assert.equal(await requestUpdate(), 'resolved');
      await verifySuccessfulUpdate(secondary);
      await secondary.close();
      assert.deepEqual(diagnostics.filter(message => /^(pageerror:|worker:|ServiceWorker error:|Cache addAll)/.test(message)), [], 'unexpected app/worker errors');
    } else {
      mode = kind;
      const update = await requestUpdate();
      if (kind === 'reject-worker') assert.notEqual(update, 'resolved');
      else await page.waitForFunction(() => window.candidate?.state === 'redundant', null, { timeout: 10000 });
      assert.ok(rejected.includes(kind === 'reject-worker' ? 'sw.js' : 'import.js'));
      await page.waitForFunction(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return !reg.installing && !reg.waiting && reg.active?.state === 'activated';
      });
      const versions = await list();
      const oldStillActive = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg.active === window.originalController && navigator.serviceWorker.controller === window.originalController;
      });
      assert.deepEqual(await snapshot(page), before);
      assert.equal(oldStillActive, true, 'failed update must not replace the active worker');
      assert.deepEqual(versions, [cacheName(old)], 'only the working cache must remain');
      await checkPrecache(old);
      console.log(`${kind}: HTTP 503 confirmed; old controller retained; caches: ${versions.join(', ')}`);
      mode = 'offline';
      await verify(page, old, before);
      await reopen();
      await verify(page, old, before);
      console.log(`${kind}: offline standalone restart on v40; original data and assets verified`);
      if (kind === 'missing-asset') {
        await watch(page);
        mode = 'current';
        assert.equal(await requestUpdate(), 'resolved');
        await verifySuccessfulUpdate();
      }
    }
    console.log(`${kind}: PASS`);
  } finally {
    console.log(`${kind}: diagnostics ${JSON.stringify([...new Set(diagnostics)])}`);
    if (installed) await cdp.send('PWA.uninstall', { manifestId }).catch(console.error);
    if (context) await context.close();
    await new Promise(resolve => server.close(resolve));
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5 }).catch(console.error);
  }
}

(async () => {
  for (const name of [...assets, ...git('ls-tree', '-r', '--name-only', revision, '--', 'icons').toString().trim().split(/\r?\n/)]) {
    if (name !== 'import.js') old.set(name, git('show', `${revision}:${name}`));
  }
  for (const name of [...assets, ...(await fs.readdir(path.join(root, 'icons'))).filter(name => name.endsWith('.svg')).map(name => `icons/${name}`)]) {
    current.set(name, await fs.readFile(path.join(root, name)));
  }
  console.log(`${revision} ${cacheName(old)} -> working tree ${cacheName(current)}`);
  for (const kind of process.argv.length > 2 ? process.argv.slice(2) : ['current', 'reject-worker', 'missing-asset']) {
    try { await scenario(kind); } catch (error) { console.error(`${kind}: FAIL`, error); process.exitCode = 1; }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
