const { test: base, expect } = require('@playwright/test');

// Each test gets a fresh browser context and synthetic localStorage only.
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(() => {
      if (localStorage.getItem('gym_programs_v1')) return;
      const exercise = (id, name) => ({ id, name, targetWeight: 50, targetReps: '10', targetSets: 3, notes: '' });
      localStorage.setItem('gym_programs_v1', JSON.stringify([{
        id: 'test-program', name: 'Test program', days: [
          { id: 'day-a', name: 'Test A', exercises: [exercise('ex-a', 'Exercise A'), exercise('ex-b', 'Exercise B')] },
          { id: 'day-b', name: 'Test B', exercises: [exercise('ex-a', 'Exercise A')] }
        ]
      }]));
      localStorage.setItem('gym_current_program_id_v1', 'test-program');
      localStorage.setItem('gym_workout_logs_v1', '[]');
    });
    await page.goto('/');
    await use(page);
    expect(errors, 'Browser console and uncaught errors').toEqual([]);
  }
});

const card = (page, id = 'ex-a') => page.locator(`[data-exercise-id="${id}"]`);
const metric = (page, field, id = 'ex-a') => card(page, id).locator(`.metric-btn[onclick*="'${field}'"]`).first();
async function start(page, day = 'day-a') {
  await page.locator('#navItemProgram').click();
  await page.locator(`[data-day-id="${day}"]`).click();
  await expect(page.locator('#viewWorkout')).toHaveClass(/active/);
}
async function enter(page, field, value, id = 'ex-a') {
  await metric(page, field, id).click();
  for (const digit of String(value)) {
    await page.locator('#numpadSheet').getByRole('button', { name: digit, exact: true }).click();
  }
  await page.locator('#numpadSheet').getByRole('button', { name: 'Готово', exact: true }).click();
}
async function fill(page, id = 'ex-a') {
  await enter(page, 'weight', 65, id);
  await enter(page, 'reps', 10, id);
  await enter(page, 'count', 3, id);
}
async function finish(page) {
  await page.getByRole('button', { name: 'Сохранить тренировку', exact: true }).click();
  await page.locator('#confirmSheetOk').click();
  await expect(page.locator('#workoutComplete')).toHaveClass(/open/);
  await page.locator('#workoutComplete').getByRole('button', { name: 'Готово', exact: true }).click();
}
async function logs(page) {
  return page.evaluate(() => localStorage.getItem('gym_state_v1')
    ? JSON.parse(localStorage.getItem('gym_state_v1')).workoutLogs : JSON.parse(localStorage.getItem('gym_workout_logs_v1')));
}
async function expectEmpty(page, id = 'ex-a') {
  for (const field of ['weight', 'reps', 'count']) {
    await expect(metric(page, field, id)).toHaveClass(/is-empty/);
    await expect(metric(page, field, id)).toHaveAttribute('aria-label', /не заполнено/);
  }
}
function performed(log) {
  return log.entries.flatMap(entry => entry.sets);
}

test('completed workout never silently supplies results to a new workout', async ({ page }) => {
  await start(page);
  await fill(page);
  await finish(page);
  const first = (await logs(page))[0];
  expect(performed(first)).toHaveLength(3);
  expect(performed(first).map(({ weight, reps }) => ({ weight, reps }))).toEqual(Array(3).fill({ weight: 65, reps: 10 }));
  await start(page);
  await expectEmpty(page);
  await expect(metric(page, 'weight')).toHaveText('65 кг');
  await expect(card(page).locator('.ex-sub')).toContainText('Прошлый раз:');
  await expect(card(page).locator('.ex-sub')).toContainText('65кг×10');
  await finish(page); // No new input: reference hints must not become results.
  const saved = await logs(page);
  expect(saved).toHaveLength(2);
  expect(saved[0]).toEqual(first);
  expect(performed(saved[1])).toEqual([]);
});

test('a different workout with the same exercise starts empty', async ({ page }) => {
  await start(page);
  await fill(page);
  await finish(page);
  await start(page, 'day-b');
  await expectEmpty(page);
  await finish(page);
  expect(performed((await logs(page))[1])).toEqual([]);
});

test('exercise input stays independent while moving between exercises', async ({ page }) => {
  await start(page);
  await fill(page);
  await expectEmpty(page, 'ex-b');
  await enter(page, 'weight', 20, 'ex-b');
  await enter(page, 'reps', 8, 'ex-b');
  await enter(page, 'count', 2, 'ex-b');
  await expect(metric(page, 'weight')).toHaveText('65 кг');
  await expect(metric(page, 'weight', 'ex-b')).toHaveText('20 кг');
  await finish(page);
  const entries = (await logs(page))[0].entries;
  expect(entries[0].sets.map(s => s.weight)).toEqual([65, 65, 65]);
  expect(entries[1].sets.map(s => s.weight)).toEqual([20, 20]);
});

test('cancelling a workout discards input before the next start', async ({ page }) => {
  await start(page);
  await fill(page);
  await page.locator('#viewWorkout').getByRole('button', { name: 'Назад', exact: true }).click();
  await page.locator('#confirmSheetOk').click();
  expect(await logs(page)).toEqual([]);
  await start(page);
  await expectEmpty(page);
  await finish(page);
  expect(performed((await logs(page))[0])).toEqual([]);
});

test('navigation and resume preserve only the unfinished workout draft', async ({ page }) => {
  await start(page);
  await fill(page);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_active_workout_v1')));
  await page.locator('#navItemHome').click();
  await page.locator('#navItemProgram').click();
  await page.locator('.active-card').click();
  await expect(metric(page, 'weight')).toHaveText('65 кг');
  await expect(metric(page, 'weight')).not.toHaveClass(/is-empty/);
  await expectEmpty(page, 'ex-b');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_active_workout_v1')));
  expect(after).toEqual(before);
  await finish(page);
  expect(performed((await logs(page))[0])).toHaveLength(3);
});

test('reload restores the unfinished workout own draft', async ({ page }) => {
  await start(page);
  await fill(page);
  const id = await page.evaluate(() => app.activeWorkout.id);
  await page.reload();
  await page.locator('.active-card').click();
  expect(await page.evaluate(() => app.activeWorkout.id)).toBe(id);
  await expect(metric(page, 'weight')).toHaveText('65 кг');
  await expect(metric(page, 'reps')).toHaveText('10 раз');
  await expect(metric(page, 'count')).toHaveText('3 подх.');
  await expect(metric(page, 'weight')).not.toHaveClass(/is-empty/);
  await expectEmpty(page, 'ex-b');
  await finish(page);
  expect(performed((await logs(page))[0])).toHaveLength(3);
});

test('opening and closing reference hints without input saves no sets', async ({ page }) => {
  await start(page);
  await expectEmpty(page);
  await expect(metric(page, 'weight')).toHaveText('50 кг');
  await metric(page, 'reps').click();
  await page.locator('#numpadSheet').getByRole('button', { name: 'Готово', exact: true }).click();
  await expectEmpty(page);
  await finish(page);
  expect(performed((await logs(page))[0])).toEqual([]);
});

test('starting another workout during a session isolates shared exercises', async ({ page }) => {
  await start(page);
  await fill(page);
  await page.locator('#navItemProgram').click();
  await page.locator('[data-day-id="day-b"]').click();
  await page.locator('#confirmSheetOk').click();
  await expect(page.locator('#workoutComplete')).toHaveClass(/open/);
  await page.locator('#workoutComplete').getByRole('button', { name: 'Готово', exact: true }).click();
  await expectEmpty(page);
  await finish(page);
  const saved = await logs(page);
  expect(performed(saved[0])).toHaveLength(3);
  expect(performed(saved[1])).toEqual([]);
});

test('dismissing finish and cancel dialogs preserves the current input', async ({ page }) => {
  await start(page);
  await fill(page);
  await page.getByRole('button', { name: 'Сохранить тренировку', exact: true }).click();
  await page.locator('#confirmSheetCancel').click();
  await expect(metric(page, 'weight')).toHaveText('65 кг');
  await page.locator('#viewWorkout').getByRole('button', { name: 'Назад', exact: true }).click();
  await page.locator('#confirmSheetCancel').click();
  await expect(metric(page, 'weight')).not.toHaveClass(/is-empty/);
  await finish(page);
  expect(performed((await logs(page))[0])).toHaveLength(3);
});

test('per-set draft survives reload but never carries into a new workout', async ({ page }) => {
  await start(page);
  await fill(page);
  await card(page).getByRole('button', { name: 'Редактировать каждый подход', exact: true }).click();
  await card(page).locator('.set-row').nth(1).locator('.metric-btn').first().click();
  // Existing 65 -> explicitly replace with 70 using the same numeric sheet.
  await page.locator('#numpadSheet').getByRole('button', { name: 'Стереть', exact: true }).click();
  await page.locator('#numpadSheet').getByRole('button', { name: 'Стереть', exact: true }).click();
  await page.locator('#numpadSheet').getByRole('button', { name: '7', exact: true }).click();
  await page.locator('#numpadSheet').getByRole('button', { name: '0', exact: true }).click();
  await page.locator('#numpadSheet').getByRole('button', { name: 'Готово', exact: true }).click();
  await page.reload();
  await page.locator('.active-card').click();
  await expect(card(page).locator('.sets-summary')).toContainText('70 кг');
  await finish(page);
  expect(performed((await logs(page))[0]).map(s => s.weight)).toEqual([65, 70, 65]);
  await start(page);
  await expectEmpty(page);
  await finish(page);
  expect(performed((await logs(page))[1])).toEqual([]);
});