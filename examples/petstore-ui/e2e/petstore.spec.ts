import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * The full workflow in a real browser (checkpoint 14): list → create → detail → edit → delete →
 * 404, with axe on every page. Same page-object vocabulary as the vitest workflow.
 */

async function axeClean(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

async function selectOption(page: Page, field: string, value: string): Promise<void> {
  await page.getByTestId(`field-${field}`).getByRole('combobox').click();
  await page.getByTestId(`field-${field}-option-${value}`).click();
}

test('petstore workflow with zero backend', async ({ page }) => {
  await page.goto('/pet');
  await expect(page.getByTestId('pet-list-table')).toBeVisible();
  await axeClean(page);

  await page.getByTestId('action-pet_create').click();
  await expect(page.getByTestId('pet-create-screen')).toBeVisible();
  await page.getByTestId('field-name').getByRole('textbox').fill('Rex');
  await selectOption(page, 'species', 'dog');
  await axeClean(page);
  await page.getByTestId('pet-create-actions').getByTestId('action-pet_create').click();

  await expect(page.getByTestId('pet-detail-screen')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rex');
  const id = page.url().split('/').pop() ?? '';
  await axeClean(page);

  await page.getByTestId('action-pet_update').click();
  await expect(page.getByTestId('pet-edit-screen')).toBeVisible();
  await selectOption(page, 'status', 'sold');
  await page.getByTestId('pet-edit-actions').getByTestId('action-pet_update').click();
  await expect(page.getByTestId('pet-detail-screen')).toBeVisible();
  await expect(page.getByTestId('pet-status-chip')).toHaveAttribute('data-status', 'sold');

  await page.getByTestId('action-pet_delete').click();
  await page.getByTestId('action-pet_delete-confirm').click();
  await expect(page.getByTestId('pet-list-table')).toBeVisible();
  await expect(page.getByTestId(`pet-list-row-${id}`)).toHaveCount(0);

  await page.goto(`/pet/${id}`);
  await expect(page.getByTestId('state-empty')).toBeVisible();
  await axeClean(page);
});
