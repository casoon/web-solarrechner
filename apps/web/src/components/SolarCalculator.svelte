<script lang="ts">
import { onMount, tick } from 'svelte';
import { run, type Status, Superseded, watchProgress } from '@/lib/solar/calc-client';
import type { JobResult, Scenario } from '@/lib/solar/calc-jobs';
import { currency, number, percent, rate, signedCurrency } from '@/lib/solar/format';
import {
  calculate,
  combineSurfaces,
  type Inputs,
  leasedCar,
  type PeakProfile,
  peakProfiles,
  replacementDue,
  type SolarProfile,
  type StorageGrade,
  storageGrades,
  validate,
  weatherYears,
} from '@/lib/solar/model';
import {
  createPolicy,
  type PolicySettings as PolicyInputs,
  policyChecked,
  policyDefaults,
  policyLastMonth,
  validatePolicy,
} from '@/lib/solar/policy';
import {
  estimateCosts,
  mountings,
  type PriceLevel,
  presetSetup,
  presets,
  resolveCosts,
  type WorkOptions,
} from '@/lib/solar/presets';
import reference from '@/lib/solar/reference.json';
import type { ReportSnapshot } from '@/lib/solar/report';
import { billBreakdown } from '@/lib/solar/result-display';
import {
  decodeShare,
  encodeShare,
  readSettings,
  type Settings,
  settingsFile,
  shareKey,
} from '@/lib/solar/settings';
import CostConfigurator from './CostConfigurator.svelte';
import NumberField from './NumberField.svelte';
import PolicySettings from './PolicySettings.svelte';
import PresetPicker from './PresetPicker.svelte';
import ResultCharts from './ResultCharts.svelte';

type NumericKey = { [K in keyof Inputs]: Inputs[K] extends number ? K : never }[keyof Inputs];
type Field = {
  key: NumericKey;
  label: string;
  unit: string;
  max?: number;
  step?: number;
  hint?: string;
};
const initial = presetSetup('family-house');
const initialPreset = () => presets.find((p) => p.id === 'family-house') ?? presets[0];
/**
 * Planning, ordering and grid registration take a few months: first of the month in ~3 months,
 * at the latest the last month the policy rules cover.
 */
function defaultCommission() {
  const date = new Date();
  date.setMonth(date.getMonth() + 3, 1);
  const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  return [value, policyLastMonth].sort()[0];
}
/** Berlin profiles shipped with the site, so these tilts need no PVGIS request. */
const bundledAngles = [15, 60, 90];
const aspects = [
  { value: 0, label: 'Süd' },
  { value: -45, label: 'Südost' },
  { value: 45, label: 'Südwest' },
  { value: -90, label: 'Ost' },
  { value: 90, label: 'West' },
  { value: 180, label: 'Nord' },
];
let input = $state<Inputs>(initial.input);
let work = $state<WorkOptions>(initial.work);
let priceLevel = $state<PriceLevel>('orientation');
let automaticCosts = $state(true);
let presetId = $state('family-house');
const selectedPreset = $derived(presets.find((p) => p.id === presetId));
/** Optional second roof surface, for example the west side of an east-west roof. */
let second = $state({ on: false, kwp: 4, angle: 35, aspect: 90 });
let secondProfile = $state.raw<SolarProfile | null>(null);
const secondKwp = $derived(input.mode === 'roof' && second.on ? second.kwp : 0);
/** Costs, rules and the model work with the total module power of both surfaces. */
const systemInput = $derived(secondKwp ? { ...input, kwp: input.kwp + secondKwp } : input);
const resolvedInput = $derived(resolveCosts(systemInput, work, priceLevel));
// Hourly profiles are only ever replaced as a whole; raw state keeps them cheap to send to workers.
let profile = $state.raw<SolarProfile>(reference);
const initialPolicy = createPolicy(
  resolveCosts(initial.input, initial.work, 'orientation'),
  defaultCommission(),
  policyDefaults
);
let result = $state(
  calculate(reference, resolveCosts(initial.input, initial.work, 'orientation'), initialPolicy)
);
let applied = $state<Inputs>(resolveCosts(initial.input, initial.work, 'orientation'));
let search = $state('10115');
let places = $state<[string, string, number, number][]>([]);
let selected = $state({ name: 'Berlin · 10115', lat: 52.5323, lon: 13.3846 });
let angle = $state(initialPreset().angle);
let aspect = $state(0);
let loading = $state(false);
let dataError = $state('');
let pdfBusy = $state(false);
let pdfError = $state('');
let placeError = $state('');
let commission = $state(defaultCommission());
let policySettings = $state<PolicyInputs>({ ...policyDefaults });
let progress = $state<Status>(null);
watchProgress((status) => (progress = status));
let selectedBattery = $state(true);
let controller: AbortController | undefined;
let placesLoaded = false;
const validation = $derived(
  Object.values(work.overrides).some(
    (value) => value !== undefined && (!Number.isFinite(value) || value < 0)
  )
    ? 'Bitte Zusatzbudgets als vollständige, nichtnegative Eurobeträge eingeben.'
    : (validate(resolvedInput) ?? validatePolicy(policySettings, commission))
);
const atReference = $derived(selected.lat === reference.lat && selected.lon === reference.lon);
const fits = (p: SolarProfile, a: number, asp: number) =>
  p.angle === a && p.aspect === asp && p.lat === selected.lat && p.lon === selected.lon;
const stale = $derived(!fits(profile, angle, aspect));
const secondStale = $derived(
  secondKwp > 0 && !(secondProfile && fits(secondProfile, second.angle, second.aspect))
);
/** Berlin profiles facing south ship with the site; everything else is a PVGIS request. */
function bundledProfile(a: number, asp: number): SolarProfile | string | null {
  if (!atReference || asp !== 0) return null;
  if (a === reference.angle) return reference;
  return bundledAngles.includes(a) ? `/data/pvgis/berlin-${a}.json` : null;
}
const needsRequest = $derived(
  (stale && !bundledProfile(angle, aspect)) ||
    (secondStale && !bundledProfile(second.angle, second.aspect))
);
/** Until its own data is loaded, the second surface is calculated like the first one. */
const modelProfile = $derived(
  secondKwp
    ? combineSurfaces([
        { kwp: input.kwp, profile },
        {
          kwp: secondKwp,
          profile:
            secondProfile && secondProfile.lat === profile.lat && secondProfile.lon === profile.lon
              ? secondProfile
              : profile,
        },
      ])
    : profile
);
const matches = $derived(
  search.trim().length >= 2
    ? places
        .filter((r) =>
          `${r[0]} ${r[1]}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))
        )
        .slice(0, 12)
    : []
);
$effect(() => {
  if (automaticCosts && Number.isFinite(input.kwp) && Number.isFinite(input.battery)) {
    const estimate = estimateCosts({ ...input, kwp: input.kwp + secondKwp }, priceLevel);
    input.equipment = estimate.equipment;
    input.installation = estimate.installation;
    input.electrics = estimate.electrics;
    input.batteryCost = estimate.batteryCost;
    input.batteryReplacement = Math.round(estimate.batteryCost * 0.75);
  }
});
$effect(() => {
  if (
    (stale && bundledProfile(angle, aspect)) ||
    (secondStale && bundledProfile(second.angle, second.aspect))
  )
    loadProfiles(true);
});
/** When the storage is replaced in the period, what that costs and what is left at the end. */
const storageLife = $derived.by(() => {
  const due = result.with.cashflows
    .filter((c) => c.year > 0 && replacementDue(c.year, result.with.batteryYear))
    .map((c) => c.year);
  if (!due.length) return 'Ein Ersatz fällt in den Betrachtungszeitraum nicht.';
  if (!applied.batteryReplace)
    return `Ab Jahr ${due[0]} läuft die Anlage ohne Speicher weiter; ein Ersatz wird nicht gekauft.`;
  const residual = result.with.cashflows.at(-1)?.residual ?? 0;
  return `Ersatz im Jahr ${due.join(' und ')} für je ${currency(applied.batteryReplacement)}.${
    residual > 0
      ? ` Am Ende hat der letzte Ersatzspeicher noch etwa ${currency(residual)} Restwert, der als Gutschrift zählt.`
      : ''
  }`;
});
const loan = $derived(applied.loanPercent > 0);
const paybackText = (year: number | null) =>
  year ? `ab Jahr ${year}` : `nicht in ${applied.years} Jahren`;
/** The latest inputs as plain data, ready to send to a calculation worker. */
function scenario(): Scenario {
  return {
    profile: modelProfile,
    ...$state.snapshot({ input: resolvedInput, commission, settings: policySettings }),
  };
}
function variantsJob() {
  return {
    kind: 'variants' as const,
    ...scenario(),
    ...$state.snapshot({ system: systemInput, work }),
    automatic: automaticCosts,
    level: priceLevel,
    capacity: selectedBattery ? resolvedInput.battery : 0,
  };
}
function applyResult(input: Inputs, next: JobResult['result']) {
  result = next;
  applied = { ...input, exportLimit: next.with.firstYear.exportLimit };
}
function applyVariants(next: JobResult['variants']) {
  sizeRows = next.sizes;
  chargingRows = next.charging;
}
/** Applies a worker result unless newer inputs have replaced the job in the meantime. */
function background<T>(job: Promise<T>, apply: (value: T) => void) {
  job.then(apply, (error) => {
    if (!(error instanceof Superseded)) throw error;
  });
}
/** Runs a job again when a background run with newer inputs replaced it. */
async function latest<T>(start: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      return await start();
    } catch (error) {
      if (!(error instanceof Superseded)) throw error;
    }
  }
}
// Every change recalculates in background workers, so typing never waits for the model. The short
// delay bundles keystrokes; the status only shows when a calculation takes noticeably long.
const delay = 120;
$effect(() => {
  const job = scenario();
  if (validation) return;
  const timer = setTimeout(
    () => background(run({ kind: 'result', ...job }), (next) => applyResult(job.input, next)),
    delay
  );
  return () => clearTimeout(timer);
});
let storageRows = $state<JobResult['storage']>([]);
$effect(() => {
  const job = {
    kind: 'storage' as const,
    ...scenario(),
    automatic: automaticCosts,
    level: priceLevel,
  };
  if (validation) return;
  const timer = setTimeout(() => background(run(job), (rows) => (storageRows = rows)), delay);
  return () => clearTimeout(timer);
});
const bestStorage = $derived(
  storageRows.reduce<(typeof storageRows)[number] | null>(
    (best, row) => (row.extraNpv > (best?.extraNpv ?? 0) ? row : best),
    null
  )
);
const current = $derived(selectedBattery && applied.battery > 0 ? result.with : result.without);
type Case = JobResult['result']['with'];
let sizeRows = $state<JobResult['variants']['sizes']>([]);
let chargingRows = $state<JobResult['variants']['charging']>([]);
$effect(() => {
  const job = variantsJob();
  if (validation) {
    applyVariants({ sizes: [], charging: [] });
    return;
  }
  const timer = setTimeout(() => background(run(job), applyVariants), delay);
  return () => clearTimeout(timer);
});
/** Storage of the size comparison: the result view chosen above. */
const sizeCapacity = $derived(selectedBattery ? applied.battery : 0);
const bestSize = $derived(
  sizeRows.reduce<(typeof sizeRows)[number] | null>(
    (best, row) => (!best || row.result.npv > best.result.npv ? row : best),
    null
  )
);
const selfUse = (e: Case['energy']) => ((e.load - e.grid) / e.load) * 100;
/** Share of the solar yield used in the house, the usual "Eigenverbrauchsquote". */
const solarUse = (e: Case['energy']) => ((e.direct + e.charge) / Math.max(1, e.pv)) * 100;
/** A car always at home without storage: solar left over for more kilometres. */
const carAtHome = $derived.by(() => {
  const always = chargingRows.at(-1)?.without;
  if (!always) return null;
  const unused = always.energy.export + always.energy.curtailed - always.energy.clipped;
  return { km: (unused * (1 - applied.chargeLoss / 100) * 100) / applied.carUse };
});
/** Idea: a leased second car that always charges at home, instead of the chosen storage. */
const lease = $derived.by(() => {
  const always = chargingRows.at(-1)?.without;
  return always && applied.battery > 0 ? leasedCar(result.with, always, applied) : null;
});

const autonomy = $derived(
  Math.max(0, ((current.energy.load - current.energy.grid) / current.energy.load) * 100)
);
/** Steps open and close independently; the first one starts open. */
let openSteps = $state([true, false, false, false, false, false]);
const summaries = $derived([
  `${input.mode === 'roof' ? 'Dach' : 'Balkonkraftwerk'} · ${number(input.kwp + secondKwp, 1)} kWp · ${aspects.find((a) => a.value === aspect)?.label ?? `${aspect}°`}`,
  selected.name,
  [
    `${number(input.household)} kWh/Jahr`,
    ['kein E-Auto', 'ein E-Auto', 'zwei E-Autos'][input.cars],
    ...(input.heat ? ['Wärmepumpe'] : []),
  ].join(' · '),
  `${number(input.price * 100)} ct/kWh · ${percent(input.priceChange)} pro Jahr`,
  input.battery > 0 ? `${number(input.battery, 1)} kWh Speicher` : 'ohne Speicher',
  `${currency((applied.battery > 0 ? result.with : result.without).investment)} · ${input.loanPercent > 0 ? `${number(input.loanPercent)} % Kredit` : 'Eigenkapital'}`,
]);
const peakOptions = Object.entries(peakProfiles) as [
  PeakProfile,
  (typeof peakProfiles)[PeakProfile],
][];
const costs: Field[] = [
  { key: 'equipment', label: 'Module und Wechselrichter', unit: '€', step: 50 },
  { key: 'installation', label: 'Halterung und Montagematerial (Basis)', unit: '€', step: 50 },
  { key: 'electrics', label: 'Elektroanschluss und Prüfung (Basis)', unit: '€', step: 50 },
  {
    key: 'extras',
    label: 'Weitere Kosten',
    unit: '€',
    step: 50,
    hint: 'Zum Beispiel Gerüst, Lieferung oder zusätzlich zugerechnete Baukosten. Pauschalangebote nicht nochmals als Einzelpositionen zählen.',
  },
  { key: 'running', label: 'Laufende Kosten ohne Speicher', unit: '€/Jahr' },
  { key: 'inverterReplacement', label: 'Wechselrichterersatz', unit: '€' },
  { key: 'inverterYear', label: 'Ersatz im Betriebsjahr', unit: 'Jahr', max: 30 },
];
const batteryFields: Field[] = [
  { key: 'batteryPower', label: 'Lade- und Entladeleistung', unit: 'kW', max: 20, step: 0.1 },
  { key: 'efficiency', label: 'Gesamtwirkungsgrad', unit: '%', max: 100 },
  { key: 'standby', label: 'Standby-Leistung', unit: 'W', max: 150 },
  { key: 'batteryRunning', label: 'Zusätzliche laufende Kosten', unit: '€/Jahr' },
  {
    key: 'batteryDegradation',
    label: 'Kapazitätsverlust pro Jahr',
    unit: '%',
    max: 10,
    step: 0.1,
  },
  { key: 'batteryReplacement', label: 'Ersatzspeicher', unit: '€' },
  {
    key: 'batteryYear',
    label: 'Erster Speicherersatz im Betriebsjahr',
    unit: 'Jahr',
    max: 30,
    hint: 'Danach wieder nach derselben Zahl von Jahren.',
  },
  {
    key: 'batteryCycles',
    label: 'Vollzyklen bis zum Ersatz',
    unit: 'Zyklen',
    max: 20000,
    step: 500,
    hint: 'Hersteller geben für Lithium-Eisenphosphat meist 6.000 bis 10.000 Zyklen an. Wird die Zahl vor dem Ersatzjahr erreicht, rechnet der Rechner den Ersatz früher.',
  },
];
/** A quality line sets price, efficiency, standby, ageing and lifetime together; each stays editable. */
function chooseGrade(grade: StorageGrade) {
  const g = storageGrades[grade];
  input.batteryGrade = grade;
  input.efficiency = g.efficiency;
  input.standby = g.standby;
  input.batteryDegradation = g.degradation;
  input.batteryYear = g.year;
  input.batteryCycles = g.cycles;
  if (automaticCosts)
    input.batteryReplacement = Math.round(
      estimateCosts({ ...input, kwp: input.kwp + secondKwp }, priceLevel).batteryCost * 0.75
    );
}
async function loadPlaces() {
  if (placesLoaded) return;
  try {
    const response = await fetch('/data/orte.json');
    if (!response.ok) throw new Error();
    places = await response.json();
    placesLoaded = true;
  } catch {
    placeError = 'Ortsliste nicht erreichbar. Koordinaten lassen sich unten direkt eingeben.';
  }
}
async function requestProfile(a: number, asp: number, signal: AbortSignal) {
  const bundled = bundledProfile(a, asp);
  if (bundled && typeof bundled !== 'string') return bundled;
  const params = new URLSearchParams({
    lat: String(selected.lat),
    lon: String(selected.lon),
    angle: String(a),
    aspect: String(asp),
  });
  const response = await fetch(bundled ?? `/api/solar/?${params}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return { ...data, location: selected.name } as SolarProfile;
}
/** Loads missing profiles for both surfaces; `bundledOnly` never sends a request to PVGIS. */
async function loadProfiles(bundledOnly = false) {
  controller?.abort();
  controller = new AbortController();
  const request = controller;
  const targets = [
    stale && { a: angle, asp: aspect, set: (p: SolarProfile) => (profile = p) },
    secondStale && {
      a: second.angle,
      asp: second.aspect,
      set: (p: SolarProfile) => (secondProfile = p),
    },
  ].filter((t) => t && (!bundledOnly || bundledProfile(t.a, t.asp) !== null));
  loading = true;
  dataError = '';
  try {
    for (const target of targets) {
      if (!target) continue;
      const next = await requestProfile(target.a, target.asp, request.signal);
      if (!request.signal.aborted) target.set(next);
    }
  } catch (e) {
    if (!request.signal.aborted)
      dataError = e instanceof Error ? e.message : 'Standortdaten konnten nicht geladen werden.';
  } finally {
    if (!request.signal.aborted) loading = false;
  }
}
function applyPreset(id: string) {
  const next = presetSetup(id, priceLevel);
  input = {
    ...next.input,
    price: input.price,
    priceChange: input.priceChange,
    peaks: input.peaks,
    weather: input.weather,
    efficiency: input.efficiency,
    standby: input.standby,
    prosumerFee: input.prosumerFee,
    basePrice: input.basePrice,
  };
  work = next.work;
  automaticCosts = true;
  presetId = id;
  angle = presets.find((p) => p.id === id)?.angle ?? angle;
  selectedBattery = next.input.battery > 0;
  second.on = false;
}
function setMode(mode: 'roof' | 'balcony') {
  const next = presetSetup(mode === 'balcony' ? 'balcony-homeoffice' : 'family-house', priceLevel);
  input = {
    ...input,
    mode: next.input.mode,
    kwp: next.input.kwp,
    ac: next.input.ac,
    equipment: next.input.equipment,
    installation: next.input.installation,
    electrics: next.input.electrics,
    battery: next.input.battery,
    batteryCost: next.input.batteryCost,
    batteryPower: next.input.batteryPower,
    running: next.input.running,
    batteryRunning: next.input.batteryRunning,
    inverterReplacement: next.input.inverterReplacement,
    batteryReplacement: next.input.batteryReplacement,
  };
  work = next.work;
  selectedBattery = next.input.battery > 0;
  angle = mode === 'balcony' ? 90 : 35;
  second.on = false;
}

/** Exports must show the latest inputs even if the delayed recalculation is still pending. */
function flush() {
  if (validation) return;
  const latest = $state.snapshot(resolvedInput);
  result = calculate(
    modelProfile,
    latest,
    createPolicy(latest, commission, $state.snapshot(policySettings))
  );
  applied = { ...latest, exportLimit: result.with.firstYear.exportLimit };
}
async function downloadPdf() {
  pdfBusy = true;
  pdfError = '';
  try {
    // The report needs the latest inputs, also when a background run is still waiting.
    if (!validation) {
      const [[input, next], more] = await Promise.all([
        latest(async () => {
          const job = scenario();
          return [job.input, await run({ kind: 'result', ...job })] as const;
        }),
        latest(() => run(variantsJob())),
      ]);
      applyResult(input, next);
      applyVariants(more);
    }
    await renderPdf();
  } catch {
    pdfError =
      'Das PDF konnte nicht erstellt werden. Bitte erneut versuchen oder die Annahmen als JSON speichern.';
  } finally {
    pdfBusy = false;
  }
}
async function renderPdf() {
  const snapshot: ReportSnapshot = $state.snapshot({
    input: applied,
    base: input,
    work,
    priceLevel,
    preset: selectedPreset?.title ?? presetId,
    profile: { ...profile, hours: undefined },
    result,
    selectedBattery,
    commission,
    autoTariff: policySettings.profile !== 'manual',
    tariffBasis: result.policy?.name ?? 'Eigene Annahme',
    stale: stale || secondStale,
    second: secondKwp ? { kwp: secondKwp, angle: second.angle, aspect: second.aspect } : undefined,
    sizes: sizeRows,
    charging: chargingRows,
    created: `${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Europe/Berlin)`,
  });
  const { renderReport } = await import('@/lib/solar/report');
  const bytes = await renderReport(snapshot);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'solar-ergebnis.pdf';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function currentSettings(): Settings {
  return $state.snapshot({
    preset: presetId,
    priceLevel,
    automaticCosts,
    input,
    work,
    place: selected,
    angle,
    aspect,
    second,
    commission,
    policy: policySettings,
    selectedBattery,
  });
}
let settingsMessage = $state('');
let shareUrl = $state('');
/** Takes over saved settings; sun data for another place or orientation is requested right away. */
async function applySettings(raw: unknown) {
  const next = readSettings(raw, currentSettings());
  if (typeof next === 'string') {
    settingsMessage = next;
    return false;
  }
  presetId = next.preset;
  priceLevel = next.priceLevel;
  automaticCosts = next.automaticCosts;
  input = next.input;
  work = next.work;
  selected = next.place;
  search = '';
  angle = next.angle;
  aspect = next.aspect;
  second = next.second;
  commission = next.commission;
  policySettings = next.policy;
  selectedBattery = next.selectedBattery;
  settingsMessage = 'Einstellungen übernommen.';
  await tick();
  if (needsRequest) loadProfiles();
  return true;
}
async function loadFile(event: Event & { currentTarget: HTMLInputElement }) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = '';
  if (!file) return;
  try {
    await applySettings(JSON.parse(await file.text()));
  } catch {
    settingsMessage = 'Die Datei ist kein gültiges JSON.';
  }
}
async function share() {
  shareUrl = `${location.origin}${location.pathname}#${await encodeShare(currentSettings())}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    settingsMessage = 'Link kopiert.';
  } catch {
    settingsMessage = 'Link erstellt, bitte von Hand kopieren.';
  }
}
onMount(async () => {
  if (!location.hash.includes(`${shareKey}=`)) return;
  try {
    await applySettings(await decodeShare(location.hash));
  } catch {
    settingsMessage = 'Der Link ist unvollständig oder beschädigt.';
  }
  history.replaceState(null, '', `${location.pathname}${location.search}`);
});
function download() {
  flush();
  const blob = new Blob(
    [
      JSON.stringify(
        {
          ...settingsFile(currentSettings()),
          inputs: applied,
          policy: result.policy,
          tariffBasis: result.policy?.name,
          profile: { ...profile, hours: undefined },
          secondProfile: secondKwp && secondProfile ? { ...secondProfile, hours: undefined } : null,
          results: result,
        },
        null,
        2
      ),
    ],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'solar-szenario.json';
  a.click();
  URL.revokeObjectURL(url);
}
</script>

{#snippet stepHead(n: number, title: string, summary: string)}
  <legend>
    <button
      type="button"
      class="step-toggle"
      aria-expanded={openSteps[n - 1]}
      aria-controls={`step-${n}`}
      onclick={() => (openSteps[n - 1] = !openSteps[n - 1])}
    >
      <span class="step">{n}</span>
      <span class="step-title">{title}<span class="step-summary">{summary}</span></span>
      <span class="step-sign" aria-hidden="true">{openSteps[n - 1] ? '−' : '+'}</span>
    </button>
  </legend>
{/snippet}

<PresetPicker selected={presetId} onselect={applyPreset} />
<div class="calculator-layout">
  <form
    class="controls steps"
    onsubmit={(e) => e.preventDefault()}
    aria-label="Annahmen der Solarrechnung"
  >
    <fieldset class="input-section">
      {@render stepHead(1, 'Deine Anlage', summaries[0])}
      <div class="step-body" id="step-1" hidden={!openSteps[0]}>
      <div class="segmented" role="group" aria-label="Anlagentyp">
        <button
          type="button"
          class:active={input.mode === 'roof'}
          aria-pressed={input.mode === 'roof'}
          onclick={() => setMode('roof')}
        >
          Dach / Carport
        </button>
        <button
          type="button"
          class:active={input.mode === 'balcony'}
          aria-pressed={input.mode === 'balcony'}
          onclick={() => setMode('balcony')}
        >
          Balkonkraftwerk
        </button>
      </div>
      <NumberField
        label={secondKwp ? 'Modulleistung Fläche 1' : 'Modulleistung'}
        bind:value={input.kwp}
        unit="kWp"
        min={0.2}
        max={input.mode === 'balcony' ? 2 : 30}
        step={0.1}
        slider
      />
      <p class="field-label" id="mounting-label">Montage</p>
      <div class="segmented" role="group" aria-labelledby="mounting-label">
        {#each mountings[input.mode] as m}<button
            type="button"
            class:active={angle === m.angle}
            aria-pressed={angle === m.angle}
            onclick={() => (angle = m.angle)}
          >
            {m.label} · {m.angle}°
          </button>{/each}
      </div>
      <label for="aspect">{secondKwp ? 'Himmelsrichtung Fläche 1' : 'Himmelsrichtung'}</label>
      <select id="aspect" bind:value={aspect}>
        {#each aspects as a}<option value={a.value}>{a.label}</option>{/each}
      </select>
      {#if input.mode === 'roof'}
        <label class="check">
          <input
            type="checkbox"
            bind:checked={
              () => second.on,
              (on) => {
                if (on) {
                  second.angle = angle;
                  second.aspect = aspect === 0 || aspect === 180 ? 90 : -aspect;
                }
                second.on = on;
              }
            }
          />
           Zweite Dachfläche, zum Beispiel Ost-West
        </label>
        {#if second.on}
          <div class="second-surface">
            <NumberField
              label="Modulleistung Fläche 2"
              bind:value={second.kwp}
              unit="kWp"
              min={0.2}
              max={30}
              step={0.1}
            />
            <NumberField label="Neigung Fläche 2" bind:value={second.angle} unit="°" max={90} />
            <label for="aspect2">Himmelsrichtung Fläche 2</label>
            <select id="aspect2" bind:value={second.aspect}>
              {#each aspects as a}<option value={a.value}>{a.label}</option>{/each}
            </select>
            <p class="field-hint">
              Zusammen {number(input.kwp + second.kwp, 1)} kWp an einem Wechselrichter mit {number(
                input.ac,
                1,
              )} kW (unter „Genauer“). Kosten und Regeln richten sich nach der Summe. Für Ost-West: Fläche
              1 auf Ost, Fläche 2 auf West.
            </p>
          </div>
        {/if}
      {/if}
      <details>
        <summary>Genauer: Neigung {angle}°, Schatten, Wechselrichter</summary>
        <NumberField
          label="Neigung"
          bind:value={angle}
          unit="°"
          max={90}
          slider
          hint="0° liegt flach, 90° steht senkrecht. Die Montage-Knöpfe setzen typische Werte."
        />
        <NumberField
          label="Zusätzliche Verschattung"
          bind:value={input.shade}
          unit="%"
          max={80}
          slider
          hint="Pauschale Näherung für lokalen Schatten, zusätzlich zu 14 % PVGIS-Systemverlusten."
        />
        <p class="field-label" id="weather-label">Sonnenjahr</p>
        <div class="segmented" role="group" aria-labelledby="weather-label">
          {#each weatherYears as w}<button
              type="button"
              class:active={input.weather === w.change}
              aria-pressed={input.weather === w.change}
              onclick={() => {
                input.weather = w.change;
              }}
            >
              {w.label}
            </button>{/each}
        </div>
        <p class="field-hint">
          Die Sonnendaten sind ein langjähriges Mittel. Einzelne Jahre liegen meist etwa 6 % darüber
          oder darunter (Standardabweichung nach PVGIS, 2005–2023). Schnee auf den Modulen ist in
          den Daten nicht enthalten; im Winter kann der Ertrag deshalb deutlich unter dem Mittel
          liegen.
        </p>
        {#if input.mode === 'roof'}<NumberField
            label="AC-Wechselrichterleistung"
            bind:value={input.ac}
            unit="kW"
            min={0.2}
            max={30}
            step={0.1}
            hint={`Darüber wird gekappt: im ersten Jahr ${number(current.energy.clipped)} kWh, ${number((current.energy.clipped / Math.max(1, current.energy.pv)) * 100, 1)} % des Ertrags. Mit Stundenwerten fällt die Kappung eher zu niedrig aus.`}
          /><NumberField
            label="Exportlimit am Netzanschluss"
            disabled={policySettings.automaticLimit}
            bind:value={
              () =>
                policySettings.automaticLimit ? current.firstYear.exportLimit : input.exportLimit,
              (value) => {
                policySettings.automaticLimit = false;
                input.exportLimit = value;
              }
            }
            unit="%"
            max={100}
            hint="Standard aus Schritt 4: im 2027-Entwurf dauerhaft 50 %, im bisherigen Szenario bis zur betriebsbereiten Technik 60 %. Dort lässt sich die Automatik abwählen."
          />{:else}<p class="field-hint">
            AC-Abgabe insgesamt auf 800 VA begrenzt. Unvergüteter Export. Anschlusszulässigkeit und
            Speicherkompatibilität separat prüfen.
          </p>{/if}
      </details>
      </div>
    </fieldset>
    <fieldset class="input-section">
      {@render stepHead(2, 'Standort', summaries[1])}
      <div class="step-body" id="step-2" hidden={!openSteps[1]}>
      <label for="place">PLZ oder Ort</label>
      <input
        id="place"
        type="search"
        placeholder="Zum Beispiel 10115 oder Berlin"
        bind:value={search}
        onfocus={loadPlaces}
        oninput={loadPlaces}
        autocomplete="off"
      />
      {#if matches.length}<ul class="place-list">
          {#each matches as p}<li>
              <button
                type="button"
                onclick={() => {
                  selected = { name: `${p[1]} · ${p[0]}`, lat: p[2], lon: p[3] };
                  search = '';
                }}
              >
                {p[0]} · {p[1]}
              </button>
            </li>{/each}
        </ul>{/if}
      {#if placeError}<p class="error">{placeError}</p>{/if}
      <p class="field-hint">Gewählt: {selected.name}. PLZ-Koordinaten sind eine Näherung.</p>
      {#if needsRequest}
        <button
          type="button"
          class="apply-button"
          disabled={loading}
          onclick={() => loadProfiles()}
        >
          {loading ? 'PVGIS-Daten werden geladen …' : 'Sonnendaten für Ort und Ausrichtung laden'}
        </button>
        <p class="field-hint">
          Dafür werden Ort, Neigung und Himmelsrichtung an PVGIS (EU-Kommission) übermittelt. Bis
          dahin rechnet der Rechner mit {profile.location}, {profile.angle}° Neigung{secondKwp
            ? ', die zweite Dachfläche wie die erste'
            : ''}.
        </p>
      {/if}
      {#if dataError}<p class="error" role="alert">{dataError}</p>{/if}
      <details>
        <summary>Koordinaten direkt eingeben</summary>
        <NumberField
          label="Breitengrad"
          bind:value={selected.lat}
          unit="° N"
          min={47}
          max={55.2}
          step={0.001}
        /><NumberField
          label="Längengrad"
          bind:value={selected.lon}
          unit="° O"
          min={5.5}
          max={15.5}
          step={0.001}
        />
      </details>
      </div>
    </fieldset>
    <fieldset class="input-section">
      {@render stepHead(3, 'Dein Stromverbrauch', summaries[2])}
      <div class="step-body" id="step-3" hidden={!openSteps[2]}>
      <NumberField
        label="Haushalt ohne Autos und Wärmepumpe"
        bind:value={input.household}
        unit="kWh/Jahr"
        min={500}
        max={15000}
        step={100}
        slider
      />
      <label for="pattern">Wann braucht ihr Strom?</label>
      <select id="pattern" bind:value={input.pattern}>
        <option value="evening">Vor allem morgens und abends</option>
        <option value="day">Auch tagsüber zu Hause</option>
        <option value="flat">Gleichmäßiger Verbrauch</option>
      </select>
      <label for="cars">Elektroautos</label>
      <select id="cars" bind:value={input.cars}>
        <option value={0}>Kein Elektroauto</option>
        <option value={1}>Ein Elektroauto</option>
        <option value={2}>Zwei Elektroautos</option>
      </select>
      {#if input.cars > 0}
        <NumberField
          label="Fahrleistung je Auto"
          bind:value={input.km}
          unit="km/Jahr"
          max={50000}
          step={1000}
          slider
        />
        <label for="charge">Laden zu Hause</label>
        <select id="charge" bind:value={input.chargeTime}>
          <option value="evening">Abends, 18–24 Uhr</option>
          <option value="day">Tagsüber mit PV-Überschuss, Rest abends</option>
        </select>
        {#if input.chargeTime === 'day'}<NumberField
            label="Tage pro Woche mit Auto tagsüber zu Hause"
            bind:value={input.carDaysHome}
            unit="Tage"
            max={7}
            slider
            hint="Das Wochenende zählt zuerst. 7 heißt: Es steht immer ein Auto da, etwa im Homeoffice oder bei zwei Autos im Wechsel."
          /><NumberField
            label="Aufpreis für Solar-Überschussladen"
            bind:value={input.wallboxCost}
            unit="€"
            max={10000}
            step={50}
            hint="Einmalig, Teil der Investition: eine Wallbox mit Solarsteuerung oder ein Energiemanager, der das Auto nur mit übrigem Sonnenstrom lädt. Ohne diese Steuerung lädt eine Wallbox sofort mit voller Leistung, auch aus dem Netz. Vorbelegt 800 €; ist die Wallbox schon da und braucht nur die Steuerung, eher weniger."
          />{/if}
        <details>
          <summary>Genauer: Verbrauch und Ladetechnik</summary>
          {#if input.chargeTime === 'day'}<p class="field-hint">
              Die Wallbox lädt an diesen Tagen zwischen 9 und 17 Uhr, sobald mindestens 1,4 kW
              Sonnenstrom übrig sind. Was fehlt, lädt sie ab 17 Uhr aus dem Netz oder dem Speicher
              nach, bis auf den Puffer.
            </p>
            <NumberField
              label="Puffer im Autoakku"
              bind:value={input.carBuffer}
              unit="kWh"
              max={200}
              step={5}
              hint="So viel Ladung darf dem Auto abends fehlen; sie wartet auf den nächsten sonnigen Tag. 0 = jeden Abend voll. Etwa 20 bis 30 kWh sind realistisch, wenn das Auto selten weit fährt."
            />{/if}
          <NumberField
            label="Fahrverbrauch je Auto (Batterie)"
            bind:value={input.carUse}
            unit="kWh/100 km"
            min={8}
            max={40}
            step={0.5}
          />
          <NumberField
            label="Anteil zu Hause geladen"
            bind:value={input.homeCharge}
            unit="%"
            max={100}
          />
          <NumberField
            label="Ladeverluste am Zähler"
            bind:value={input.chargeLoss}
            unit="%"
            max={40}
          />
          <NumberField
            label="Gemeinsame maximale Ladeleistung"
            bind:value={input.chargePower}
            unit="kW"
            max={22}
            step={0.1}
          />
          <p class="field-hint">
            {input.cars === 2 ? 'Beide Autos verwenden hier dasselbe Fahr- und Ladeprofil. ' : ''}Nicht
            ladbare Energie wird separat ausgewiesen.
          </p>
        </details>
      {/if}
      <label class="check">
        <input type="checkbox" bind:checked={input.heat} />
         Wärmepumpe einbeziehen
      </label>
      {#if input.heat}
        <NumberField
          label="Nutzwärme inkl. Warmwasser"
          bind:value={input.heatDemand}
          unit="kWh/Jahr"
          max={40000}
          step={500}
        />
        <details>
          <summary>Genauer: Jahresarbeitszahl {number(input.jaz, 1)} und Tarif</summary>
          <NumberField
            label="Jahresarbeitszahl"
            bind:value={input.jaz}
            unit="JAZ"
            min={1}
            max={6}
            step={0.1}
          />
          <p class="field-hint">
            Strom = Nutzwärme / JAZ, über das Jahr konstant. Synthetische Heizlast aus
            PVGIS-Temperaturen; 20 % gleichmäßiger Warmwasseranteil. Gasverbrauch nicht ungeprüft
            als Nutzwärme einsetzen.
          </p>
          <p class="field-hint">
            Mit eigenem Wärmepumpentarif oder reduzierten Netzentgelten nach § 14a EnWG ist
            Netzstrom für Wärmepumpe und Wallbox günstiger. Der Rechner bewertet allen
            Eigenverbrauch zum Haushaltspreis; der Vorteil fällt dann etwas kleiner aus.
          </p>
        </details>
      {/if}
      <details>
        <summary>Genauer: Lastspitzen ({peakProfiles[input.peaks].label}) und Grundlast</summary>
        <p class="field-label" id="peaks-label">Lastspitzen im Haushalt</p>
        <div class="segmented" role="group" aria-labelledby="peaks-label">
          {#each peakOptions as [key, p]}<button
              type="button"
              class:active={input.peaks === key}
              aria-pressed={input.peaks === key}
              onclick={() => {
                input.peaks = key;
              }}
            >
              {p.label}
            </button>{/each}
        </div>
        <p class="field-hint">
          Herd, Wasserkocher oder Waschmaschine ziehen kurz mehr Leistung, als die Sonne gerade
          liefert. Ein gleichmäßiger Stundenverbrauch ergibt deshalb die Obergrenze für den
          Eigenverbrauch. Ohne Speicher ist der Unterschied am größten. Zum Gegenprüfen: <a
            href="https://solar.htw-berlin.de/rechner/unabhaengigkeitsrechner/"
          >
            Unabhängigkeitsrechner der HTW Berlin
          </a>.
        </p>
        <NumberField
          label="Konstante Grundlast, im Haushaltsverbrauch enthalten"
          bind:value={input.baseWatts}
          unit="W"
          max={1000}
          hint="0 bedeutet: nur das gewählte Tagesprofil verwenden. Grundlast wird nicht doppelt addiert."
        />
      </details>
      </div>
    </fieldset>
    <fieldset class="input-section">
      {@render stepHead(4, 'Strompreis und Inbetriebnahme', summaries[3])}
      <div class="step-body" id="step-4" hidden={!openSteps[3]}>
      <NumberField
        label="Dein Strom-Arbeitspreis"
        bind:value={input.price}
        unit="€/kWh"
        min={0.15}
        max={0.6}
        step={0.01}
        slider
        hint="Steht auf der Stromrechnung, ohne Grundpreis. Vorbelegt 35 ct: Der BDEW nennt für 2026 im Schnitt 37 ct inklusive anteiligem Grundpreis."
      />
      <NumberField
        label="Grundpreis deines Stromvertrags"
        bind:value={input.basePrice}
        unit="€/Jahr"
        max={1000}
        step={10}
        hint="Die feste Gebühr pro Jahr, egal wie viel Strom du nutzt; oft als Euro pro Monat angegeben (×12). Vorbelegt 150 €, eine eher vorsichtige Schätzung. Du zahlst ihn mit und ohne Anlage, er macht die Stromrechnung nur vollständig."
      />
      <label for="commission">Geplante Inbetriebnahme</label>
      <input id="commission" type="date" bind:value={commission} />
      {#if input.mode === 'roof'}<PolicySettings
          bind:settings={policySettings}
          bind:input
          plan={result.policy ?? initialPolicy}
        />{:else}<p class="field-hint">
          Steckersolar: keine Einspeiseerlöse und hier keine zusätzlichen
          Pflicht-Mess-/Steuerbudgets. MiSpeL-Netzladen und bidirektionales Laden sind nicht
          enthalten.
        </p>{/if}
      <details>
        <summary>Genauer: Preisentwicklung {percent(input.priceChange)} pro Jahr</summary>
        <NumberField
          label="Strompreisänderung pro Jahr"
          bind:value={input.priceChange}
          unit="%"
          min={-5}
          max={8}
          step={0.5}
          slider
          hint="Nur der Wert des selbst genutzten Stroms wird verändert; Erlösphasen, Technik- und Vermarktungskosten bleiben gleich."
        />
      </details>
      <p class="field-hint" data-testid="price-change-note">
        Strompreisänderung {percent(input.priceChange)} pro Jahr. Vorbelegt sind 2 %, nominal etwa
        im Takt der Inflation, wie auf der Seite <a href="/de/strompreis/">Strompreis</a> begründet.
        Steigende Preise machen selbst erzeugten Strom wertvoller, fallende weniger; „Was, wenn
        sich der Strompreis ändert?“ zeigt weitere Pfade.
      </p>
      </div>
    </fieldset>
    <fieldset class="input-section">
      {@render stepHead(5, 'Speicher im Vergleich', summaries[4])}
      <div class="step-body" id="step-5" hidden={!openSteps[4]}>
      <NumberField
        label="Nutzbare Speicherkapazität"
        bind:value={input.battery}
        unit="kWh"
        max={20}
        step={0.5}
        slider
        hint="Verglichen wird immer dieselbe PV-Anlage ohne und mit diesem Speicher."
      />
      <p class="field-label" id="storage-grade-label">Speicherqualität</p>
      <div class="segmented" role="group" aria-labelledby="storage-grade-label">
        {#each Object.entries(storageGrades) as [key, g]}<button
            type="button"
            class:active={input.batteryGrade === key}
            aria-pressed={input.batteryGrade === key}
            onclick={() => chooseGrade(key as StorageGrade)}
          >
            {g.label}
          </button>{/each}
      </div>
      <p class="field-hint">
        Günstig spart heute, muss aber früher ersetzt werden; hochwertig kostet mehr und hält länger.
        {storageGrades[input.batteryGrade].label}: etwa {number(storageGrades[input.batteryGrade].price * 100)} %
        des Standardpreises, Ersatz nach {number(storageGrades[input.batteryGrade].year - 1)} Jahren oder
        {number(storageGrades[input.batteryGrade].cycles)} Vollzyklen, {number(
          storageGrades[input.batteryGrade].degradation,
          1,
        )} % Kapazitätsverlust im Jahr. Übliche Garantien: 10 Jahre bis 60 bis 80 % Restkapazität bei
        6.000 bis 10.000 Zyklen, erste Anbieter geben 15 Jahre.
      </p>
      <label class="check">
        <input type="checkbox" bind:checked={input.batteryReplace} />
        Speicher am Lebensende ersetzen
      </label>
      <p class="field-hint">
        Ohne Ersatz läuft die Anlage danach ohne Speicher weiter. Ein ersetzter Speicher, der am Ende
        des Zeitraums noch Jahre vor sich hat, zählt mit seinem Restwert.
      </p>
      <details>
        <summary>Genauer: Speicherpreis {currency(input.batteryCost)}, Technik, Ersatz</summary>
        <NumberField
          label="Vollständiger Speicheraufpreis"
          bind:value={
            () => input.batteryCost,
            (value) => {
              automaticCosts = false;
              input.batteryCost = value;
            }
          }
          unit="€"
          max={20000}
          step={100}
        />
        <p class="field-hint">
          Die Speicherqualität setzt Wirkungsgrad und Standby: hochwertig 92 % und 3 W, Standard 88 %
          und 10 W, günstig 82 % und 35 W. Labormessungen
          an Heimspeichern ergaben im Bereitschaftsbetrieb 2 bis 64 W (HTW Berlin,
          Stromspeicher-Inspektion 2025). Große Hybrid-Wechselrichter mit Notstromfunktion brauchen
          teils noch mehr; dann den Wert unten selbst eintragen.
        </p>
        {#each batteryFields as f}<NumberField {...f} bind:value={input[f.key]} />{/each}
        <p class="field-hint">
          AC-gekoppeltes Modell: keine Rückgewinnung bereits am Wechselrichter abgeregelter Energie.
        </p>
      </details>
      </div>
    </fieldset>
    <fieldset class="input-section">
      {@render stepHead(6, 'Kosten und Finanzierung', summaries[5])}
      <div class="step-body" id="step-6" hidden={!openSteps[5]}>
      <CostConfigurator
        bind:input
        bind:work
        bind:level={priceLevel}
        bind:automatic={automaticCosts}
      />
      <details>
        <summary>Genauer: Basispreise selbst eintragen</summary>
        <p class="field-hint">
          Ein eigener Basis- oder Speicherpreis schaltet die automatische Orientierung aus. Gewählte
          Zusatzarbeiten werden genau einmal hinzugerechnet.
        </p>
        {#each costs.slice(0, 4) as f}<NumberField
            {...f}
            bind:value={
              () => input[f.key],
              (value) => {
                automaticCosts = false;
                input[f.key] = value;
              }
            }
          />{/each}
      </details>
      <details>
        <summary>Genauer: Laufende Kosten, Zeitraum, Alterung</summary>
        {#each costs.slice(4) as f}<NumberField {...f} bind:value={input[f.key]} />{/each}
        {#if input.mode === 'roof'}<NumberField
            label="Höherer Netz-Grundpreis mit eigener Anlage"
            bind:value={input.prosumerFee}
            unit="€/Jahr"
            max={500}
            step={10}
            hint="Ein höherer Grundpreis für Haushalte mit eigener Erzeugung wird diskutiert, ist aber nicht beschlossen; Höhe und Beginn sind offen. 0 = heutige Regeln. Ein eigener Wert wird jedes Jahr abgezogen."
          />{/if}
        <NumberField
          label="Betrachtungszeitraum"
          bind:value={input.years}
          unit="Jahre"
          min={5}
          max={25}
        />
        <NumberField
          label="Ertragsverlust pro Jahr"
          bind:value={input.degradation}
          unit="%"
          max={5}
          step={0.1}
        />
        <NumberField
          label="Diskontsatz für Kapitalwert"
          bind:value={input.discount}
          unit="%"
          max={15}
          step={0.1}
        />
      </details>
      <NumberField
        label="Anteil kreditfinanziert"
        bind:value={input.loanPercent}
        unit="%"
        max={100}
        step={5}
        slider
      />
      {#if input.loanPercent > 0}<details open>
          <summary>Kreditbedingungen</summary>
          <NumberField
            label="Nominaler Sollzins pro Jahr"
            bind:value={input.interest}
            unit="%"
            max={20}
            step={0.1}
          /><NumberField
            label="Kreditlaufzeit"
            bind:value={input.loanYears}
            unit="Jahre"
            min={1}
            max={30}
          /><NumberField
            label="Einmalige Kreditgebühren"
            bind:value={input.fees}
            unit="€"
            max={5000}
          />
          <p class="field-hint">
            Annuitätendarlehen, monatliche Tilgung, konstanter Sollzins. Kein persönliches
            Finanzierungsangebot.
          </p>
        </details>{/if}
      </div>
    </fieldset>
    <button
      type="button"
      class="text-button"
      onclick={() => {
        priceLevel = 'orientation';
        applyPreset('family-house');
        commission = defaultCommission();
        policySettings = { ...policyDefaults };
      }}
    >
      Familienvorlage wiederherstellen
    </button>
  </form>

  <div class="results" id="ergebnis">
    {#if validation}<p class="error" role="alert">
        {validation} Angezeigt bleibt die letzte gültige Rechnung.
      </p>{/if}
    {#if needsRequest}
      <p class="error" role="status" data-testid="stale-profile">
        Die Ergebnisse gelten noch für {profile.location}, {profile.angle}° Neigung, Ausrichtung
        {profile.aspect}°{secondKwp ? ', zweite Dachfläche wie die erste' : ''}. Für {selected.name}
        und die gewählte Ausrichtung fehlen die Sonnendaten.
        <button type="button" class="apply-button" disabled={loading} onclick={() => loadProfiles()}>
          {loading ? 'PVGIS-Daten werden geladen …' : 'Sonnendaten laden'}
        </button>
      </p>
    {/if}
    <section class="result-summary" aria-labelledby="result-title">
      <div class="summary-heading">
        <div>
          <h2 id="result-title">Was könnte sich lohnen?</h2>
          <span>
            {#if progress}<span class="calc-status" role="status">
                <progress
                  max={progress.total}
                  value={progress.done}
                  aria-label="Fortschritt der Berechnung"
                ></progress>
                Rechnet …
              </span>{/if}{profile.location} · {number(applied.kwp, 1)} kWp · {applied.years} Jahre
          </span>
        </div>
        <div class="segmented result-toggle">
          <button
            type="button"
            class:active={!selectedBattery}
            aria-pressed={!selectedBattery}
            onclick={() => (selectedBattery = false)}
          >
            Ohne Speicher
          </button>
          <button
            type="button"
            class:active={selectedBattery}
            aria-pressed={selectedBattery}
            onclick={() => (selectedBattery = true)}
          >
            Mit {number(applied.battery, 1)} kWh Speicher
          </button>
        </div>
      </div>
      <dl class="key-results">
        <div>
          <dt>Vorteil im 1. Betriebsjahr</dt>
          <dd data-testid="annual-benefit">{currency(current.benefit)}</dd>
        </div>
        <div>
          <dt>Vollständige Investition</dt>
          <dd>{currency(current.investment)}</dd>
        </div>
        <div>
          <dt>Positiver Saldo{loan ? ' mit Kredit' : ' im Zeitraum'}</dt>
          <dd data-testid="payback">
            {paybackText(loan ? current.equityPayback : current.payback)}
            {#if loan}<small>ohne Kredit {paybackText(current.payback)}</small>{/if}
          </dd>
        </div>
        {#if loan}<div>
            <dt>Davon aus eigener Tasche heute</dt>
            <dd data-testid="own-funds">{currency(current.ownFunds)}</dd>
          </div>
          <div>
            <dt>Kreditkosten (Zinsen und Gebühren)</dt>
            <dd data-testid="loan-cost">{currency(current.loanCost)}</dd>
          </div>
          <div>
            <dt>Saldo mit Kredit nach {applied.years} Jahren</dt>
            <dd data-testid="equity-balance">{signedCurrency(current.equityBalance)}</dd>
          </div>{/if}
        <div>
          <dt>Autarkiegrad (Eigenversorgung)</dt>
          <dd>{number(autonomy)} %</dd>
        </div>
        <div>
          <dt>Mehr als Geld zu {number(applied.discount, 1)} % anlegen{loan ? ', mit Kredit' : ''}</dt>
          <dd data-testid="npv">
            {signedCurrency(loan ? current.equityNpv : current.npv)}
            {#if loan}<small>ohne Kredit {signedCurrency(current.npv)}</small>{/if}
          </dd>
        </div>
        <div>
          <dt>{loan ? 'Verzinsung der Anlage' : 'Verzinsung deines Geldes'}</dt>
          <dd data-testid="irr">
            {rate(current.irr)}
            {#if loan}<small data-testid="irr-vs-loan">
                {current.irr !== null && current.irr >= applied.interest
                  ? `über dem Kreditzins von ${rate(applied.interest)}: der Kredit lohnt sich`
                  : `unter dem Kreditzins von ${rate(applied.interest)}: der Kredit kostet mehr, als die Anlage bringt`}
              </small>{/if}
          </dd>
        </div>
      </dl>
      <p>
        Ersparnis und Exporterlös abzüglich laufender Kosten. Autarkiegrad: Anteil deines Verbrauchs,
        den Anlage und Speicher decken, nach Abzug des Speicher-Standby; selbst genutzt werden {number(
          solarUse(current.energy),
        )} % des Solarstroms (Eigenverbrauchsquote). Positiver Saldo: ab diesem Jahr hat die Anlage
        ihre Kosten einschließlich Alterung und Ersatzgeräten rechnerisch erwirtschaftet. {loan
          ? `Die Investition ist der Kaufpreis, egal wie du zahlst; der Kredit verteilt ihn über ${number(applied.loanYears)} Jahre und kostet zusätzlich Zinsen und Gebühren. Mit Kredit zählen Saldo und Vergleich mit der Geldanlage die Raten und die Restschuld mit; klein darunter steht der Wert ohne Kredit. Saldo mit Kredit: was nach allen Raten und der Restschuld bei dir bleibt; ein Plus heißt Gewinn. Liegt die Verzinsung der Anlage unter dem Kreditzins, frisst der Kredit einen Teil des Ertrags. `
          : ''}Verzinsung (Rendite, interner
        Zinsfuß): wie ein Sparbuch, das jedes Jahr diesen Zins bringt. „Mehr als Geld anlegen“
        (Kapitalwert): so viel besser steht die Anlage heute da als dasselbe Geld zum Zins aus Schritt 4
        angelegt; ein Minus heißt, die Geldanlage wäre besser.
      </p>
      <p>
        <strong>Eine grobe Schätzung für den Einstieg.</strong>
         Sonne, Wetter, Verschattung und tatsächlicher Verbrauch schwanken. Die Werte sind nicht auf
        den Cent oder die Kilowattstunde genau. Nutze sie zum Gegenrechnen eigener Pläne, zum Verstehen
        eines Angebots und für Fragen an den Fachbetrieb. Dies ist kein Angebotsrechner.
      </p>
    </section>
    <section class="comparison" aria-labelledby="policy-result-title">
      <h2 id="policy-result-title">Erlöse und Regeln deiner Rechnung</h2>
      <p>
        <strong>{result.policy?.name}</strong>
         · Prüfstand {policyChecked}
      </p>
      <p>
        Jahr 1: {current.firstYear.phase}; Einspeiseerlös inklusive Bonus {currency(
          current.firstYear.exportRevenue + current.firstYear.bonusRevenue,
        )}, Vermarktung {currency(current.firstYear.marketingCost)}, Mess-/Steuerbetrieb {currency(
          current.firstYear.technologyCost,
        )}. Exportlimit {current.firstYear.exportLimit} %.
      </p>
      <p>
        Zusätzliche Technik: {currency(result.policy?.setupCost ?? 0)} in der Anfangsinvestition; spätere
        Einbauten erscheinen im Zahlungsstrom. Eigene Preisannahmen und verbleibende Vereinfachungen
        stehen in Schritt 4 und im PDF.
      </p>
    </section>
    <section class="comparison" aria-labelledby="battery-title">
      <h2 id="battery-title">Was bringt der Speicher zusätzlich?</h2>
      <div class="comparison-line">
        <span>{number(applied.battery, 1)} kWh für {currency(applied.batteryCost)}</span>
        <strong>{currency(result.extraBenefit)} / Jahr</strong>
      </div>
      <p>
        Zusätzlicher Nettovorteil im ersten Jahr. Kapitalwert des Speicheraufpreises über {applied.years}
        Jahre:
        <strong>{currency(result.extraNpv)}</strong>
        bei {number(applied.discount, 1)} % Diskontsatz.
      </p>
      <p>
        {result.extraNpv >= 0
          ? 'Unter diesen Annahmen deckt der zusätzliche Nutzen den Speicheraufpreis einschließlich Ersatz und laufender Kosten.'
          : 'Unter diesen Annahmen deckt der zusätzliche Nutzen den Speicheraufpreis einschließlich Ersatz und laufender Kosten nicht.'}
        Probiere auch tagsüber laden oder einen anderen Aufpreis.
      </p>
      {#if applied.battery > 0}
        <p data-testid="battery-cycles">
          Etwa {number(result.with.energy.battery / applied.battery)} Vollzyklen im Jahr. {result.with
            .batteryYear < applied.batteryYear
            ? `Die ${number(applied.batteryCycles)} Zyklen sind vor Jahr ${applied.batteryYear} erreicht, deshalb hält der Speicher nur ${number(result.with.batteryYear - 1)} Jahre.`
            : `Der Speicher hält ${number(applied.batteryYear - 1)} Jahre, die ${number(applied.batteryCycles)} Zyklen sind bis dahin nicht erreicht.`}
          {storageLife}
        </p>
      {/if}
      {#if storageRows.length}
        <h3>Andere Speichergrößen im Vergleich</h3>
        <div class="table-scroll" role="region" aria-label="Andere Speichergrößen, Tabelle" tabindex="0">
          <table class="storage-table" data-testid="storage-table">
            <thead>
              <tr>
                <th scope="col">Speicher</th>
                <th scope="col">Aufpreis</th>
                <th scope="col">Autarkie&shy;grad</th>
                <th scope="col">Mehr pro Jahr</th>
                <th scope="col">Kapitalwert</th>
              </tr>
            </thead>
            <tbody>
              {#each storageRows as row}{@const e = row.result.energy}
                <tr class:current={row.battery === applied.battery}>
                  <th scope="row">{number(row.battery, 1)} kWh</th>
                  <td>{currency(row.batteryCost)}</td>
                  <td>{number(((e.load - e.grid) / e.load) * 100)} %</td>
                  <td>{currency(row.extraBenefit)}</td>
                  <td>{currency(row.extraNpv)}</td>
                </tr>{/each}
            </tbody>
          </table>
        </div>
        <p class="field-hint">
          Jede Größe gegenüber derselben Anlage ohne Speicher, über {applied.years} Jahre bei {number(
            applied.discount,
            1,
          )} % Diskontsatz, mit Ersatz und laufenden Kosten. Lade- und Entladeleistung, Wirkungsgrad
          und Standby bleiben wie eingestellt. {automaticCosts
            ? 'Preise nach derselben Orientierung wie dein Speicher.'
            : 'Preise mit deinem Preis je kWh hochgerechnet.'}
          {bestStorage
            ? `Den höchsten Kapitalwert hat hier ${number(bestStorage.battery, 1)} kWh.`
            : 'Unter diesen Annahmen hat keine dieser Größen einen positiven Kapitalwert.'}
        </p>
      {/if}
    </section>
    {#if sizeRows.length}
      <section class="comparison" aria-labelledby="size-title">
        <h2 id="size-title">Passt die Anlagengröße?</h2>
        <div class="table-scroll" role="region" aria-label="Anlagengrößen, Tabelle" tabindex="0">
          <table class="storage-table" data-testid="size-table">
            <thead>
              <tr>
                <th scope="col">Anlage</th>
                <th scope="col">Investition</th>
                <th scope="col">Autarkie&shy;grad</th>
                <th scope="col">Solarstrom selbst genutzt</th>
                <th scope="col">Stromkosten im 1. Jahr</th>
                <th scope="col">Vorteil im 1. Jahr</th>
                <th scope="col">Kapitalwert</th>
              </tr>
            </thead>
            <tbody>
              {#each sizeRows as row}{@const e = row.result.energy}
                <tr class:current={row.input.kwp === applied.kwp}>
                  <th scope="row">{number(row.input.kwp, 1)} kWp</th>
                  <td>{currency(row.result.investment)}</td>
                  <td>{number(selfUse(e))} %</td>
                  <td>{number(solarUse(e))} %</td>
                  <td>{currency(billBreakdown(row.result, row.input, sizeCapacity > 0).with)}</td>
                  <td>{currency(row.result.benefit)}</td>
                  <td>{currency(row.result.npv)}</td>
                </tr>{/each}
            </tbody>
          </table>
        </div>
        <p class="field-hint">
          Dieselbe Dachausrichtung, {selectedBattery && applied.battery > 0
            ? `jeweils mit ${number(applied.battery, 1)} kWh Speicher`
            : 'jeweils ohne Speicher'}, Wechselrichter im selben Verhältnis. {automaticCosts
            ? 'Kosten nach derselben Orientierung.'
            : 'Deine Modul- und Montagepreise je kWp hochgerechnet, Elektroanschluss gleich.'}
          Regeln und Einspeiseerlöse gelten je Größe. Größere Anlagen nur, wenn das Dach Platz hat.
          {bestSize
            ? `Den höchsten Kapitalwert hat hier ${number(bestSize.input.kwp, 1)} kWp.`
            : ''}
          Autarkiegrad: Anteil deines Verbrauchs, den die Anlage deckt. Solarstrom selbst genutzt
          (Eigenverbrauchsquote): Anteil des Solarstroms, der im Haus bleibt statt eingespeist zu
          werden. Bei wenig Einspeiseerlös lohnt sich jede zusätzliche kWp vor allem über den
          zweiten Wert.
        </p>
        <p class="field-hint">
          So liest du die Spalten: <strong>Stromkosten</strong> sind, was du im ersten Jahr noch für
          Strom zahlst, mit Grundpreis und Betrieb der Anlage, abzüglich Einspeiseerlös.
          <strong>Vorteil</strong> ist, wie viel weniger das ist als ohne Anlage.
          <strong>Kapitalwert</strong> zieht über die ganze Laufzeit alle Vorteile zusammen und die
          Investition ab; über null heißt: besser als das Geld zu {number(applied.discount, 1)} % anzulegen.
        </p>
      </section>
    {/if}
    {#if chargingRows.length && carAtHome}
      <section class="comparison" aria-labelledby="charging-title">
        <h2 id="charging-title">Auto oder Speicher als Puffer?</h2>
        <div class="table-scroll" role="region" aria-label="Laden des Autos, Tabelle" tabindex="0">
          <table class="storage-table" data-testid="charging-table">
            <thead>
              <tr>
                <th scope="col">Laden</th>
                <th scope="col">Speicher</th>
                <th scope="col">Netzbezug</th>
                <th scope="col">Autarkie&shy;grad</th>
                <th scope="col">Stromkosten im 1. Jahr</th>
                <th scope="col">Vorteil im 1. Jahr</th>
                <th scope="col">Kapitalwert</th>
              </tr>
            </thead>
            <tbody>
              {#each chargingRows as row}
                {#each [row.without, ...(applied.battery > 0 ? [row.with] : [])] as c, k}
                  <tr>
                    {#if k === 0}<th scope="row" rowspan={applied.battery > 0 ? 2 : 1}>
                        {row.label}
                      </th>{/if}
                    <td>{k === 0 ? 'ohne' : `${number(applied.battery, 1)} kWh`}</td>
                    <td>{number(c.energy.grid)} kWh</td>
                    <td>{number(selfUse(c.energy))} %</td>
                    <td>{currency(billBreakdown(c, row.input, k > 0).with)}</td>
                    <td>{currency(c.benefit)}</td>
                    <td>{currency(c.npv)}</td>
                  </tr>{/each}{/each}
            </tbody>
          </table>
        </div>
        <p data-testid="car-at-home">
          Der danach noch übrige Solarstrom reicht rechnerisch für etwa {number(
            Math.round(carAtHome.km / 500) * 500,
          )} km zusätzlich im Jahr, fast nur an sonnigen Tagen im Sommerhalbjahr.
        </p>
        <p class="field-hint">
          Dieselben Autos, dieselben Kilometer, dieselbe Anlage. „Immer ein Auto zu Hause“ heißt zum
          Beispiel Homeoffice oder zwei Autos im Wechsel: Eines fährt, das andere lädt. Der Puffer
          lässt fehlende Ladung bis zu 30 kWh auf den nächsten sonnigen Tag warten. Nicht enthalten:
          Leasingrate, Versicherung, Steuer und Wartung eines zweiten Autos, eingesparter Kraftstoff
          eines ersetzten Verbrenners, Rückspeisen aus dem Auto ins Haus. Beim Laden tagsüber ist der
          Aufpreis von {currency(applied.wallboxCost)} für Solar-Überschussladen in der Investition
          enthalten.
        </p>
        <p class="field-hint">
          So liest du die Spalten: <strong>Stromkosten</strong> sind, was du im ersten Jahr noch für
          Strom zahlst, mit Grundpreis und Betrieb der Anlage, abzüglich Einspeiseerlös.
          <strong>Vorteil</strong> ist, wie viel weniger das ist als ohne Anlage.
          <strong>Kapitalwert</strong> zieht über die ganze Laufzeit alle Vorteile zusammen und die
          Investition ab; über null heißt: besser als das Geld zu {number(applied.discount, 1)} % anzulegen.
        </p>
      </section>
    {/if}
    {#if lease}
      <section class="comparison" aria-labelledby="lease-title">
        <h2 id="lease-title">Idee: geleastes Zweitauto statt Speicher</h2>
        <p>
          Ein Gedankenspiel: Statt {number(applied.battery, 1)} kWh Speicher zu kaufen, least du ein
          zweites Elektroauto. Ihr fahrt abwechselnd, die Kilometer bleiben gleich, aber eines steht
          immer zu Hause und lädt mit Sonnenstrom, eine Art geleaste Batterie. Der Speicher fällt ganz
          weg: kein Kaufpreis, kein Ersatz, keine laufenden Kosten.
        </p>
        <NumberField
          label="Leasingrate des zweiten Autos"
          bind:value={input.leaseRate}
          unit="€/Monat"
          max={3000}
          step={10}
        />
        <NumberField
          label="Versicherung, Wartung, Stellplatz"
          bind:value={input.leaseExtra}
          unit="€/Monat"
          max={1000}
          step={5}
          hint="Grobe Schätzung, vorbelegt 50 €. Elektroautos sind bis 2030 von der Kfz-Steuer befreit."
        />
        <dl class="lease-list" data-testid="lease">
          <div>
            <dt>Weniger Investition (ohne Speicher, mit Wallbox)</dt>
            <dd>
              {currency(lease.storageSaved)}{lease.months >= 1
                ? `, das sind ${number(lease.months)} Leasingraten`
                : ''}
            </dd>
          </div>
          <div>
            <dt>Vorteil im ersten Jahr gegenüber deinem Speicher</dt>
            <dd>{currency(lease.yearly)} im Monat</dd>
          </div>
          <div>
            <dt>Alles über {applied.years} Jahre als Monatsbetrag</dt>
            <dd><strong>{currency(lease.monthly)} im Monat</strong></dd>
          </div>
          <div>
            <dt>Das zweite Auto kostet</dt>
            <dd>{currency(lease.cost)} im Monat</dd>
          </div>
          <div>
            <dt>Bleibt aus eigener Tasche</dt>
            <dd><strong>{currency(lease.remaining)} im Monat</strong></dd>
          </div>
        </dl>
        <p class="field-hint">
          Verglichen wird deine Einstellung mit {number(applied.battery, 1)} kWh Speicher mit „immer
          ein Auto zu Hause, 30 kWh Puffer, ohne Speicher“ aus der Tabelle oben. Der Monatsbetrag
          verteilt den Unterschied im Kapitalwert gleichmäßig über {applied.years} Jahre, mit {number(
            applied.discount,
            1,
          )} % Zins. Das Auto nimmt nur Sonnenstrom für die eigenen Kilometer auf; abends gibt es
          nichts ans Haus zurück, dafür wäre bidirektionales Laden nötig. Nicht gerechnet: ein
          Verbrenner, den das zweite Auto ersetzen könnte, und dessen Sprit.
        </p>
      </section>
    {/if}
    <ResultCharts {result} {applied} withBattery={selectedBattery && applied.battery > 0} />
    <section class="method-note">
      <h2>Ein Überschlag, den du nachvollziehen kannst.</h2>
      <p>
        PVGIS-Erträge für {profile.location}, {profile.angle}° Neigung und Azimut {profile.aspect}°
        (0° = Süd){secondKwp
          ? `, zweite Fläche ${second.angle}° und Azimut ${second.aspect}°`
          : ''}. {profile.period}. Abruf: {profile.retrieved}. Keine Prognose für ein bestimmtes
        kommendes Wetterjahr.
      </p>
      <p>
        Eigene synthetische Lastprofile, stündliche Auflösung, ein gemeinsamer Stromzähler und bis
        zu zwei Dachflächen an einem Wechselrichter. Kurzfristige Lastspitzen, individuelle Gebäude
        und komplexe Speicherarchitekturen werden vereinfacht. Vor einer Investition Angebote und
        Anschlussbedingungen prüfen.
      </p>
      <p>
        <a href="/de/rechenweg/">Rechenweg Schritt für Schritt</a>
        ·
        <a href="/de/about/">Projekt, Datenquellen und Grenzen</a>
        ·
        <a href="https://www.geonames.org/">Ortsdaten: GeoNames</a>
        ·
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
      </p>
      <button
        type="button"
        class="apply-button"
        disabled={Boolean(validation) || pdfBusy}
        aria-busy={pdfBusy}
        onclick={downloadPdf}
      >
        {pdfBusy ? 'PDF wird erstellt …' : 'Ergebnis als PDF speichern'}
      </button>
      <p class="field-hint" role="status">
        {pdfBusy
          ? 'Der Bericht wird lokal im Browser erstellt.'
          : 'PDF mit Ergebnis, Speichervergleich, Kosten, Annahmen und Quellen.'}
      </p>
      {#if pdfError}<p class="error" role="alert">{pdfError}</p>{/if}
      <h3>Speichern und teilen</h3>
      <div class="settings-actions">
        <button type="button" class="text-button" disabled={Boolean(validation)} onclick={download}>
          Als JSON speichern
        </button>
        <label class="text-button">
          JSON laden
          <input type="file" accept="application/json,.json" onchange={loadFile} />
        </label>
        <button type="button" class="text-button" disabled={Boolean(validation)} onclick={share}>
          Link zum Teilen
        </button>
      </div>
      {#if shareUrl}<input
          class="share-url"
          readonly
          value={shareUrl}
          aria-label="Link mit deinen Einstellungen"
          onfocus={(e) => e.currentTarget.select()}
        />{/if}
      <p class="field-hint" role="status" data-testid="settings-status">{settingsMessage}</p>
      <p class="field-hint">
        Datei und Link enthalten alle Eingaben, auch Verbrauch und Kosten, aber keine Ergebnisse:
        Beim Laden rechnet der Rechner neu. Der Link läuft über keinen Server, reist aber durch jedes
        Programm, mit dem du ihn weitergibst. Für Vertrauliches ist die Datei besser.
      </p>
    </section>
  </div>
</div>
