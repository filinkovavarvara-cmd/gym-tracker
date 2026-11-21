const { test: base, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const test = base.extend({ page: async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    if (localStorage.getItem('gym_programs_v1')) return;
    localStorage.setItem('gym_programs_v1', JSON.stringify([{ id: 'p', name: 'P', days: [{ id: 'd', name: 'Day', custom: 'keep', exercises: [
      { id: 'e', name: 'Exercise', targetSets: 2, targetReps: '10', targetWeight: 50, notes: 'note', custom: 'keep' }
    ] }] }]));
    localStorage.setItem('gym_current_program_id_v1', 'p');
    localStorage.setItem('gym_workout_logs_v1', JSON.stringify([{ id: 'l', date: '2026-10-01T10:00:00Z', dayId: 'd', exercises: [{ id: 'e', name: 'Exercise' }], entries: [
      { exerciseId: 'e', sets: [{ weight: 60, reps: 8, timestamp: 1000 }, { weight: 65, reps: 10, timestamp: 2000 }] }
    ] }]));
  });
  await page.goto('/'); await use(page); expect(errors).toEqual([]);
} });
const state = page => page.evaluate(() => JSON.parse(JSON.stringify(app.getImportState())));
const storage = page => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
async function open(page, kind) {
  if (kind === 'day') { await page.locator('#workoutsList .card-menu-btn').click(); await page.locator('#workoutsList').getByRole('button', { name: 'Редактировать', exact: true }).click(); }
  else { await page.locator('#navItemHome').click(); await page.locator('#logsHistoryList .card-menu-btn').click(); await page.locator('#logsHistoryList').getByRole('button', { name: 'Редактировать', exact: true }).click(); }
}
const screen = (page, kind) => page.locator(kind === 'day' ? '#viewDayEdit' : '#viewLogEdit');
const field = (page, kind) => page.locator(kind === 'day' ? '#dayEditList [data-field=w]' : '#logEditList [data-field=r]').first();
async function dirty(page, kind) { await field(page, kind).fill(kind === 'day' ? '70' : '12'); }
async function leave(page, kind, route) {
  if (route === 'back') await screen(page, kind).getByRole('button', { name: 'Назад', exact: true }).click();
  if (route === 'nav') await page.locator('#navItemSettings').click();
  if (route === 'analytics') await page.locator('#navItemAnalytics').click();
  if (route === 'browser') await page.evaluate(() => history.back());
}
for (const kind of ['day', 'log']) {
  test(`${kind}: clean exit and restored original value have no guard`, async ({ page }) => {
    await open(page, kind); const original = await field(page, kind).inputValue();
    await dirty(page, kind); await field(page, kind).fill(original);
    await leave(page, kind, 'back'); await expect(page.locator('#confirmSheet')).not.toHaveClass(/open/);
    await expect(screen(page, kind)).not.toHaveClass(/active/);
  });
  for (const route of ['back', 'nav', 'analytics', 'browser']) test(`${kind}: ${route} protects dirty draft and Continue preserves it`, async ({ page }) => {
    await open(page, kind); await dirty(page, kind); const before = await state(page);
    await leave(page, kind, route);
    await expect(page.locator('#confirmSheetTitle')).toHaveText('Сохранить изменения?');
    await expect(screen(page, kind)).toHaveClass(/active/);
    expect(await page.locator('#confirmSheet').evaluate(backdrop => {
      const sheet = backdrop.querySelector('.sheet').getBoundingClientRect();
      const buttons = [...backdrop.querySelectorAll('.sheet-actions button')].filter(b => !b.hidden).map(b => b.getBoundingClientRect());
      return buttons.every((b, i) => b.top >= sheet.top && b.bottom <= sheet.bottom && b.right <= innerWidth &&
        (!i || b.top >= buttons[i - 1].bottom));
    })).toBe(true);
    const dir = path.join(require('os').tmpdir(), 'gym-ux09-evidence'); fs.mkdirSync(dir, { recursive: true });
    if (route === 'back') await page.screenshot({ path: path.join(dir, `${kind}-${page.viewportSize().width}.png`) });
    await page.locator('#confirmSheetCancel').click();
    await expect(field(page, kind)).toHaveValue(kind === 'day' ? '70' : '12'); expect(await state(page)).toEqual(before);
  });
  test(`${kind}: Discard proceeds without changing saved state`, async ({ page }) => {
    await open(page, kind); const before = await state(page), persisted = await storage(page);
    await dirty(page, kind); await leave(page, kind, 'nav'); await page.locator('#confirmSheetOk').click();
    await expect(page.locator('#viewSettings')).toHaveClass(/active/);
    expect(await state(page)).toEqual(before); expect(await storage(page)).toEqual(persisted);
  });
  test(`${kind}: Save commits exactly once and follows requested destination`, async ({ page }) => {
    await open(page, kind); await dirty(page, kind);
    await page.evaluate(() => { window.writes = 0; const original = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if(k === 'gym_state_v1') window.writes++; return original.call(this, k, v); }; });
    await leave(page, kind, 'analytics'); await page.locator('#confirmSheetSave').click();
    await expect(page.locator('#viewHistory')).toHaveClass(/active/); await expect(page.locator('#historyTitle')).toHaveText('График');
    expect(await page.evaluate(() => window.writes)).toBe(1);
    const saved = await state(page); await page.reload(); expect(await state(page)).toEqual(saved);
    if (kind === 'day') { expect(saved.programs[0].days[0].exercises[0].targetWeight).toBe(70); expect(saved.programs[0].days[0].exercises[0].custom).toBe('keep'); }
    else expect(saved.workoutLogs[0].entries[0].sets).toEqual([{ weight: 60, reps: 12, timestamp: 1000 }, { weight: 65, reps: 10, timestamp: 2000 }]);
  });
  test(`${kind}: failed Save retains draft memory and storage`, async ({ page }) => {
    await open(page, kind); await dirty(page, kind); const before = await state(page), persisted = await storage(page);
    await page.evaluate(() => { const original = Storage.prototype.setItem; window.restoreStorage = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function(k, v) { if(k === 'gym_state_v1') throw new DOMException('test', 'QuotaExceededError'); return original.call(this, k, v); }; });
    await leave(page, kind, 'nav'); await page.locator('#confirmSheetSave').click();
    await expect(screen(page, kind)).toHaveClass(/active/); await expect(field(page, kind)).toHaveValue(kind === 'day' ? '70' : '12');
    expect(await state(page)).toEqual(before); expect(await storage(page)).toEqual(persisted);
    await page.evaluate(() => window.restoreStorage()); await leave(page, kind, 'nav'); await page.locator('#confirmSheetSave').click();
    await expect(page.locator('#viewSettings')).toHaveClass(/active/);
  });
  test(`${kind}: invalid data hides Save, Escape does not discard, repeated navigation does not bypass`, async ({ page }) => {
    await open(page, kind); await field(page, kind).fill('-1');
    await leave(page, kind, 'back'); await expect(page.locator('#confirmSheetSave')).toBeHidden();
    await page.evaluate(() => { app.openAnalytics(); app.navigate('viewSettings'); history.back(); });
    await expect(page.locator('#confirmSheetTitle')).toHaveText('Сохранить изменения?');
    await page.keyboard.press('Escape'); await expect(screen(page, kind)).toHaveClass(/active/);
    await page.locator('#confirmSheetCancel').click(); await expect(field(page, kind)).toHaveValue('-1');
  });
}
test('template composition and History set changes reverted to original are clean', async ({ page }) => {
  await open(page, 'day');
  await page.locator('#dayEditTitle').click(); await page.locator('#dayNameInput').fill('Changed'); await page.locator('#dayNameModal .btn-pill-dark').click();
  await leave(page, 'day', 'back'); await expect(page.locator('#confirmSheet')).toHaveClass(/open/); await page.locator('#confirmSheetCancel').click();
  await page.locator('#dayEditTitle').click(); await page.locator('#dayNameInput').fill('Day'); await page.locator('#dayNameModal .btn-pill-dark').click();
  await leave(page, 'day', 'back'); await expect(page.locator('#confirmSheet')).not.toHaveClass(/open/);
  await open(page, 'log');
  await page.locator('#logEditList .set-add').click(); await page.locator('#logEditList .log-set-row').last().locator('.set-remove').click();
  await leave(page, 'log', 'back'); await expect(page.locator('#confirmSheet')).not.toHaveClass(/open/);
});

for (const kind of ['day', 'log']) test(`${kind}: opening and leaving without any edits is clean`, async ({ page }) => {
  await open(page, kind); await leave(page, kind, 'nav');
  await expect(page.locator('#viewSettings')).toHaveClass(/active/);
  await expect(page.locator('#confirmSheet')).not.toHaveClass(/open/);
});

test('composition order names and set removal are compared as data', async ({ page }) => {
  await open(page, 'day');
  await page.evaluate(() => {
    app.dayDraft.exercises.push({ ...app.dayDraft.exercises[0], id: 'second', name: 'Second' });
    app.renderDayEdit();
  });
  await leave(page, 'day', 'nav'); await expect(page.locator('#confirmSheet')).toHaveClass(/open/);
  await page.locator('#confirmSheetCancel').click();
  await page.evaluate(() => { app.dayDraft.exercises.pop(); app.renderDayEdit(); });
  await leave(page, 'day', 'back'); await expect(page.locator('#confirmSheet')).not.toHaveClass(/open/);
  await open(page, 'log');
  await page.locator('#logEditList .log-set-row').first().locator('.set-remove').click();
  await leave(page, 'log', 'nav'); await expect(page.locator('#confirmSheet')).toHaveClass(/open/);
  await page.locator('#confirmSheetCancel').click();
  await expect(page.locator('#logEditList .log-set-row')).toHaveCount(1);
});

test('new History exercise remains a draft when discarded', async ({ page }) => {
  await open(page, 'log'); const before = await state(page), persisted = await storage(page);
  await page.locator('#viewLogEdit').getByRole('button', { name: 'Добавить упражнение', exact: true }).click();
  await page.locator('#pickerSearch').fill('Draft only'); await page.locator('.pk-create').click();
  await leave(page, 'log', 'nav'); await page.locator('#confirmSheetOk').click();
  expect(await state(page)).toEqual(before); expect(await storage(page)).toEqual(persisted);
});

for (const kind of ['day', 'log']) test(`${kind}: direct Save failure preserves draft and browser clean Back works`, async ({ page }) => {
  await open(page, kind); await dirty(page, kind); const before = await state(page), persisted = await storage(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('test', 'SecurityError'); }; });
  await screen(page, kind).locator('.bottom-action button').click();
  await expect(screen(page, kind)).toHaveClass(/active/);
  expect(await state(page)).toEqual(before); expect(await storage(page)).toEqual(persisted);
  await expect(field(page, kind)).toHaveValue(kind === 'day' ? '70' : '12');
  await field(page, kind).fill(kind === 'day' ? '50' : '8');
  await page.evaluate(() => history.back());
  await expect(screen(page, kind)).not.toHaveClass(/active/);
  await expect(page.locator('#confirmSheet')).not.toHaveClass(/open/);
});

test('data order and exercise name changes trigger guard and restoring clears it', async ({ page }) => {
  await open(page, 'log');
  await page.evaluate(() => { app.logEdit.items[0].sets.reverse(); app.renderLogEdit(); });
  await leave(page, 'log', 'nav'); await expect(page.locator('#confirmSheet')).toHaveClass(/open/);
  await page.locator('#confirmSheetCancel').click();
  await page.evaluate(() => { app.logEdit.items[0].sets.reverse(); app.logEdit.items[0].name = 'Changed name'; app.renderLogEdit(); });
  await leave(page, 'log', 'nav'); await expect(page.locator('#confirmSheet')).toHaveClass(/open/);
  await page.locator('#confirmSheetCancel').click();
  await page.evaluate(() => { app.logEdit.items[0].name = 'Exercise'; app.renderLogEdit(); });
  await leave(page, 'log', 'nav'); await expect(page.locator('#confirmSheet')).not.toHaveClass(/open/);
});