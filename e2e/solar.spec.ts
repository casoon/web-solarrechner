import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/** Templates are radio rows; the input itself is visually hidden behind its label. */
async function pickPreset(page: Page, id: string) {
  await page.locator(`.preset-option:has(input[value="${id}"])`).click();
  await expect(page.locator(`input[name="preset"][value="${id}"]`)).toBeChecked();
}

/** Steps start closed except the first; most tests work across all of them. */
async function openAllSteps(page: Page) {
  for (const step of await page.locator('.step-toggle').all()) {
    if ((await step.getAttribute('aria-expanded')) === 'false') await step.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.solar-chart svg')).toHaveCount(7);
  await expect(page.locator('opengrid-table').first().locator('tbody tr')).toHaveCount(12);
  await openAllSteps(page);
});
test('steps open and close and summarise their values', async ({ page }) => {
  const storage = page.getByRole('button', { name: /Speicher im Vergleich/ });
  await expect(storage).toHaveAttribute('aria-expanded', 'true');
  await page.getByLabel('Nutzbare Speicherkapazität', { exact: true }).fill('0');
  await storage.click();
  await expect(storage).toHaveAttribute('aria-expanded', 'false');
  await expect(storage).toContainText('ohne Speicher');
  await expect(page.getByLabel('Nutzbare Speicherkapazität', { exact: true })).toBeHidden();
});
test('production integrations update locally and retain complete monthly tables', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let upstream = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/solar')) upstream++;
  });
  const value = page.getByTestId('annual-benefit');
  const before = (await value.textContent()) ?? '';
  await page.getByLabel('Dein Strom-Arbeitspreis', { exact: true }).fill('0.45');
  await expect(value).not.toHaveText(before);
  expect(upstream).toBe(0);
  const table = page.locator('opengrid-table').first();
  await table.getByRole('button', { name: /^PV_kWh/ }).click();
  const sorted = await table.locator('tbody tr td:nth-child(2)').allTextContents();
  const numbers = sorted.map((v) => Number(v.replace(/[^\d.-]/g, '')));
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  await expect(page.locator('.solar-chart svg')).toHaveCount(7);
  expect(errors).toEqual([]);
});
test('BKW, charging, heat pump and financing are usable', async ({ page }) => {
  await page.getByRole('button', { name: 'Balkonkraftwerk', exact: true }).click();
  await expect(page.getByLabel('Modulleistung', { exact: true })).toHaveValue('1.8');
  await page.getByLabel('Elektroautos', { exact: true }).selectOption('2');
  await page.getByLabel('Wärmepumpe einbeziehen').check();
  await page.getByLabel('Anteil kreditfinanziert', { exact: true }).fill('100');
  await expect(page.getByRole('heading', { name: 'Deine Finanzierung' })).toBeVisible();
  await expect(page.locator('opengrid-table').first().locator('tbody tr')).toHaveCount(12);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als JSON speichern' }).click();
  expect((await download).suggestedFilename()).toBe('solar-szenario.json');
});
test('keyboard and accessible structure have no axe violations', async ({ page }) => {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map((r) => ({ id: r.id, nodes: r.nodes.map((n) => n.target) }))).toEqual(
    []
  );
});
test('mobile stays within viewport and methodology is linked', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Über', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Über dieses Projekt');
  await expect(
    page.getByRole('heading', { name: 'Datenquellen und eigene Annahmen' })
  ).toBeVisible();
});
test('calculation walkthrough is linked, readable on mobile and free of axe violations', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'Rechenweg', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('So rechnet der Solarrechner');
  await expect(page.locator('.method-table').first().locator('tbody tr')).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map((r) => r.id)).toEqual([]);
});

test('second roof surface adds module power; storage sizes are compared', async ({ page }) => {
  const benefit = await page.getByTestId('annual-benefit').textContent();
  await page.getByLabel('Zweite Dachfläche, zum Beispiel Ost-West').check();
  await expect(page.getByText('Modulleistung Fläche 1')).toBeVisible();
  await expect(page.getByText('Zusammen 12 kWp')).toBeVisible();
  // West needs a PVGIS request; until then the surface counts like the first one.
  await expect(
    page.getByRole('button', { name: 'Sonnendaten für Ort und Ausrichtung laden' })
  ).toBeVisible();
  await page.locator('#aspect2').selectOption('0');
  await expect(
    page.getByRole('button', { name: 'Sonnendaten für Ort und Ausrichtung laden' })
  ).toHaveCount(0);
  await expect(page.getByTestId('annual-benefit')).not.toHaveText(benefit ?? '');
  const rows = page.locator('.storage-table tbody tr');
  await expect(rows).toHaveCount(5);
  await expect(page.locator('.storage-table tr.current th')).toHaveText('5 kWh');
  await pickPreset(page, 'commuter');
  await expect(page.getByText('Modulleistung Fläche 1')).toHaveCount(0);
});

test('settings travel by share link and JSON file and recalculate on load', async ({ page }) => {
  await expect(page.getByTestId('irr')).toHaveText(/%|nicht bestimmbar/);
  await expect(page.getByTestId('battery-cycles')).toContainText('Vollzyklen im Jahr');
  const household = page.getByLabel('Haushalt ohne Autos und Wärmepumpe', { exact: true });
  const initial = await page.getByTestId('annual-benefit').textContent();
  await household.fill('5200');
  await page.getByLabel('Zweite Dachfläche, zum Beispiel Ost-West').check();
  await page.locator('#aspect2').selectOption('0');
  await expect(page.getByTestId('annual-benefit')).not.toHaveText(initial ?? '');
  await expect(page.locator('.calc-status')).toHaveCount(0);
  const benefit = await page.getByTestId('annual-benefit').textContent();
  await page.getByRole('button', { name: 'Link zum Teilen' }).click();
  const link = await page.getByLabel('Link mit deinen Einstellungen').inputValue();
  expect(link).toMatch(/#einstellungen=[\w-]+$/);

  await page.goto('/de/about/');
  await page.goto(link);
  await expect(page.getByTestId('settings-status')).toHaveText('Einstellungen übernommen.');
  await expect(household).toHaveValue('5200');
  await expect(page.locator('#aspect2')).toHaveValue('0');
  await expect(page.getByTestId('annual-benefit')).toHaveText(benefit ?? '');
  expect(page.url()).not.toContain('#');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als JSON speichern' }).click();
  const file = await (await download).path();
  await pickPreset(page, 'commuter');
  await expect(household).not.toHaveValue('5200');
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(household).toHaveValue('5200');
  await expect(page.getByTestId('annual-benefit')).toHaveText(benefit ?? '');
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByTestId('settings-status')).toContainText('keine Einstellungen');
});

test('twelve templates apply complete scenarios and keep location and electricity price', async ({
  page,
}) => {
  await expect(
    page.getByRole('group', { name: 'Deine Ausgangssituation' }).getByRole('radio')
  ).toHaveCount(12);
  await page.getByLabel('Dein Strom-Arbeitspreis', { exact: true }).fill('0.38');
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/solar')) requests++;
  });
  await pickPreset(page, 'family-heat-car');
  await expect(page.getByLabel('Modulleistung', { exact: true })).toHaveValue('12');
  await expect(page.getByLabel('Elektroautos', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('Wärmepumpe einbeziehen')).toBeChecked();
  await expect(page.getByLabel('Dein Strom-Arbeitspreis', { exact: true })).toHaveValue('0.38');
  const familyBenefit = await page.getByTestId('annual-benefit').textContent();
  await page.getByRole('button', { name: 'Balkonkraftwerk', exact: true }).click();
  await expect(page.getByLabel('Elektroautos', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('Wärmepumpe einbeziehen')).toBeChecked();
  await pickPreset(page, 'balcony-simple');
  await expect(page.getByLabel('Modulleistung', { exact: true })).toHaveValue('0.8');
  await expect(page.getByLabel('Wärmepumpe einbeziehen')).not.toBeChecked();
  await expect(page.getByTestId('annual-benefit')).not.toHaveText(familyBenefit ?? '');
  await expect(page.locator('.summary-heading')).toContainText('Berlin');
  expect(requests).toBe(0);
});
test('cost levels, own labour and bundled protection update totals without double counting', async ({
  page,
}) => {
  await pickPreset(page, 'family-house');
  await page.getByText('Basispreise selbst eintragen').click();
  await page.getByRole('button', { name: 'Günstig', exact: true }).click();
  const low = Number(
    await page.getByLabel('Module und Wechselrichter', { exact: true }).inputValue()
  );
  await page.getByRole('button', { name: 'Aufwendig', exact: true }).click();
  expect(
    Number(await page.getByLabel('Module und Wechselrichter', { exact: true }).inputValue())
  ).toBeGreaterThan(low);
  await page.locator('.cost-extras > summary').click();
  const professional = await page.getByTestId('extra-work-total').textContent();
  await page.getByLabel('Montageservice / Dach-Arbeitslohn', { exact: true }).uncheck();
  await expect(page.getByTestId('extra-work-total')).not.toHaveText(professional ?? '');
  await page.getByLabel('Zählerschrank im Bestand', { exact: true }).selectOption('new');
  await expect(page.getByLabel('Überspannungsschutz ergänzen', { exact: true })).toBeDisabled();
  await expect(
    page.getByLabel('Hauptleitungsschutz (SLS) ergänzen', { exact: true })
  ).toBeDisabled();
  await page.getByLabel('Zusatzbudget Zählerschrank', { exact: true }).fill('-1');
  await expect(page.getByRole('alert')).toContainText('Zusatzbudgets');
  await expect(page.getByRole('button', { name: 'Als JSON speichern' })).toBeDisabled();
  await page.getByLabel('Zusatzbudget Zählerschrank', { exact: true }).fill('3500');
  await expect(page.getByTestId('extra-work-total')).toHaveText('3.500 €');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als JSON speichern' }).click();
  const file = await (await download).path();
  const { readFile } = await import('node:fs/promises');
  expect(file).not.toBeNull();
  const data = JSON.parse(await readFile(file as string, 'utf8'));
  expect(data.settings.work.cabinet).toBe('new');
  expect(data.inputs.electrics).toBe(data.settings.input.electrics + 3500);
  await page.getByLabel('Zählerschrank im Bestand', { exact: true }).selectOption('ready');
  await expect(page.getByTestId('extra-work-total')).toHaveText('0 €');
  await pickPreset(page, 'terraced-house');
  await page.getByLabel('Nutzbare Speicherkapazität', { exact: true }).fill('5');
  expect(
    Number(await page.getByLabel('Vollständiger Speicheraufpreis', { exact: true }).inputValue())
  ).toBeGreaterThan(0);
  await page.getByLabel('Module und Wechselrichter', { exact: true }).fill('7500');
  await expect(
    page.getByLabel('Richtwerte an Anlagen- und Speichergröße anpassen')
  ).not.toBeChecked();
  await page.getByLabel('Modulleistung', { exact: true }).fill('12');
  await expect(page.getByLabel('Module und Wechselrichter', { exact: true })).toHaveValue('7500');
  await page.getByRole('button', { name: 'Orientierung', exact: true }).click();
  await expect(page.getByLabel('Module und Wechselrichter', { exact: true })).not.toHaveValue(
    '7500'
  );
});

test('PDF download captures the applied scenario locally and blocks invalid inputs', async ({
  page,
}, testInfo) => {
  await pickPreset(page, 'old-house-renovation');
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') requests.push(request.url());
  });
  const pdf = page.getByRole('button', { name: 'Ergebnis als PDF speichern', exact: true });
  const pending = page.waitForEvent('download');
  await pdf.click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('solar-ergebnis.pdf');
  const file = testInfo.outputPath('solar-ergebnis.pdf');
  await download.saveAs(file);
  const bytes = await readFile(file);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(20000);
  expect(requests).toEqual([]);
  await expect(pdf).toBeEnabled();
  await page.getByLabel('Modulleistung', { exact: true }).fill('');
  await expect(pdf).toBeDisabled();
});

test('energy flow separates destinations and keeps source colours under production CSP', async ({
  page,
}) => {
  const flow = page.locator('#flow');
  await expect(flow).toContainText('In den Speicher geladen');
  const layout = await flow.evaluate((svg) => {
    const nodes = Array.from(svg.querySelectorAll('.chartlet-sk-node')).map((node) => ({
      label: node.querySelector('title')?.textContent ?? '',
      x: Number(node.getAttribute('x')),
      color: getComputedStyle(node).fill,
    }));
    return {
      nodes,
      styles: svg.querySelectorAll('style').length,
      solar: getComputedStyle(svg).getPropertyValue('--chartlet-color-1').trim(),
    };
  });
  expect(layout.styles).toBe(0);
  expect(layout.solar).toBe('#a76b15');
  const right = Math.max(...layout.nodes.map((node) => node.x));
  const consumption = layout.nodes.find((node) => node.label.startsWith('Bedarf inkl. Standby'));
  const exported = layout.nodes.find((node) => node.label.startsWith('Einspeisung ins Netz'));
  expect(consumption?.x).toBe(right);
  expect(exported?.x).toBe(right);
  await expect(
    page.getByRole('heading', { name: 'Deine Stromkosten mit und ohne Anlage' })
  ).toBeVisible();
  await expect(page.locator('#energy')).toHaveCSS('--chartlet-color-1', '#a76b15');
  await page.getByRole('button', { name: 'Ohne Speicher', exact: true }).click();
  await expect(flow).not.toContainText('In den Speicher geladen');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const region = page.getByRole('region', {
    name: 'Stromquellen, Wege und Ziele im ersten Jahr, in kWh',
  });
  await region.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

async function policySnapshot(page: import('@playwright/test').Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als JSON speichern' }).click();
  const download = await pending;
  const path = await download.path();
  if (!path) throw new Error('Scenario download missing');
  return JSON.parse(await readFile(path, 'utf8'));
}

test('2027 draft exports calendar phases, limits and budgets instead of a flat zero tariff', async ({
  page,
}) => {
  await page.getByLabel('Geplante Inbetriebnahme', { exact: true }).fill('2027-01-01');
  await page.getByLabel('Regel- und Erlösszenario', { exact: true }).selectOption('draft');
  const data = await policySnapshot(page);
  expect(data.format).toBe('solarrechner');
  expect(data.policy.published).toBe(false);
  expect(data.policy.rate).toBeCloseTo(0.052);
  expect(data.policy.marketStart).toBe('2030-02-01');
  expect(data.results.with.firstYear.exportLimit).toBe(50);
  expect(data.results.with.firstYear.exportRevenue).toBeGreaterThan(0);
  expect(data.results.with.cashflows[4].marketingCost).toBeGreaterThan(0);
  expect(data.results.with.cashflows[4].bonusRevenue).toBeGreaterThan(0);
  expect(data.policy.setupCost).toBe(250);
  expect(data.results.with.firstYear.technologyInvestment).toBe(0);
  await expect(
    page.getByRole('heading', { name: 'Erlöse und Regeln deiner Rechnung' })
  ).toBeVisible();
});
test('published and future continuation cases stay distinct; invalid rule budgets block exports', async ({
  page,
}) => {
  await page.getByLabel('Geplante Inbetriebnahme', { exact: true }).fill('2026-10-29');
  const old = await policySnapshot(page);
  expect(old.policy.effective).toBe('current');
  expect(old.policy.published).toBe(true);
  expect(old.policy.supportEnd).toBe('2047-01-01');
  await page.getByLabel('Geplante Inbetriebnahme', { exact: true }).fill('2027-01-01');
  await page.getByLabel('Regel- und Erlösszenario', { exact: true }).selectOption('current');
  const future = await policySnapshot(page);
  expect(future.policy.published).toBe(false);
  expect(future.policy.name).toContain('Annahme');
  await page
    .getByText('Genauer: Erlösphasen, Marktpreise und Technikbudgets', { exact: true })
    .click();
  await page.getByLabel('Zusätzlicher Messstellenbetrieb', { exact: true }).fill('-1');
  await expect(
    page.getByRole('button', { name: 'Ergebnis als PDF speichern', exact: true })
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Als JSON speichern' })).toBeDisabled();
  await page.getByLabel('Zusätzlicher Messstellenbetrieb', { exact: true }).fill('0');
  await expect(page.getByRole('button', { name: 'Als JSON speichern' })).toBeEnabled();
});
test('zero revenue and balcony modes do not invent market proceeds, fees or compulsory meter costs', async ({
  page,
}) => {
  await page.getByLabel('Geplante Inbetriebnahme', { exact: true }).fill('2027-01-01');
  await page.getByLabel('Regel- und Erlösszenario', { exact: true }).selectOption('zero');
  const zero = await policySnapshot(page);
  expect(
    zero.results.with.cashflows.every(
      (r: { exportRevenue: number; bonusRevenue: number; marketingCost: number }) =>
        r.exportRevenue + r.bonusRevenue + r.marketingCost === 0
    )
  ).toBe(true);
  await page.getByRole('button', { name: 'Balkonkraftwerk', exact: true }).click();
  const balcony = await policySnapshot(page);
  expect(balcony.policy.setupCost).toBe(0);
  expect(balcony.results.with.firstYear.technologyCost).toBe(0);
  expect(balcony.results.with.firstYear.marketingCost).toBe(0);
});
