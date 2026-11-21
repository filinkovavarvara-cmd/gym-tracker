const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const exercise = { id: 'synthetic-exercise', name: 'Synthetic exercise', targetSets: 3, targetReps: '10', targetWeight: 50 };
    localStorage.setItem('gym_programs_v1', JSON.stringify([{ id: 'p', name: 'Synthetic program', days: [
      { id: 'synthetic-day', name: 'Synthetic day', exercises: [exercise] }
    ] }]));
    localStorage.setItem('gym_workout_logs_v1', '[]');
  });
  await page.goto('/');
});

test('QA-02: add template fits the Workouts header and can be clicked', async ({ page }) => {
  const add = page.getByRole('button', { name: 'Добавить тренировку' });
  await expect(add).toBeVisible();
  const { button, header, viewport } = await add.evaluate(el => ({
    button: el.getBoundingClientRect().toJSON(),
    header: el.closest('.page-header').getBoundingClientRect().toJSON(),
    viewport: document.documentElement.clientWidth
  }));
  expect(button.left).toBeGreaterThanOrEqual(header.left);
  expect(button.right).toBeLessThanOrEqual(viewport);
  expect(button.right).toBeLessThanOrEqual(header.right);
  expect(button.width).toBe(48);
  expect(button.height).toBe(48);
  await add.click(); // Playwright checks that the button receives pointer events.
  await expect(page.locator('#viewDayEdit')).toHaveClass(/active/);
});

test.describe('QA-03: numeric sheet focus', () => {
  test.beforeEach(async ({ page }) => {
    await page.locator('[data-day-id="synthetic-day"]').click();
  });

  const metric = (page, field) => page.locator(`.metric-btn[onclick*="'${field}'"]`).first();
  const dialog = page => page.locator('#numpadSheet').getByRole('dialog');
  const done = page => dialog(page).getByRole('button', { name: 'Готово' });
  const first = page => dialog(page).getByRole('button', { name: 'Меньше' });

  test('keyboard opening, full Tab and Shift+Tab cycles, and focus restoration', async ({ page }) => {
    const trigger = metric(page, 'reps');
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(first(page)).toBeFocused();
    await expect(page.locator('#numpadDot')).toBeDisabled();

    await page.locator('#navItemProgram').evaluate(el => el.focus());
    await expect(first(page)).toBeFocused();

    const buttons = await dialog(page).locator('button:enabled').all();
    for (const [key, order] of [
      ['Tab', [...buttons.slice(1), buttons[0]]],
      ['Shift+Tab', [...buttons].reverse()]
    ]) {
      for (const button of order) {
        await page.keyboard.press(key);
        await expect(button).toBeFocused();
      }
    }
    await page.keyboard.press('Shift+Tab');
    await expect(done(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(metric(page, 'count')).toBeFocused();
  });

  test('pointer opening, numeric input rerender, backdrop close and reopen', async ({ page }) => {
    const trigger = metric(page, 'weight');
    const original = await trigger.elementHandle();
    await trigger.click();
    await expect(first(page)).toBeFocused();
    await dialog(page).getByRole('button', { name: '6', exact: true }).click();
    expect(await original.evaluate(el => el.isConnected)).toBe(false);
    await expect(page.locator('#numpadValue')).toHaveText('6');
    await page.locator('#numpadSheet').click({ position: { x: 8, y: 8 } });
    await expect(dialog(page)).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveText('6 кг');

    await trigger.click();
    await expect(first(page)).toBeFocused();
    await done(page).click();
    await expect(trigger).toBeFocused();
  });

  for (const unavailable of ['removed', 'disabled']) {
    test(`closing safely restores a fallback when the trigger is ${unavailable}`, async ({ page }) => {
      const trigger = metric(page, 'weight');
      await trigger.click();
      await trigger.evaluate((el, unavailable) => {
        if (unavailable === 'removed') el.remove();
        else el.disabled = true;
      }, unavailable);
      await done(page).click();
      await expect(dialog(page)).toBeHidden();
      await expect(page.locator('#workoutScreenDayName')).toBeFocused();
      await metric(page, 'reps').click();
      await expect(first(page)).toBeFocused();
      await done(page).click();
      await expect(metric(page, 'reps')).toBeFocused();
    });
  }
});
