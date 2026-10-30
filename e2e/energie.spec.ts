import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

async function axeAndPhone(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map((r) => ({ id: r.id, nodes: r.nodes.map((n) => n.target) }))).toEqual(
    []
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('supply page shows the mix and recalculates state prices', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/de/stromversorgung/');
  await page.locator('#laender').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('cheapest-state')).not.toBeEmpty();
  const spread = page.getByTestId('state-spread');
  const before = (await spread.textContent()) ?? '';
  await page.getByLabel('Umweltkosten nach Umweltbundesamt einrechnen').check();
  await expect(spread).not.toHaveText(before);
  await expect(page.locator('.solar-chart svg').first()).toBeVisible();
  expect(errors).toEqual([]);
  await axeAndPhone(page);
});

test('counting page compares fossil and electric energy', async ({ page }) => {
  await page.goto('/de/energie-zaehlen/');
  await expect(page.locator('.solar-chart svg')).toHaveCount(1);
  const factor = page.getByTestId('factor');
  const before = (await factor.textContent()) ?? '';
  await page.getByLabel('Jahresarbeitszahl Wärmepumpe', { exact: true }).fill('2');
  await expect(factor).not.toHaveText(before);
  await axeAndPhone(page);
});

test('scenario game can be lost and won', async ({ page }) => {
  await page.goto('/de/stromsystem-2045/');
  const verdict = page.getByTestId('verdict');
  await expect(verdict).toContainText('Geschafft');
  await page.getByLabel('Gaskraftwerke', { exact: true }).fill('10');
  await expect(verdict).toContainText('Verloren');
  await expect(page.getByTestId('condition-supply')).toContainText('fehlt Strom');
  await page.getByRole('button', { name: 'Zurück auf die Vorgabe für 2045' }).click();
  await expect(verdict).toContainText('Geschafft');
  await expect(page.locator('.solar-chart svg')).toHaveCount(2);
  await axeAndPhone(page);
});
