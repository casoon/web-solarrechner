import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/de/anbieter/');
  await expect(page.locator('.solar-chart svg')).toHaveCount(1);
});
test('provider models recalculate locally from their own inputs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let upstream = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/solar')) upstream++;
  });
  await expect(page.locator('.offer-table tbody tr')).toHaveCount(7);
  const rentRate = page.getByTestId('rent-rate');
  const before = (await rentRate.textContent()) ?? '';
  await page.getByLabel('Monatliche Miete', { exact: true }).fill('300');
  await expect(rentRate).not.toHaveText(before);
  await page.getByLabel('Monatliche Miete', { exact: true }).fill('-1');
  await expect(page.getByRole('alert')).toContainText('Negative Eingabewerte');
  expect(upstream).toBe(0);
  expect(errors).toEqual([]);
});
test('provider page has no axe violations and fits a phone', async ({ page }) => {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map((r) => ({ id: r.id, nodes: r.nodes.map((n) => n.target) }))).toEqual(
    []
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
