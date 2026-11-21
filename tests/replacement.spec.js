const { test: base, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const test = base.extend({ page: async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    if (localStorage.getItem('gym_programs_v1')) return;
    const ex = (id, name) => ({ id, name, targetSets: 3, targetReps: '10', targetWeight: 50, notes: 'Template note' });
    localStorage.setItem('gym_programs_v1', JSON.stringify([{ id: 'p', name: 'P', days: [
      { id: 'd', name: 'Day', exercises: [ex('a', 'Original exercise'), ex('b', 'Other exercise')] },
      { id: 'choices', name: 'Choices', exercises: [ex('c', 'Replacement exercise')] }
    ] }]));
    localStorage.setItem('gym_workout_logs_v1', JSON.stringify([{ id: 'l', date: '2026-10-01T10:00:00Z', entries: [{ exerciseId: 'a', sets: [{ weight: 10, reps: 5 }] }] }]));
  });
  await page.goto('/'); await page.locator('[data-day-id=d]').click();
  await use(page); expect(errors).toEqual([]);
} });
const snap = page => page.evaluate(() => ({ state: JSON.parse(JSON.stringify(app.getImportState())), storage: Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])) }));
const card = page => page.locator('[data-exercise-id=a]');
async function enter(page, field, value) {
  await card(page).locator(`.metric-btn[onclick*="'${field}'"]`).first().click();
  for (const digit of String(value)) await page.locator('#numpadSheet').getByRole('button', { name: digit, exact: true }).click();
  await page.locator('#numpadSheet').getByRole('button', { name: 'Готово', exact: true }).click();
}
async function replace(page) {
  await card(page).locator('.card-menu-btn').click();
  await card(page).getByRole('button', { name: 'Замена', exact: true }).click();
  await page.locator('.pk-row').filter({ hasText: 'Replacement exercise' }).click();
  await page.locator('#pickerConfirm').click();
}
async function guarded(page) {
  await expect(page.locator('#confirmSheetTitle')).toHaveText('Заменить упражнение?');
  await expect(page.locator('#confirmSheetText')).toContainText('Original exercise');
}
test('untouched placeholders and template notes replace immediately', async ({ page }) => {
  await replace(page); await expect(page.locator('#confirmSheet')).not.toHaveClass(/open/);
  await expect(page.locator('[data-exercise-id=c]')).toBeVisible();
});
for (const field of ['weight', 'reps', 'count']) test(`${field} alone requires confirmation and Cancel preserves everything`, async ({ page }) => {
  await enter(page, field, field === 'weight' ? 65 : 3); const before = await snap(page);
  await replace(page); await guarded(page);
  await page.locator('#confirmSheetCancel').click(); expect(await snap(page)).toEqual(before);
  await expect(card(page)).toBeVisible();
  await page.reload(); await page.locator('.active-card').click();
  expect((await snap(page)).state.activeWorkout).toEqual(before.state.activeWorkout);
});
test('explicit zero is entered data but empty per-set editor is not', async ({ page }) => {
  await card(page).locator('.ex-edit-btn').click(); await card(page).locator('.ex-edit-btn').click();
  await enter(page, 'weight', 0); await replace(page); await guarded(page);
});
test('empty per-set rows do not cause a warning', async ({ page }) => {
  await card(page).locator('.ex-edit-btn').click(); await replace(page);
  await expect(page.locator('[data-exercise-id=c]')).toBeVisible();
  await expect(page.locator('#confirmSheet')).not.toHaveClass(/open/);
});
test('original loss scenario: confirm affects only selected exercise and survives reload', async ({ page }) => {
  await enter(page, 'weight', 65); await enter(page, 'reps', 10); await enter(page, 'count', 3);
  await page.evaluate(() => {
    app.exerciseInputState.b.weight = 25; app.exerciseInputState.b.reps = 8; app.exerciseInputState.b.count = 2;
    app.persistExerciseInput('b'); app.renderWorkoutScreen();
  });
  const before = await snap(page); await replace(page); await guarded(page);
  const dir = path.join(require('os').tmpdir(), 'gym-ux15-evidence'); fs.mkdirSync(dir, { recursive: true });
  await page.locator('#confirmSheet .sheet').evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished)); });
  await page.screenshot({ path: path.join(dir, `confirm-${page.viewportSize().width}.png`) });
  expect(await page.locator('#confirmSheet .sheet').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  expect(await page.locator('#confirmSheetOk').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.locator('#confirmSheetOk').click();
  const after = await snap(page);
  expect(after.state.programs).toEqual(before.state.programs); expect(after.state.workoutLogs).toEqual(before.state.workoutLogs);
  expect(after.state.exerciseNames).toEqual(before.state.exerciseNames);
  expect(after.state.activeWorkout.exercises.find(e => e.id === 'b')).toEqual(before.state.activeWorkout.exercises.find(e => e.id === 'b'));
  expect(after.state.activeWorkout.inputs.b).toEqual(before.state.activeWorkout.inputs.b);
  expect(after.state.activeWorkout.inputs.a).toBeUndefined();
  expect(after.state.activeWorkout.entries.filter(e => e.exerciseId === 'c')).toHaveLength(1);
  await page.locator('#navItemHome').click(); await page.locator('#navItemProgram').click(); await page.locator('.active-card').click();
  await page.reload(); await page.locator('.active-card').click();
  expect((await snap(page)).state.activeWorkout).toEqual(after.state.activeWorkout);
  await expect(page.locator('[data-exercise-id=c] .metric-btn').first()).toHaveClass(/is-empty/);
});
test('completed and partial per-set data requires confirmation', async ({ page }) => {
  await page.evaluate(() => {
    app.activeWorkout.entries[0].sets = [{ weight: 60, reps: 8, timestamp: 1000 }, { weight: 65, reps: 10, timestamp: 2000 }];
    app.saveActiveWorkout(); app.exerciseInputState = {}; app.renderWorkoutScreen();
  });
  const before = await snap(page); await replace(page); await guarded(page);
  await page.locator('#confirmSheetCancel').click(); expect(await snap(page)).toEqual(before);
});
test('edited note requires confirmation, Cancel and retry preserve it', async ({ page }) => {
  await card(page).locator('.card-menu-btn').click(); await card(page).getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page.locator('#modalExNotes').fill('Workout note'); await page.locator('#exerciseModal .btn-pill-dark').click();
  const before = await snap(page); await replace(page); await guarded(page);
  await page.locator('#confirmSheetCancel').click(); expect(await snap(page)).toEqual(before);
  await replace(page); await guarded(page);
  await page.evaluate(() => app.replaceWorkoutExercise('a', { id: 'c', name: 'Replacement exercise' }));
  await page.locator('#confirmSheetOk').click();
  expect((await snap(page)).state.activeWorkout.exercises[0].notes).toBe('Workout note');
});
for (const mode of ['legacy', 'snapshot']) test(`${mode}: failed persistence preserves input memory storage and permits retry`, async ({ page }) => {
  await enter(page, 'weight', 65); await enter(page, 'reps', 10);
  if (mode === 'snapshot') await page.evaluate(() => { app.saveStateSnapshot(); app.usesStateSnapshot = true; });
  const before = await snap(page);
  await replace(page); await guarded(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem; window.restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = () => { throw new DOMException('synthetic', 'QuotaExceededError'); };
  });
  await page.locator('#confirmSheetOk').click();
  expect(await snap(page)).toEqual(before); await expect(card(page)).toBeVisible();
  await page.evaluate(() => window.restoreStorage());
  await page.reload(); await page.locator('.active-card').click();
  expect((await snap(page)).state.activeWorkout).toEqual(before.state.activeWorkout);
  await replace(page); await guarded(page); await page.locator('#confirmSheetOk').click();
  await expect(page.locator('[data-exercise-id=c]')).toBeVisible();
});

test('partial per-set weight warns and preserves every row on Cancel', async ({ page }) => {
  await card(page).locator('.ex-edit-btn').click();
  await card(page).locator('.set-row').nth(1).locator('.metric-btn').first().click();
  await page.locator('#numpadSheet').getByRole('button', { name: '4', exact: true }).click();
  await page.locator('#numpadSheet').getByRole('button', { name: 'Готово', exact: true }).click();
  const before = await snap(page); await replace(page); await guarded(page);
  await page.locator('#confirmSheetCancel').click(); expect(await snap(page)).toEqual(before);
});

test('custom replacement uses the same confirmation without writing catalog', async ({ page }) => {
  await enter(page, 'reps', 10); const before = await snap(page);
  await card(page).locator('.card-menu-btn').click(); await card(page).getByRole('button', { name: 'Замена', exact: true }).click();
  await page.locator('#pickerSearch').fill('Custom replacement'); await page.locator('.pk-create').click();
  await guarded(page); await page.locator('#confirmSheetCancel').click(); expect(await snap(page)).toEqual(before);
  await card(page).locator('.card-menu-btn').click(); await card(page).getByRole('button', { name: 'Замена', exact: true }).click();
  await page.locator('#pickerSearch').fill('Custom replacement'); await page.locator('.pk-create').click();
  await guarded(page); await page.locator('#confirmSheetOk').click();
  const after = await snap(page);
  expect(after.state.exerciseNames).toEqual(before.state.exerciseNames);
  expect(after.state.programs).toEqual(before.state.programs);
  expect(after.state.activeWorkout.exercises[0].name).toBe('Custom replacement');
});