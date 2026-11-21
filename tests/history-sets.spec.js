const { test: base, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const evidence = path.join(os.tmpdir(), 'gym-ux02-evidence');
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => {
      if (localStorage.getItem('gym_programs_v1')) return;
      const exercises = [{ id: 'a', name: 'Exercise A' }, { id: 'b', name: 'Exercise B' }, { id: 'c', name: 'Exercise C' }];
      localStorage.setItem('gym_programs_v1', JSON.stringify([{ id: 'p', name: 'Test', days: [{ id: 'd', name: 'Test day', exercises }] }]));
      localStorage.setItem('gym_workout_logs_v1', JSON.stringify([
        { id: 'l1', date: '2026-10-01T10:00:00Z', dayId: 'd', dayName: 'Test day', note: 'Keep note', entries: [
          { exerciseId: 'a', custom: 'keep entry', sets: [{ weight: 60, reps: 8, timestamp: 1000, note: 'keep set' }, { weight: 65, reps: 10, timestamp: 2000 }] },
          { exerciseId: 'b', sets: [{ weight: 20, reps: 12, timestamp: 3000 }] }
        ] },
        { id: 'l2', date: '2026-10-02T10:00:00Z', dayId: 'd', entries: [{ exerciseId: 'a', sets: [{ weight: 40, reps: 15, timestamp: 4000 }] }] }
      ]));
    });
    await page.goto('/');
    await use(page);
    expect(errors).toEqual([]);
  }
});
const first = page => page.locator('#logEditList .edit-card').first();
const row = (page, n) => first(page).locator('.log-set-row').nth(n);
const field = (page, n, key) => row(page, n).locator(`[data-field="${key}"]`);
const read = page => page.evaluate(() => localStorage.getItem('gym_state_v1')
  ? JSON.parse(localStorage.getItem('gym_state_v1')).workoutLogs : JSON.parse(localStorage.getItem('gym_workout_logs_v1')));
async function open(page) {
  await page.locator('#navItemHome').click();
  const item = page.locator('.history-item').filter({ hasText: '01.10.2026' });
  await item.locator('.card-menu-btn').click();
  await item.getByRole('button', { name: 'Редактировать', exact: true }).click();
}
async function save(page) { await page.locator('#viewLogEdit .bottom-action button').click(); }
async function checkOthers(page, before) {
  const after = await read(page);
  expect(after[0].entries[1]).toEqual(before[0].entries[1]);
  expect(after[1]).toEqual(before[1]);
  expect(after[0].note).toBe(before[0].note);
  expect(after[0].entries[0].custom).toBe('keep entry');
}

test('original reproduction: editing first-set reps preserves second set', async ({ page }, info) => {
  const before = await read(page);
  await open(page);
  await page.locator('#viewLogEdit').evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished));
  });
  fs.mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: path.join(evidence, `${process.env.GYM_CAPTURE || 'after'}-${info.project.name}.png`) });
  if (process.env.GYM_CAPTURE === 'before') {
    await first(page).locator('[data-field="r"]').first().fill('12');
  } else {
    await field(page, 0, 'r').fill('12');
  }
  await save(page);
  const after = await read(page);
  await page.locator('#viewHistory').evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished));
  });
  await page.screenshot({ path: path.join(evidence, `saved-${info.project.name}.png`) });
  expect(after[0].entries[0].sets).toEqual([
    { ...before[0].entries[0].sets[0], reps: 12 }, before[0].entries[0].sets[1]
  ]);
  await checkOthers(page, before);
});

test('edit second-set weight only', async ({ page }) => {
  const before = await read(page); await open(page);
  await field(page, 1, 'w').fill('70.5'); await save(page);
  expect((await read(page))[0].entries[0].sets).toEqual([before[0].entries[0].sets[0], { ...before[0].entries[0].sets[1], weight: 70.5 }]);
  await checkOthers(page, before);
});

test('edit both values in one set and retain metadata', async ({ page }) => {
  const before = await read(page); await open(page);
  await field(page, 0, 'w').fill('62,5'); await field(page, 0, 'r').fill('9'); await save(page);
  expect((await read(page))[0].entries[0].sets).toEqual([{ ...before[0].entries[0].sets[0], weight: 62.5, reps: 9 }, before[0].entries[0].sets[1]]);
  await checkOthers(page, before);
});

test('add an independently editable set without changing unsaved inputs', async ({ page }) => {
  const before = await read(page); await open(page);
  await field(page, 0, 'r').fill('11');
  await first(page).getByRole('button', { name: 'Добавить подход', exact: true }).click();
  await expect(field(page, 0, 'r')).toHaveValue('11');
  await field(page, 2, 'w').fill('30'); await field(page, 2, 'r').fill('6'); await save(page);
  const sets = (await read(page))[0].entries[0].sets;
  expect(sets.slice(0, 2)).toEqual([{ ...before[0].entries[0].sets[0], reps: 11 }, before[0].entries[0].sets[1]]);
  expect(sets[2]).toMatchObject({ weight: 30, reps: 6 });
  expect(sets[2].timestamp).toEqual(expect.any(Number));
  await checkOthers(page, before);
});

test('remove first set preserving the remaining set identity', async ({ page }) => {
  const before = await read(page); await open(page);
  await row(page, 0).getByRole('button', { name: 'Удалить подход 1', exact: true }).click(); await save(page);
  expect((await read(page))[0].entries[0].sets).toEqual([before[0].entries[0].sets[1]]);
  await checkOthers(page, before);
});

test('save without changes preserves all historical data exactly', async ({ page }) => {
  const before = await read(page); await open(page); await save(page);
  expect(await read(page)).toEqual(before);
});

test('Back cancels changes including added and removed sets', async ({ page }) => {
  const before = await read(page); await open(page);
  await field(page, 0, 'r').fill('12');
  await first(page).getByRole('button', { name: 'Добавить подход', exact: true }).click();
  await row(page, 1).getByRole('button', { name: 'Удалить подход 2', exact: true }).click();
  await page.locator('#viewLogEdit').getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.locator('#confirmSheetTitle')).toHaveText('Сохранить изменения?');
  await page.locator('#confirmSheetOk').click();
  expect(await read(page)).toEqual(before);
  await open(page); await expect(field(page, 0, 'r')).toHaveValue('8');
  await expect(first(page).locator('.log-set-row')).toHaveCount(2);
});

test('saved individual values persist across page reload', async ({ page }) => {
  await open(page); await field(page, 0, 'r').fill('12'); await save(page);
  const saved = await read(page); await page.reload(); await open(page);
  await expect(field(page, 0, 'r')).toHaveValue('12');
  await expect(field(page, 1, 'w')).toHaveValue('65');
  await expect(field(page, 1, 'r')).toHaveValue('10');
  expect(await read(page)).toEqual(saved);
});

test('three sets stay independent and fit the mobile viewport', async ({ page }) => {
  await open(page);
  await first(page).getByRole('button', { name: 'Добавить подход', exact: true }).click();
  await field(page, 2, 'w').fill('999.99'); await field(page, 2, 'r').fill('999');
  await save(page); await open(page);
  await expect(field(page, 2, 'w')).toHaveValue('999.99');
  const overflow = await page.locator('#logEditList .log-set-row').evaluateAll(rows => rows.some(r => [...r.querySelectorAll('*')].some(e => e.getBoundingClientRect().right > innerWidth + 1)));
  expect(overflow).toBe(false);
  await field(page, 1, 'r').fill('13'); await save(page);
  expect((await read(page))[0].entries[0].sets.map(s => [s.weight, s.reps])).toEqual([[60, 8], [65, 13], [999.99, 999]]);
});

test('invalid set blocks all changes and can be corrected', async ({ page }) => {
  const before = await read(page); await open(page);
  await field(page, 0, 'r').fill('0'); await field(page, 1, 'w').fill('70'); await save(page);
  expect(await read(page)).toEqual(before);
  await expect(page.locator('#viewLogEdit')).toHaveClass(/active/);
  await field(page, 0, 'r').fill('12'); await save(page);
  expect((await read(page))[0].entries[0].sets.map(s => [s.weight, s.reps])).toEqual([[60, 12], [70, 10]]);
});

test('adding an exercise through the picker creates editable sets', async ({ page }) => {
  await open(page); await field(page, 0, 'r').fill('11');
  await page.locator('#viewLogEdit').getByRole('button', { name: 'Добавить упражнение', exact: true }).click();
  await page.locator('.pk-row').filter({ hasText: 'Exercise C' }).click();
  await page.locator('#pickerConfirm').click();
  await expect(field(page, 0, 'r')).toHaveValue('11');
  const added = page.locator('#logEditList .edit-card').last();
  await added.locator('.log-set-row').first().locator('[data-field="w"]').fill('25');
  await save(page);
  const log = (await read(page))[0];
  expect(log.entries.find(e => e.exerciseId === 'c').sets[0]).toMatchObject({ weight: 25, reps: 10 });
});

test('last set is protected and bottom add-exercise action is reachable', async ({ page }) => {
  await open(page);
  await row(page, 0).getByRole('button', { name: 'Удалить подход 1', exact: true }).click();
  await row(page, 0).getByRole('button', { name: 'Удалить подход 1', exact: true }).click();
  await expect(first(page).locator('.log-set-row')).toHaveCount(1);
  const button = page.locator('#viewLogEdit').getByRole('button', { name: 'Добавить упражнение', exact: true });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await expect(page.locator('#exercisePicker')).toHaveClass(/open/);
});

test('reordering exercises preserves their per-set draft edits', async ({ page }) => {
  await open(page); await field(page, 0, 'r').fill('12');
  await page.locator('#btnReorderLog').click();
  const cards = page.locator('#logEditList .edit-card');
  const a = await cards.nth(0).boundingBox();
  const b = await cards.nth(1).boundingBox();
  await page.mouse.move(a.x + 20, a.y + 30);
  await page.mouse.down();
  await page.mouse.move(b.x + 20, b.y + b.height - 5, { steps: 15 });
  await page.mouse.up();
  // The application intentionally suppresses clicks for 100 ms after a drag.
  await page.waitForTimeout(150);
  await page.locator('#btnReorderLog').click();
  await save(page);
  const log = (await read(page))[0];
  expect(log.entries.map(e => e.exerciseId)).toEqual(['b', 'a']);
  expect(log.entries[1].sets.map(s => [s.weight, s.reps])).toEqual([[60, 12], [65, 10]]);
});