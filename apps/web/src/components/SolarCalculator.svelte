<script lang="ts">
import { onMount, tick } from 'svelte';
import { currency, number, percent, rate } from '@/lib/solar/format';
import {
  calculate,
  combineSurfaces,
  compareStorage,
  type Inputs,
  type PeakProfile,
  peakProfiles,
  type SolarProfile,
  storageTechs,
  validate,
  weatherYears,
} from '@/lib/solar/model';
import {
  createPolicy,
  type PolicySettings as PolicyInputs,
  policyDefaults,
  validatePolicy,
} from '@/lib/solar/policy';
import {
  estimateCosts,
  mountings,
  type PriceLevel,
  presetSetup,
  presets,
  resolveCosts,
  storageOptions,
  type WorkOptions,
} from '@/lib/solar/presets';
import reference from '@/lib/solar/reference.json';
import type { ReportSnapshot } from '@/lib/solar/report';
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
/** Planning, ordering and grid registration take a few months: first of the month in ~3 months. */
function defaultCommission() {
  const date = new Date();
  date.setMonth(date.getMonth() + 3, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
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
let secondProfile = $state<SolarProfile | null>(null);
const secondKwp = $derived(input.mode === 'roof' && second.on ? second.kwp : 0);
/** Costs, rules and the model work with the total module power of both surfaces. */
const systemInput = $derived(secondKwp ? { ...input, kwp: input.kwp + secondKwp } : input);
const resolvedInput = $derived(resolveCosts(systemInput, work, priceLevel));
let profile = $state<SolarProfile>(reference);
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
let computing = $state(false);
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
  }
});
$effect(() => {
  if (
    (stale && bundledProfile(angle, aspect)) ||
    (secondStale && bundledProfile(second.angle, second.aspect))
  )
    loadProfiles(true);
});
// Recalculate on every change; the short delay keeps sliders smooth. The status only shows
// when a calculation takes noticeably long (see .calc-status).
$effect(() => {
  const current = $state.snapshot(resolvedInput);
  const currentProfile = modelProfile;
  const settings = $state.snapshot(policySettings);
  const date = commission;
  if (validation) return;
  computing = true;
  const timer = setTimeout(() => {
    result = calculate(currentProfile, current, createPolicy(current, date, settings));
    applied = { ...current, exportLimit: result.with.firstYear.exportLimit };
    computing = false;
  }, 120);
  return () => clearTimeout(timer);
});
let storageRows = $state<ReturnType<typeof compareStorage>>([]);
// Several full yearly runs: computed after the main result so sliders stay responsive.
$effect(() => {
  const latest = $state.snapshot(resolvedInput);
  const currentProfile = modelProfile;
  const plan = result.policy;
  const options = storageOptions(latest, automaticCosts, priceLevel);
  if (validation) return;
  const timer = setTimeout(() => {
    storageRows = compareStorage(currentProfile, latest, plan, options);
  }, 400);
  return () => clearTimeout(timer);
});
const bestStorage = $derived(
  storageRows.reduce<(typeof storageRows)[number] | null>(
    (best, row) => (row.extraNpv > (best?.extraNpv ?? 0) ? row : best),
    null
  )
);
const current = $derived(selectedBattery && applied.battery > 0 ? result.with : result.without);
const autonomy = $derived(
  Math.max(0, ((current.energy.load - current.energy.grid) / current.energy.load) * 100)
);
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
    label: 'Speicherersatz spätestens im Betriebsjahr',
    unit: 'Jahr',
    max: 30,
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
  computing = false;
}
async function downloadPdf() {
  flush();
  pdfBusy = true;
  pdfError = '';
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
    created: `${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Europe/Berlin)`,
  });
  try {
    const { renderReport } = await import('@/lib/solar/report');
    const bytes = await renderReport(snapshot);
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'solar-ergebnis.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    pdfError =
      'Das PDF konnte nicht erstellt werden. Bitte erneut versuchen oder die Annahmen als JSON speichern.';
  } finally {
    pdfBusy = false;
  }
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

<PresetPicker selected={presetId} onselect={applyPreset} />
<div class="calculator-layout">
  <form
    class="controls"
    onsubmit={(e) => e.preventDefault()}
    aria-label="Annahmen der Solarrechnung"
  >
    <fieldset class="input-section">
      <legend>
        <span class="step">1</span>
         Deine Anlage
      </legend>
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
    </fieldset>
    <fieldset class="input-section">
      <legend>
        <span class="step">2</span>
         Standort
      </legend>
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
    </fieldset>
    <fieldset class="input-section">
      <legend>
        <span class="step">3</span>
         Dein Stromverbrauch
      </legend>
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
        <details>
          <summary>Genauer: Verbrauch und Ladetechnik</summary>
          {#if input.chargeTime === 'day'}<p class="field-hint">
              Die Wallbox lädt zwischen 9 und 17 Uhr, sobald mindestens 1,4 kW Sonnenstrom übrig
              sind. Was bis dahin fehlt, lädt sie ab 17 Uhr aus dem Netz oder dem Speicher nach.
            </p>{/if}
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
            Beide Autos verwenden hier dasselbe Fahr- und Ladeprofil. Nicht ladbare Energie wird
            separat ausgewiesen.
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
    </fieldset>
    <fieldset class="input-section">
      <legend>
        <span class="step">4</span>
         Strompreis & Inbetriebnahme
      </legend>
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
    </fieldset>
    <fieldset class="input-section">
      <legend>
        <span class="step">5</span>
         Speicher im Vergleich
      </legend>
      <NumberField
        label="Nutzbare Speicherkapazität"
        bind:value={input.battery}
        unit="kWh"
        max={20}
        step={0.5}
        slider
        hint="Verglichen wird immer dieselbe PV-Anlage ohne und mit diesem Speicher."
      />
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
        <p class="field-label" id="storage-tech-label">Wirkungsgrad und Standby</p>
        <div class="segmented" role="group" aria-labelledby="storage-tech-label">
          {#each storageTechs as t}<button
              type="button"
              class:active={input.efficiency === t.efficiency && input.standby === t.standby}
              aria-pressed={input.efficiency === t.efficiency && input.standby === t.standby}
              onclick={() => {
                input.efficiency = t.efficiency;
                input.standby = t.standby;
              }}
            >
              {t.label}
            </button>{/each}
        </div>
        <p class="field-hint">
          Effizient 92 % und 3 W, typisch 88 % und 10 W, verlustreich 82 % und 35 W. Labormessungen
          an Heimspeichern ergaben im Bereitschaftsbetrieb 2 bis 64 W (HTW Berlin,
          Stromspeicher-Inspektion 2025). Große Hybrid-Wechselrichter mit Notstromfunktion brauchen
          teils noch mehr; dann den Wert unten selbst eintragen.
        </p>
        {#each batteryFields as f}<NumberField {...f} bind:value={input[f.key]} />{/each}
        <p class="field-hint">
          AC-gekoppeltes Modell: keine Rückgewinnung bereits am Wechselrichter abgeregelter Energie.
        </p>
      </details>
    </fieldset>
    <fieldset class="input-section">
      <legend>
        <span class="step">6</span>
         Kosten & Finanzierung
      </legend>
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
    <section class="result-summary" aria-labelledby="result-title">
      <div class="summary-heading">
        <h2 id="result-title">Was könnte sich lohnen?</h2>
        <span>
          {#if computing}<span class="calc-status" role="status">
              Rechnet …
            </span>{/if}{profile.location}
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
          <dt>Positiver Saldo im Zeitraum</dt>
          <dd>
            {current.payback ? `ab Jahr ${current.payback}` : `nicht in ${applied.years} Jahren`}
          </dd>
        </div>
        <div>
          <dt>Eigenversorgung, netto</dt>
          <dd>{number(autonomy)} %</dd>
        </div>
        <div>
          <dt>Kapitalwert bei {number(applied.discount, 1)} %</dt>
          <dd>{currency(current.npv)}</dd>
        </div>
        <div>
          <dt>Rendite (interner Zinsfuß)</dt>
          <dd data-testid="irr">{rate(current.irr)}</dd>
        </div>
      </dl>
      <p>
        Ersparnis und Exporterlös abzüglich laufender Kosten. Eigenversorgung nach Abzug des
        Speicher-Standby. Amortisation inklusive Alterung und Ersatzgeräten, vor Finanzierung: Die
        Anlage hat ihre Kosten rechnerisch erwirtschaftet. Ein Kredit kann dann noch laufen. Die Rendite
        ist der Zins, zu dem sich das eingesetzte Geld über den Zeitraum verzinst; der Kapitalwert
        vergleicht mit einer Geldanlage zum Diskontsatz aus Schritt 4.
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
         · Prüfstand 29.10.2026
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
            ? `Die ${number(applied.batteryCycles)} Zyklen sind vor Jahr ${applied.batteryYear} erreicht, deshalb wird der Speicher schon im Jahr ${result.with.batteryYear} ersetzt.`
            : `Ersatz im Jahr ${applied.batteryYear}, die ${number(applied.batteryCycles)} Zyklen sind bis dahin nicht erreicht.`}
          {result.with.batteryYear > applied.years
            ? 'Das liegt nach dem Betrachtungszeitraum und kostet in dieser Rechnung nichts.'
            : ''}
        </p>
      {/if}
      {#if storageRows.length}
        <h3>Andere Speichergrößen im Vergleich</h3>
        <div class="table-scroll">
          <table class="storage-table">
            <thead>
              <tr>
                <th scope="col">Speicher</th>
                <th scope="col">Aufpreis</th>
                <th scope="col">Eigen&shy;versorgung</th>
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
