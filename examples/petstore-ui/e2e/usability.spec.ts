import { expect, test, type Page } from '@playwright/test';

/*
 * Usability capture: walks every generated screen and state and saves screenshots under
 * test-results/usability/ for a human review. Asserts only that each screen renders.
 */
const OUT = 'test-results/usability';
const NO_MOTION =
  '*, *::before, *::after { transition: none !important; animation: none !important; }';

async function shot(page: Page, name: string): Promise<void> {
  await page.addStyleTag({ content: NO_MOTION });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function selectOption(page: Page, field: string, value: string): Promise<void> {
  await page.getByTestId(`field-${field}`).getByRole('combobox').click();
  await page.getByTestId(`field-${field}-option-${value}`).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

test.describe('usability capture', () => {
  test('desktop light', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/pet');
    await expect(page.getByTestId('pet-list-table')).toBeVisible();
    await shot(page, '01-list-desktop');

    await page.getByTestId('action-pet_create').click();
    await expect(page.getByTestId('pet-create-screen')).toBeVisible();
    await shot(page, '02-create-empty');
    await page.getByTestId('pet-create-actions').getByTestId('action-pet_create').click();
    await page.waitForTimeout(300);
    await shot(page, '03-create-validation');

    await page.getByTestId('field-name').getByRole('textbox').fill('Rex');
    await selectOption(page, 'species', 'dog');
    await shot(page, '04-create-filled');
    await page.getByTestId('pet-create-actions').getByTestId('action-pet_create').click();
    await expect(page.getByTestId('pet-detail-screen')).toBeVisible();
    await shot(page, '05-detail');

    await page.getByTestId('action-pet_update').click();
    await expect(page.getByTestId('pet-edit-screen')).toBeVisible();
    await shot(page, '06-edit');
    await page.getByTestId('field-name').getByRole('textbox').fill('Rex the Second');
    await page.goBack();
    await page.waitForTimeout(300);
    await shot(page, '07-edit-unsaved-dialog');
    const stay = page.getByRole('dialog').getByRole('button').first();
    if (await stay.isVisible()) await stay.click();
    await page.getByTestId('pet-edit-actions').getByTestId('action-pet_update').click();
    await expect(page.getByTestId('pet-detail-screen')).toBeVisible();

    await page.getByTestId('action-pet_delete').click();
    await shot(page, '08-delete-confirm');
    await page.getByTestId('action-pet_delete-confirm').click();
    await expect(page.getByTestId('pet-list-table')).toBeVisible();
    const id = 'deleted-id-does-not-exist';
    await page.goto(`/pet/${id}`);
    await page.waitForTimeout(500);
    await shot(page, '09-detail-404');

    await page.goto('/views/available_pets');
    await page.waitForTimeout(500);
    await shot(page, '10-view-grid');
    await page.goto('/nope');
    await page.waitForTimeout(300);
    await shot(page, '11-unknown-route');
  });

  test('generated defaults, list empty and loading states', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // `?overrides=0` leaves src/features out: the generated detail screen on a seeded row (a reload
    // restarts the mock store, so the row created above is not reachable here).
    await page.goto('/pet?overrides=0');
    await page
      .getByTestId(/^pet-list-open-/)
      .first()
      .click();
    await expect(page.getByTestId('pet-detail-screen')).toBeVisible();
    await shot(page, '05b-detail-default');
    // `?rows=0` seeds nothing: the empty state inside the table body.
    await page.goto('/pet?rows=0');
    await expect(page.getByTestId('state-empty')).toBeVisible();
    await shot(page, '12-list-empty');
    // `?delay=` holds every mock answer: the skeleton rows while the first page loads.
    await page.goto('/pet?delay=4000');
    await expect(page.getByTestId('pet-list-table')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, '13-list-loading');
  });

  test('phone light', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/pet');
    await page.waitForTimeout(500);
    await shot(page, '20-list-phone');
    await page.getByTestId('action-pet_create').click();
    await page.waitForTimeout(300);
    await shot(page, '21-create-phone');
  });

  test('desktop dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/pet');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-mode', 'dark');
    });
    await page.waitForTimeout(300);
    await shot(page, '30-list-dark');
  });
});
