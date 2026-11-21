const { test: base, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const evidence = path.join(require('os').tmpdir(), 'gym-ux03-evidence');
const fixture = () => ({ programs: [{ id: 'p', name: 'Program', days: [{ id: 'd', name: 'Template', exercises: [
  { id: 'e', name: 'Current name', targetSets: 3, targetReps: '10', notes: '' }
] }] }], currentProgramId: 'p', exerciseNames: {}, hiddenExercises: [], workoutLogs: [
  { id: 'l', date: '2026-10-01T10:00:00Z', dayId: 'd', dayName: 'Historical day', exercises: [{ id: 'e', name: 'Historical exercise' }],
    entries: [{ exerciseId: 'e', sets: [{ weight: 60, reps: 8, timestamp: 1000 }, { weight: 65, reps: 10, timestamp: 2000 }] }] }
] });
const test = base.extend({ page: async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(data => {
    if (localStorage.getItem('gym_programs_v1')) return;
    localStorage.setItem('gym_programs_v1', JSON.stringify(data.programs));
    localStorage.setItem('gym_current_program_id_v1', 'p');
    localStorage.setItem('gym_workout_logs_v1', JSON.stringify(data.workoutLogs));
    localStorage.setItem('gym_exercise_names_v1', '{}');
  }, fixture());
  await page.goto('/');
  await page.waitForFunction(() => typeof app !== 'undefined' && app.programs.length > 0);
  await use(page); expect(errors).toEqual([]);
} });
const logs = page => page.evaluate(() => JSON.parse(JSON.stringify(app.workoutLogs)));
async function history(page) { await page.locator('#navItemHome').click(); }
async function remove(page) {
  await page.locator('#navItemProgram').click();
  await page.locator('#workoutsList .card-menu-btn').click();
  await page.locator('#workoutsList').getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.locator('#confirmSheetOk').click();
}
async function capture(page, name) {
  fs.mkdirSync(evidence, { recursive: true });
  await page.locator('.view-screen.active').evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished)); });
  await page.screenshot({ path: path.join(evidence, `${name}-${page.viewportSize().width}.png`) });
}
async function chart(page) {
  await page.locator('#navItemAnalytics').click();
  await expect(page.locator('#chartExerciseLabel')).toHaveText('Historical exercise');
  await expect(page.locator('#prMaxWeightVal')).toHaveText('65');
  await expect(page.locator('#progressChart')).toBeVisible();
}
test('original reproduction: snapshot names and analytics survive deletion of the only template', async ({ page }) => {
  const before = await logs(page);
  await remove(page); await history(page);
  await capture(page, process.env.GYM_CAPTURE === 'before' ? 'before-history' : 'after-history');
  await expect(page.locator('.history-exercise-name')).toHaveText('Historical exercise');
  expect(await logs(page)).toEqual(before);
  await chart(page); await capture(page, 'after-analytics');
  await page.reload(); await history(page);
  await expect(page.locator('.history-exercise-name')).toHaveText('Historical exercise');
  await chart(page); expect(await logs(page)).toEqual(before);
});
test('template rename and exercise edits never rename snapshots or change sets', async ({ page }) => {
  const before = await logs(page);
  await page.evaluate(() => { app.openDayEdit('d'); });
  await page.locator('#dayEditTitle').click(); await page.locator('#dayNameInput').fill('Future template');
  await page.locator('#dayNameModal').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.locator('#dayEditList [data-field=w]').fill('90');
  await page.locator('#dayEditSave').click();
  // Exercise-name mutation simulates a rename by an existing catalog/import producer.
  await page.evaluate(() => { app.programs[0].days[0].exercises[0].name = 'Future exercise'; app.savePrograms(); });
  await history(page); await expect(page.locator('.history-exercise-name')).toHaveText('Historical exercise');
  await chart(page); expect(await logs(page)).toEqual(before);
});
test('legacy history without snapshots is preserved before deleting its source template', async ({ page }) => {
  await page.evaluate(() => { delete app.workoutLogs[0].exercises; app.saveWorkoutLogs(); });
  const sets = (await logs(page))[0].entries;
  await remove(page); await history(page);
  await expect(page.locator('.history-exercise-name')).toHaveText('Current name');
  expect((await logs(page))[0].entries).toEqual(sets);
  await page.reload(); await history(page); await expect(page.locator('.history-exercise-name')).toHaveText('Current name');
});
test('distinct IDs with identical names have independent analytics and exercise history', async ({ page }) => {
  await page.evaluate(() => {
    app.workoutLogs.push({ id: 'other', date: '2026-10-02T10:00:00Z', exercises: [{ id: 'other-id', name: 'Historical exercise' }],
      entries: [{ exerciseId: 'other-id', sets: [{ weight: 100, reps: 2, timestamp: 3000 }] }] });
    app.saveWorkoutLogs();
  });
  await remove(page); await page.locator('#navItemAnalytics').click();
  await page.locator('#chartExerciseBtn').click();
  await expect(page.locator('#chartPickerList [role=option]')).toHaveCount(2);
  await page.locator('#chartPickerList [role=option]').nth(1).click();
  await expect(page.locator('#prMaxWeightVal')).toHaveText('65');
  await page.locator('#chartExerciseBtn').click(); await page.locator('#chartPickerList [role=option]').first().click();
  await expect(page.locator('#prMaxWeightVal')).toHaveText('100');
  await page.evaluate(() => app.openExerciseHistory('e'));
  await expect(page.locator('#exerciseHistoryBody .ex-history-item')).toHaveCount(1);
  await expect(page.locator('#exerciseHistoryBody')).not.toContainText('100 кг');
});
test('historical editor and copied text use the record own snapshot', async ({ page }) => {
  await history(page);
  expect(await page.evaluate(() => app.buildLogText(app.workoutLogs[0]))).toContain('Historical exercise');
  await page.locator('#logsHistoryList .card-menu-btn').click();
  await page.locator('#logsHistoryList').getByRole('button', { name: 'Редактировать', exact: true }).click();
  await expect(page.locator('#logEditList .workout-card-title')).toHaveText('Historical exercise');
});
test('backup export and re-import retain names snapshots and analytics after template removal', async ({ page }) => {
  const before = await logs(page); await remove(page);
  await page.locator('#navItemSettings').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click();
  const download = await downloadPromise;
  const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(data.workoutLogs).toEqual(before);
  await page.locator('input[type=file]').setInputFiles({ name: 'roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator('#confirmSheetTitle')).toContainText('Заменить данные');
  await page.locator('#confirmSheetOk').click();
  await history(page); await expect(page.locator('.history-exercise-name')).toHaveText('Historical exercise');
  await chart(page); expect(await logs(page)).toEqual(before);
});
test('imported snapshot wins over conflicting current template and dictionary', async ({ page }) => {
  const data = fixture(); data.exerciseNames.e = 'Dictionary name';
  await page.locator('#navItemSettings').click();
  await page.locator('input[type=file]').setInputFiles({ name: 'import.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.locator('#confirmSheetOk').click(); await remove(page); await history(page);
  await expect(page.locator('.history-exercise-name')).toHaveText('Historical exercise');
  await chart(page); expect(await logs(page)).toEqual(data.workoutLogs);
});

test('removing an exercise from its template does not affect completed data', async ({ page }) => {
  const before = await logs(page);
  await page.evaluate(() => app.openDayEdit('d'));
  await page.locator('#dayEditList').getByRole('button', { name: 'Удалить упражнение', exact: true }).click();
  await page.locator('#confirmSheetOk').click();
  await page.locator('#viewDayEdit').getByRole('button', { name: 'Добавить упражнения', exact: false }).click();
  await page.locator('#pickerSearch').fill('Future only exercise'); await page.locator('.pk-create').click();
  await page.locator('#dayEditSave').click();
  await history(page); await expect(page.locator('.history-exercise-name')).toHaveText('Historical exercise');
  await chart(page); expect(await logs(page)).toEqual(before);
});

test('legacy record gets a compact snapshot before template edit', async ({ page }) => {
  await page.evaluate(() => { delete app.workoutLogs[0].exercises; app.saveWorkoutLogs(); app.openDayEdit('d'); });
  const entries = (await logs(page))[0].entries;
  await page.locator('#dayEditList [data-field=w]').fill('80'); await page.locator('#dayEditSave').click();
  const after = await logs(page);
  expect(after[0].exercises).toEqual([{ id: 'e', name: 'Current name' }]);
  expect(after[0].entries).toEqual(entries);
});

test('diary creates self-contained snapshots and ambiguous names are rejected atomically', async ({ page }) => {
  const input = { workoutLogs: [{ id: 'diary', date: '2026-10-03', entries: [{ exercise: 'Diary exercise', sets: [{ weight: 35, reps: 9 }] }] }] };
  await page.locator('#navItemSettings').click();
  await page.locator('input[type=file]').setInputFiles({ name: 'diary.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  await page.locator('#confirmSheetOk').click();
  const imported = (await logs(page)).find(l => l.id === 'seed-diary');
  expect(imported.exercises).toEqual([{ id: imported.entries[0].exerciseId, name: 'Diary exercise' }]);
  await page.evaluate(() => {
    app.workoutLogs.push({ id: 'duplicate-name', date: '2026-10-04T10:00:00Z', exercises: [{ id: 'different', name: 'Diary exercise' }],
      entries: [{ exerciseId: 'different', sets: [{ weight: 10, reps: 2 }] }] });
    app.saveWorkoutLogs();
  });
  const before = await page.evaluate(() => ({ state: JSON.stringify(app.getImportState()), storage: JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))) }));
  await page.locator('input[type=file]').setInputFiles({ name: 'diary.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  await expect(page.locator('#confirmSheetTitle')).toHaveText('Импорт не выполнен');
  await expect(page.locator('#confirmSheetText')).toContainText('разным ID');
  expect(await page.evaluate(() => ({ state: JSON.stringify(app.getImportState()), storage: JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))) }))).toEqual(before);
});