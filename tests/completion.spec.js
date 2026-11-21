const { test: base, expect } = require('@playwright/test');
const test = base.extend({ page: async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    if (localStorage.getItem('gym_programs_v1')) return;
    const exercise = { id: 'e', name: 'Synthetic exercise', targetWeight: 50, targetSets: 3, targetReps: '10', notes: '' };
    localStorage.setItem('gym_programs_v1', JSON.stringify([{ id: 'p', name: 'P', days: [
      { id: 'a', name: 'A', exercises: [exercise] }, { id: 'b', name: 'B', exercises: [exercise] }
    ] }]));
    localStorage.setItem('gym_workout_logs_v1', JSON.stringify([{ id: 'unrelated', date: '2026-10-01T10:00:00Z', entries: [{ exerciseId: 'e', sets: [{ weight: 20, reps: 8, timestamp: 1000 }] }] }]));
  });
  await page.goto('/'); await page.locator('[data-day-id=a]').click();
  for (const [field, value] of [['weight', '65'], ['reps', '10'], ['count', '3']]) {
    await page.locator(`.metric-btn[onclick*="'${field}'"]`).first().click();
    for (const digit of value) await page.locator('#numpadSheet').getByRole('button', { name: digit, exact: true }).click();
    await page.locator('#numpadSheet').getByRole('button', { name: 'Готово', exact: true }).click();
  }
  await use(page); expect(errors).toEqual([]);
} });
const snap = page => page.evaluate(() => ({ state: JSON.parse(JSON.stringify(app.getImportState())),
  inputs: JSON.parse(JSON.stringify(app.exerciseInputState)),
  storage: Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])) }));
async function mode(page, name) {
  if (name === 'snapshot') await page.evaluate(() => { app.saveStateSnapshot(); app.usesStateSnapshot = true; });
  expect(await page.evaluate(() => ({
    usesSnapshot: Boolean(app.usesStateSnapshot),
    hasSnapshot: localStorage.getItem('gym_state_v1') !== null
  }))).toEqual({ usesSnapshot: name === 'snapshot', hasSnapshot: name === 'snapshot' });
}
async function complete(page) {
  await page.getByRole('button', { name: 'Сохранить тренировку', exact: true }).click();
  await page.locator('#confirmSheetOk').click();
}
async function verify(page, before) {
  const after = (await snap(page)).state;
  expect(after.activeWorkout).toBeNull();
  expect(after.workoutLogs).toHaveLength(2);
  expect(after.workoutLogs[0]).toEqual(before.state.workoutLogs[0]);
  expect(after.programs).toEqual(before.state.programs);
  const log = after.workoutLogs[1];
  expect(log.id).toBe(before.state.activeWorkout.id);
  expect(log.date).toBe(before.state.activeWorkout.date);
  expect(log.inputs).toBeUndefined();
  expect(log.entries[0].sets.map(s => [s.weight, s.reps])).toEqual([[65, 10], [65, 10], [65, 10]]);
  await page.reload(); expect((await snap(page)).state).toEqual(after);
}
for (const name of ['legacy', 'snapshot']) {
  test(`${name}: completion commits once and repeated calls cannot duplicate`, async ({ page }) => {
    await mode(page, name); const before = await snap(page);
    await page.evaluate(() => {
      window.writes = []; const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) { window.writes.push(k); return original.call(this, k, v); };
    });
    await complete(page); await page.evaluate(() => { app.commitFinishWorkout(); app.commitFinishWorkout(); });
    expect(await page.evaluate(() => window.writes)).toEqual(['gym_state_v1']);
    await verify(page, before);
  });
  for (const errorName of ['QuotaExceededError', 'SecurityError']) test(`${name}: ${errorName} leaves all state intact, reload and retry`, async ({ page }) => {
    await mode(page, name); const before = await snap(page);
    await page.evaluate(errorName => {
      const original = Storage.prototype.setItem; window.restore = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function(k, v) { if (k === 'gym_state_v1') throw new DOMException('Synthetic failure', errorName); return original.call(this, k, v); };
    }, errorName);
    await complete(page); expect(await snap(page)).toEqual(before);
    await expect(page.locator('#toastContainer')).toContainText('Не удалось сохранить тренировку');
    await expect(page.locator('#workoutComplete')).not.toHaveClass(/open/);
    // Repeated failed invocation still cannot publish a partial history.
    await page.evaluate(() => app.commitFinishWorkout()); expect(await snap(page)).toEqual(before);
    await page.reload(); const restored = await snap(page);
    expect(restored.state).toEqual(before.state); expect(restored.storage).toEqual(before.storage);
    await page.locator('.active-card').click(); await complete(page); await verify(page, before);
  });
  test(`${name}: retry without reload uses same ID and preserves unrelated records`, async ({ page }) => {
    await mode(page, name); const before = await snap(page);
    await page.evaluate(() => { const original = Storage.prototype.setItem; let failed = false;
      Storage.prototype.setItem = function(k, v) { if (!failed && k === 'gym_state_v1') { failed = true; throw new DOMException('Once', 'QuotaExceededError'); } return original.call(this, k, v); };
    });
    await complete(page); expect(await snap(page)).toEqual(before);
    await complete(page); await verify(page, before);
  });
  test(`${name}: no second completion write exists and legacy writes are never used`, async ({ page }) => {
    await mode(page, name); const before = await snap(page);
    await page.evaluate(() => {
      window.completionMutations = [];
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) {
        window.completionMutations.push(['setItem', k]);
        if (k !== 'gym_state_v1' || window.completionMutations.length > 1) throw new Error('Forbidden split write');
        return original.call(this, k, v);
      };
      Storage.prototype.removeItem = function(k) {
        window.completionMutations.push(['removeItem', k]);
        throw new Error('Forbidden legacy removal');
      };
    });
    await complete(page);
    expect(await page.evaluate(() => window.completionMutations)).toEqual([['setItem', 'gym_state_v1']]);
    const { gym_state_v1: committed, ...legacyKeys } = (await snap(page)).storage;
    const { gym_state_v1: previous, ...previousLegacyKeys } = before.storage;
    expect(legacyKeys).toEqual(previousLegacyKeys);
    expect(committed).not.toBe(previous);
    await verify(page, before);
  });
  test(`${name}: existing ID is not overwritten and active duplicate clears atomically`, async ({ page }) => {
    await mode(page, name);
    await page.evaluate(() => {
      app.workoutLogs.push({ id: app.activeWorkout.id, date: app.activeWorkout.date, entries: [{ exerciseId: 'e', sets: [{ weight: 99, reps: 1, timestamp: 999 }] }] });
      app.saveWorkoutLogs();
    });
    const before = await snap(page); await complete(page);
    const after = (await snap(page)).state;
    expect(after.workoutLogs).toEqual(before.state.workoutLogs); expect(after.activeWorkout).toBeNull();
    await page.reload(); expect((await snap(page)).state).toEqual(after);
  });
  test(`${name}: switching workout cannot bypass completion failure`, async ({ page }) => {
    await mode(page, name); const before = await snap(page);
    await page.evaluate(() => { const original = Storage.prototype.setItem; window.restore = () => Storage.prototype.setItem = original;
      Storage.prototype.setItem = function(k, v) { if (k === 'gym_state_v1') throw new DOMException('failure', 'QuotaExceededError'); return original.call(this, k, v); };
    });
    await page.locator('#navItemProgram').click(); await page.locator('[data-day-id=b]').click(); await page.locator('#confirmSheetOk').click();
    expect(await snap(page)).toEqual(before);
    await page.evaluate(() => window.restore());
    await page.locator('[data-day-id=b]').click(); await page.locator('#confirmSheetOk').click();
    const after = (await snap(page)).state;
    expect(after.workoutLogs).toHaveLength(2); expect(after.activeWorkout.dayId).toBe('b');
    expect(after.workoutLogs[1].id).toBe(before.state.activeWorkout.id);
  });
}
