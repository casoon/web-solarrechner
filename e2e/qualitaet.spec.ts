import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('quality page compares two variants and recalculates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/de/qualitaet/');
  for (const id of ['#module', '#wechselrichter']) {
    await page.locator(`${id} .solar-chart`).scrollIntoViewIfNeeded();
    await expect(page.locator(`${id} .solar-chart svg`)).toBeVisible();
  }
  await page.locator('#rechnung').scrollIntoViewIfNeeded();
  const gain = page.getByTestId('quality-gain');
  await expect(gain).not.toBeEmpty();
  const before = (await gain.textContent()) ?? '';
  await page.getByLabel('Speicher B', { exact: true }).selectOption('high');
  await expect(gain).not.toHaveText(before);
  await expect(page.locator('.solar-chart svg')).toHaveCount(4);
  expect(errors).toEqual([]);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map((r) => ({ id: r.id, nodes: r.nodes.map((n) => n.target) }))).toEqual(
    []
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
