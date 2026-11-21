const { test: base, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const fixture = () => ({ version: '1.0', programs: [{ id: 'p', name: 'Program', days: [{ id: 'd', name: 'Day', exercises: [
  { id: 'e', name: 'Exercise', targetSets: 3, targetReps: '10', notes: '' }
] }] }], currentProgramId: 'p', workoutLogs: [{ id: 'local', date: '2026-10-01T10:00:00Z', dayId: 'd', programId: 'p', entries: [
  { exerciseId: 'e', sets: [{ weight: 20, reps: 10, timestamp: 1000 }] }
] }], exerciseNames: { e: 'Exercise' }, hiddenExercises: [] });
const diary = ids => ({ workoutLogs: ids.map((id, i) => ({ id, date: `2026-10-0${i + 1}`, dayTemplate: 'A', entries: [
  { exercise: 'Imported exercise', sets: [{ weight: 30, reps: 12 }] }
] })) });
const test = base.extend({ page: async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(data => {
    if (localStorage.getItem('gym_programs_v1')) return;
    for (const [key, value] of Object.entries({ gym_programs_v1: data.programs, gym_current_program_id_v1: data.currentProgramId,
      gym_workout_logs_v1: data.workoutLogs, gym_exercise_names_v1: data.exerciseNames, gym_hidden_exercises_v1: [] })) {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }, fixture());
  await page.goto('/'); await use(page); expect(errors).toEqual([]);
} });
async function snapshot(page) {
  return page.evaluate(() => ({ memory: JSON.parse(JSON.stringify(app.getImportState())), storage: Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])) }));
}
async function upload(page, data) {
  await page.locator('#navItemSettings').click();
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)) });
  await expect(page.locator('#confirmSheet')).toHaveClass(/open/);
}
async function confirm(page) {
  await page.locator('#confirmSheetOk').click();
  await expect(page.locator('#confirmSheet')).not.toHaveClass(/open/);
}
async function unchanged(page, before) {
  expect(await snapshot(page)).toEqual(before);
  await page.reload(); expect(await snapshot(page)).toEqual(before);
}
async function rejects(page, input) {
  const before = await snapshot(page); await upload(page, input);
  await expect(page.locator('#confirmSheetTitle')).toHaveText('Импорт не выполнен');
  await expect(page.locator('#confirmSheetText')).toContainText('данные не изменены');
  await unchanged(page, before);
}

test('valid backup previews replacement and imports atomically', async ({ page }) => {
  const incoming = fixture(); incoming.workoutLogs[0].id = 'replacement';
  await upload(page, incoming);
  await expect(page.locator('#confirmSheetText')).toContainText('Будет удалено: 1');
  await expect(page.locator('#confirmSheetOk')).toHaveText('Заменить данные');
  expect(await page.locator('#confirmSheet .sheet').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  fs.mkdirSync(path.join(require('os').tmpdir(), 'gym-import-evidence'), { recursive: true });
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'gym-import-evidence', `backup-${page.viewportSize().width}.png`) });
  await confirm(page); expect((await snapshot(page)).memory.workoutLogs[0].id).toBe('replacement');
  const after = await snapshot(page); await page.reload(); expect(await snapshot(page)).toEqual(after);
});

const invalid = {
  'missing programs': d => { delete d.programs; },
  'missing history': d => { delete d.workoutLogs; },
  'incomplete program': d => { delete d.programs[0].days; },
  'invalid exercise': d => { delete d.programs[0].days[0].exercises[0].name; },
  'invalid set': d => { d.workoutLogs[0].entries[0].sets[0].weight = -1; },
  'invalid types': d => { d.workoutLogs = null; },
  'unsupported version': d => { d.version = '99'; },
  'duplicate log ids': d => { d.workoutLogs.push(d.workoutLogs[0]); },
  'unresolved exercise': d => { d.workoutLogs[0].entries[0].exerciseId = 'missing'; },
  'invalid current program': d => { d.currentProgramId = 'missing'; },
  'invalid timestamp': d => { d.workoutLogs[0].entries[0].sets[0].timestamp = 'yesterday'; },
  'invalid date': d => { d.workoutLogs[0].date = '2026-02-30T10:00:00Z'; },
  'null exercise': d => { d.programs[0].days[0].exercises = [null]; }
};
for (const [name, mutate] of Object.entries(invalid)) test(`reject backup: ${name}`, async ({ page }) => { const d = fixture(); mutate(d); await rejects(page, d); });
for (const [name, input] of [['syntax', '{broken'], ['empty', ''], ['null root', 'null'], ['array root', '[]']]) {
  test(`reject file: ${name}`, async ({ page }) => rejects(page, input));
}
test('legacy backup without optional dictionaries/version is accepted', async ({ page }) => {
  const d = fixture(); delete d.version; delete d.exerciseNames; delete d.hiddenExercises;
  await upload(page, d); await confirm(page);
  expect((await snapshot(page)).memory.workoutLogs).toEqual(d.workoutLogs);
});
test('the confirmed incomplete backup is rejected before confirmation', async ({ page }) => rejects(page, { programs: [{ id: 'bad', name: 'Bad' }] }));

test('diary merge adds two, preserves local records/templates and shows analytics', async ({ page }) => {
  const before = await snapshot(page); await upload(page, diary(['one', 'two']));
  await expect(page.locator('#confirmSheetText')).toContainText('Новых тренировок: 2');
  await expect(page.locator('#confirmSheetText')).toContainText('Будет удалено: 0');
  await expect(page.locator('#confirmSheetText')).toContainText('Без изменений: 1');
  expect(await page.locator('#confirmSheet .sheet').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'gym-import-evidence', `diary-${page.viewportSize().width}.png`) });
  await confirm(page); const after = await snapshot(page);
  expect(after.memory.programs[0]).toEqual(before.memory.programs[0]);
  expect(after.memory.workoutLogs.find(l => l.id === 'local')).toEqual(before.memory.workoutLogs[0]);
  expect(after.memory.workoutLogs).toHaveLength(3);
  await page.locator('#navItemAnalytics').click(); await page.locator('#chartExerciseBtn').click();
  await page.locator('#chartPickerList').getByRole('option').filter({ hasText: 'Imported exercise' }).click();
  await expect(page.locator('#prMaxWeightVal')).toHaveText('30');
});
test('repeated diary and subset are idempotent and never delete absent records', async ({ page }) => {
  const d = diary(['one', 'two']); await upload(page, d); await confirm(page);
  const before = await snapshot(page); await upload(page, d);
  await expect(page.locator('#confirmSheetText')).toContainText('Новых тренировок: 0. Обновится: 0. Будет удалено: 0. Без изменений: 3');
  await confirm(page); expect((await snapshot(page)).memory).toEqual(before.memory);
  await upload(page, diary(['one'])); await confirm(page);
  expect((await snapshot(page)).memory).toEqual(before.memory);
});
test('preview exactly counts updates additions and unchanged records', async ({ page }) => {
  await upload(page, diary(['one', 'two'])); await confirm(page);
  const d = diary(['one', 'three']); d.workoutLogs[0].entries[0].sets[0].reps = 15;
  await upload(page, d);
  await expect(page.locator('#confirmSheetText')).toContainText('Новых тренировок: 1. Обновится: 1. Будет удалено: 0. Без изменений: 2');
  await confirm(page); const logs = (await snapshot(page)).memory.workoutLogs;
  expect(logs).toHaveLength(4); expect(logs.find(l => l.id === 'seed-one').entries[0].sets[0].reps).toBe(15);
});
for (const kind of ['backup', 'diary']) test(`cancel ${kind} leaves memory and storage unchanged`, async ({ page }) => {
  const before = await snapshot(page); await upload(page, kind === 'backup' ? fixture() : diary(['one']));
  expect(await snapshot(page)).toEqual(before);
  await page.locator('#confirmSheetCancel').click(); await unchanged(page, before);
});
for (const position of [0, 1, 2]) test(`invalid diary date at position ${position} leaves all data intact`, async ({ page }) => {
  await upload(page, diary(['existing'])); await confirm(page);
  const d = diary(['one', 'two', 'three']); d.workoutLogs[position].date = '2026-02-30'; await rejects(page, d);
});
test('diary validation failure after valid records is atomic', async ({ page }) => {
  const d = diary(['one', 'two']); d.workoutLogs[1].entries[0].sets[0].reps = '12'; await rejects(page, d);
});
test('duplicate incoming diary IDs are rejected', async ({ page }) => rejects(page, diary(['one', 'one'])));
for (const kind of ['backup', 'diary']) for (const errorName of ['QuotaExceededError', 'SecurityError']) {
  test(`${kind} ${errorName} preserves memory and every storage key and permits retry`, async ({ page }) => {
    if (kind === 'diary') { await upload(page, diary(['existing'])); await confirm(page); }
    const before = await snapshot(page); const d = kind === 'backup' ? fixture() : diary(['new']);
    await upload(page, d);
    await page.evaluate(name => {
      window.originalImportSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'gym_state_v1') throw new DOMException('Synthetic failure', name);
        return window.originalImportSetItem.call(this, key, value);
      };
    }, errorName);
    await page.locator('#confirmSheetOk').click();
    await expect(page.locator('#confirmSheetTitle')).toHaveText('Импорт не выполнен');
    await expect(page.locator('#confirmSheetText')).toContainText('Хранилище недоступно');
    await unchanged(page, before); // Reload also removes the synthetic failure injection.
    await upload(page, d); await confirm(page);
  });
}
test('stale preview rejects changes made after preparation', async ({ page }) => {
  await upload(page, diary(['one']));
  await page.evaluate(() => { app.programs[0].name = 'Changed'; app.savePrograms(); });
  const before = await snapshot(page); await page.locator('#confirmSheetOk').click();
  await expect(page.locator('#confirmSheetText')).toContainText('Данные изменились');
  await unchanged(page, before);
});
test('subsequent workout and history saves persist through the atomic snapshot', async ({ page }) => {
  await upload(page, fixture()); await confirm(page);
  await page.locator('#navItemProgram').click(); await page.locator('.workout-card').first().click();
  await page.evaluate(() => { app.openNumpad('e', 'reps', null); app.numpadKey('1'); app.numpadKey('0'); app.closeNumpad(); });
  await page.reload(); await page.locator('.active-card').click();
  await expect(page.locator('.metric-btn[onclick*="reps"]').first()).not.toHaveClass(/is-empty/);
  await page.getByRole('button', { name: 'Сохранить тренировку', exact: true }).click(); await page.locator('#confirmSheetOk').click();
  await page.locator('.complete-done').click();
  const after = await snapshot(page); await page.reload(); expect(await snapshot(page)).toEqual(after);
});

test('UX01 and UX02 remain fixed after switching to snapshot persistence', async ({ page }) => {
  const d = fixture(); d.workoutLogs[0].entries[0].sets = [{ weight: 60, reps: 8 }, { weight: 65, reps: 10 }];
  await upload(page, d); await confirm(page);
  await page.locator('#navItemHome').click(); await page.locator('#logsHistoryList .card-menu-btn').first().click();
  await page.locator('#logsHistoryList').getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page.locator('.log-set-row').first().locator('[data-field=r]').fill('12');
  await page.locator('#viewLogEdit .bottom-action button').click();
  expect((await snapshot(page)).memory.workoutLogs[0].entries[0].sets).toEqual([{ weight: 60, reps: 12 }, { weight: 65, reps: 10 }]);
  await page.locator('#navItemProgram').click(); await page.locator('.workout-card').first().click();
  await page.evaluate(() => { app.openNumpad('e', 'reps', null); app.numpadKey('1'); app.numpadKey('0'); app.closeNumpad(); });
  const finish = async () => {
    await page.getByRole('button', { name: 'Сохранить тренировку', exact: true }).click();
    await page.locator('#confirmSheetOk').click(); await page.locator('.complete-done').click();
  };
  await finish(); await page.locator('#navItemProgram').click(); await page.locator('.workout-card').first().click();
  await expect(page.locator('.metric-btn[onclick*="reps"]').first()).toHaveClass(/is-empty/);
  await finish();
  expect((await snapshot(page)).memory.workoutLogs.at(-1).entries.flatMap(e => e.sets)).toEqual([]);
  const after = await snapshot(page); await page.reload(); expect(await snapshot(page)).toEqual(after);
});

test('storage changed in another tab invalidates preview without overwriting it', async ({ page }) => {
  await upload(page, diary(['one']));
  await page.evaluate(() => localStorage.setItem('gym_exercise_names_v1', JSON.stringify({ e: 'Changed externally' })));
  const before = await snapshot(page); await page.locator('#confirmSheetOk').click();
  await expect(page.locator('#confirmSheetText')).toContainText('Сохранённые данные изменились');
  expect(await snapshot(page)).toEqual(before);
});

test('two diary records import into an empty history without losing templates', async ({ page }) => {
  await page.evaluate(() => { app.workoutLogs = []; app.saveWorkoutLogs(); });
  const before = await snapshot(page);
  await upload(page, diary(['one', 'two']));
  await expect(page.locator('#confirmSheetText')).toContainText('Новых тренировок: 2. Обновится: 0. Будет удалено: 0. Без изменений: 0');
  await confirm(page);
  const after = await snapshot(page);
  expect(after.memory.workoutLogs.map(l => l.id)).toEqual(['seed-one', 'seed-two']);
  expect(after.memory.programs[0]).toEqual(before.memory.programs[0]);
});