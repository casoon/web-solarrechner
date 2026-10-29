import { defaults, type Inputs, type StorageOption } from './model';

export type PriceLevel = 'low' | 'orientation' | 'high';
const priceLevels = { low: 0.8, orientation: 1, high: 1.3 } as const;
export interface WorkOptions {
  roofMount: boolean;
  scaffold: boolean;
  cabinet: 'ready' | 'upgrade' | 'new';
  surge: boolean;
  sls: boolean;
  circuit: boolean;
  grounding: boolean;
  overrides: Partial<Record<WorkKey | 'cabinet', number>>;
}
const defaultWork: WorkOptions = {
  roofMount: true,
  scaffold: false,
  cabinet: 'ready',
  surge: false,
  sls: false,
  circuit: false,
  grounding: false,
  overrides: {},
};
export interface Preset {
  id: string;
  title: string;
  description: string;
  /** Building drawn in the template picker. */
  home: 'flat' | 'terraced' | 'house' | 'bungalow' | 'large' | 'old';
  values: Partial<Inputs>;
  /** Module tilt that matches how this kind of system is usually mounted. */
  angle: number;
  work?: Partial<WorkOptions>;
}
/** Mounting choices that set the tilt slider. Berlin profiles for these tilts ship with the site. */
export const mountings = {
  balcony: [
    { angle: 90, label: 'Am Geländer' },
    { angle: 60, label: 'Angewinkelt' },
    { angle: 35, label: 'Aufgeständert' },
  ],
  roof: [
    { angle: 15, label: 'Flachdach' },
    { angle: 35, label: 'Schrägdach' },
  ],
} as const;
export const presets: Preset[] = [
  {
    id: 'balcony-simple',
    home: 'flat',
    title: 'Wohnung · kleiner Solar-Einstieg',
    description:
      '1–2 Personen, 1.800 kWh Haushalt, 0,8 kWp Steckersolar senkrecht am Balkongeländer, ohne Speicher. Tagsüber wenig zu Hause, etwas Schatten.',
    angle: 90,
    values: {
      mode: 'balcony',
      kwp: 0.8,
      ac: 0.8,
      household: 1800,
      pattern: 'evening',
      shade: 15,
      battery: 0,
    },
    work: { roofMount: false },
  },
  {
    id: 'balcony-angled',
    home: 'flat',
    title: 'Wohnung · Balkon mit angewinkelten Modulen',
    description:
      '2 Personen, 2.200 kWh Haushalt, 1,6 kWp Steckersolar angewinkelt am Südbalkon, 800 W Wechselrichter, ohne Speicher. Morgens und abends mehr Verbrauch.',
    angle: 60,
    values: {
      mode: 'balcony',
      kwp: 1.6,
      ac: 0.8,
      household: 2200,
      shade: 10,
      battery: 0,
    },
    work: { roofMount: false },
  },
  {
    id: 'balcony-homeoffice',
    home: 'flat',
    title: 'Steckersolar · Homeoffice mit kleinem Akku',
    description:
      '2 Personen, 2.800 kWh Haushalt, 1,8 kWp schräg aufgeständert (Terrasse oder Garten) und 2 kWh Speicher. Tagesverbrauch, bestehender geeigneter Anschluss.',
    angle: 35,
    values: {
      mode: 'balcony',
      kwp: 1.8,
      ac: 0.8,
      household: 2800,
      pattern: 'day',
      shade: 5,
      battery: 2,
    },
    work: { roofMount: false },
  },
  {
    id: 'terraced-house',
    home: 'terraced',
    title: 'Reihenhaus · kleines Dach ohne Akku',
    description:
      '2–3 Personen, 2.800 kWh Haushalt, 4,5 kWp. Morgens und abends mehr Verbrauch, kein Auto und keine Wärmepumpe.',
    angle: 35,
    values: { kwp: 4.5, ac: 4, household: 2800, pattern: 'evening', battery: 0 },
  },
  {
    id: 'daytime-couple',
    home: 'house',
    title: 'Paar im Eigenheim · tagsüber zu Hause',
    description:
      '2 Personen, 2.600 kWh Haushalt, 6 kWp und 3 kWh Speicher. Mehr direkte Nutzung am Tag, überschaubarer Strombedarf.',
    angle: 35,
    values: { kwp: 6, ac: 5, household: 2600, pattern: 'day', battery: 3 },
  },
  {
    id: 'bungalow-flat-roof',
    home: 'bungalow',
    title: 'Bungalow · Flachdach, Ruhestand',
    description:
      '2 Personen, 3.000 kWh Haushalt, 7 kWp flach aufgeständert und 5 kWh Speicher. Tagsüber meist zu Hause, kein Auto und keine Wärmepumpe.',
    angle: 15,
    values: { kwp: 7, ac: 6, household: 3000, pattern: 'day', battery: 5 },
  },
  {
    id: 'family-house',
    home: 'house',
    title: 'Einfamilienhaus · Familie mit vier Personen',
    description:
      '4.200 kWh Haushalt, 8 kWp und 5 kWh Speicher. Alltag mit Morgen- und Abendspitze, ohne zusätzliche Großverbraucher.',
    angle: 35,
    values: { kwp: 8, ac: 7, household: 4200, battery: 5 },
  },
  {
    id: 'commuter',
    home: 'house',
    title: 'Familienhaus · E-Auto lädt abends',
    description:
      '4 Personen, 4.200 kWh Haushalt, 10 kWp und 5 kWh Speicher. Ein Pendlerauto mit 15.000 km/Jahr, Laden nach der Arbeit.',
    angle: 35,
    values: {
      kwp: 10,
      ac: 9,
      household: 4200,
      battery: 5,
      cars: 1,
      km: 15000,
      chargeTime: 'evening',
      homeCharge: 85,
    },
  },
  {
    id: 'solar-charging',
    home: 'house',
    title: 'Homeoffice · E-Auto lädt mit PV-Überschuss',
    description:
      '3.500 kWh Haushalt, 9 kWp und 5 kWh Speicher. Ein Auto mit 12.000 km/Jahr, oft tagsüber da; die Wallbox lädt mit Sonnenüberschuss, den Rest abends.',
    angle: 35,
    values: {
      kwp: 9,
      ac: 8,
      household: 3500,
      pattern: 'day',
      cars: 1,
      km: 12000,
      chargeTime: 'day',
      homeCharge: 90,
      battery: 5,
    },
  },
  {
    id: 'family-heat-car',
    home: 'house',
    title: 'Familienhaus · E-Auto und Wärmepumpe',
    description:
      '4 Personen, 4.200 kWh Haushalt, 12 kWp und 8 kWh Speicher. Ein Auto, 15.000 kWh Nutzwärme und JAZ 3,5.',
    angle: 35,
    values: {
      kwp: 12,
      ac: 10,
      household: 4200,
      cars: 1,
      km: 15000,
      heat: true,
      heatDemand: 15000,
      jaz: 3.5,
      battery: 8,
    },
  },
  {
    id: 'large-electric-house',
    home: 'large',
    title: 'Großes Haus · zwei E-Autos und Wärmepumpe',
    description:
      '5.200 kWh Haushalt, 18 kWp und 12 kWh Speicher. Zwei Autos mit je 18.000 km/Jahr, Überschussladen, 20.000 kWh Nutzwärme.',
    angle: 35,
    values: {
      kwp: 18,
      ac: 15,
      household: 5200,
      pattern: 'day',
      cars: 2,
      km: 18000,
      chargeTime: 'day',
      chargePower: 11,
      heat: true,
      heatDemand: 20000,
      jaz: 3.8,
      battery: 12,
      homeCharge: 90,
    },
  },
  {
    id: 'old-house-renovation',
    home: 'old',
    title: 'Altbau · Wärmepumpe und neue Elektrik',
    description:
      '3.800 kWh Haushalt, 10 kWp und 7,5 kWh Speicher. 25.000 kWh Nutzwärme, JAZ 2,8; neuer Zählerschrank, Zusatzleitung und 80 % Kredit.',
    angle: 35,
    values: {
      kwp: 10,
      ac: 9,
      household: 3800,
      heat: true,
      heatDemand: 25000,
      jaz: 2.8,
      battery: 7.5,
      loanPercent: 80,
      loanYears: 15,
      interest: 5.5,
    },
    work: { cabinet: 'new', circuit: true, grounding: true, scaffold: true },
  },
];
const round = (value: number) => Math.round(value / 10) * 10;
/** Own smooth model curve, informed by VZ NRW's dated offer index; not a live quotation. */
function interpolate(value: number, anchors: readonly (readonly [number, number])[]): number {
  if (value <= anchors[0][0])
    return anchors[0][0] === 0 ? anchors[0][1] : (anchors[0][1] * value) / anchors[0][0];
  for (let i = 1; i < anchors.length; i++) {
    const [x, y] = anchors[i];
    const [previousX, previousY] = anchors[i - 1];
    if (value <= x) return previousY + ((y - previousY) * (value - previousX)) / (x - previousX);
  }
  return anchors[anchors.length - 1][1];
}
export function estimateCosts(input: Pick<Inputs, 'mode' | 'kwp' | 'battery'>, level: PriceLevel) {
  const factor = priceLevels[level];
  const quote =
    input.mode === 'balcony'
      ? 300 + input.kwp * 250
      : interpolate(input.kwp, [
          [3, 7500],
          [5, 10450],
          [7, 12740],
          [10, 14100],
          [12, 15480],
          [15, 18300],
          [20, 20200],
          [30, 30300],
        ]);
  const batteryQuote =
    input.mode === 'balcony'
      ? input.battery * 450
      : interpolate(input.battery, [
          [0, 0],
          [2, 1200],
          [3, 1700],
          [5, 2550],
          [7, 3360],
          [9, 3690],
          [11, 4290],
          [14, 5040],
          [20, 7200],
          [40, 14400],
        ]);
  // The split is a transparent modelling assumption. Materials and basic electrical service remain when roof labour is removed.
  return {
    equipment: round(quote * 0.6 * factor),
    installation: round(quote * 0.12 * factor),
    electrics: round(quote * 0.1 * factor),
    roofMount: round(quote * 0.18 * factor),
    batteryCost: round(batteryQuote * factor),
  };
}
export const workItems = [
  {
    key: 'roofMount',
    label: 'Montageservice / Dach-Arbeitslohn',
    hint: 'Abwählen, wenn diese Arbeiten bereits bezahlt sind oder fachlich abgestimmte Eigenleistung den Arbeitslohn ersetzt. Halterung und Material bleiben enthalten.',
    bucket: 'installation',
  },
  {
    key: 'scaffold',
    label: 'Zusätzliches Gerüst oder Hubbühne',
    hint: 'Nur ergänzen, wenn im Angebot noch nicht enthalten oder nicht bereits vorhanden.',
    bucket: 'installation',
  },
  {
    key: 'surge',
    label: 'Überspannungsschutz ergänzen',
    hint: 'Nur zusätzlich nötige Nachrüstung. Der Fachbetrieb prüft, welcher Schutz erforderlich und bereits enthalten ist.',
    bucket: 'electrics',
  },
  {
    key: 'sls',
    label: 'Hauptleitungsschutz (SLS) ergänzen',
    hint: 'Selektiver Hauptleitungsschutz, kein pauschales Upgrade des gesamten Hausanschlusses.',
    bucket: 'electrics',
  },
  {
    key: 'circuit',
    label: 'Zusätzliche Leitung / Sicherungsabgang',
    hint: 'Zum Beispiel ein weiterer Leitungsweg oder eigener Stromkreis; vorhandene passende Leitungen nicht nochmals berechnen.',
    bucket: 'electrics',
  },
  {
    key: 'grounding',
    label: 'Erdung / Potentialausgleich ergänzen',
    hint: 'Budget für zusätzliche Arbeiten am Bestand; ersetzt keine Prüfung vor Ort.',
    bucket: 'electrics',
  },
] as const;
export type WorkKey = (typeof workItems)[number]['key'];
export function workPrice(key: WorkKey, input: Inputs, level: PriceLevel): number {
  if (key === 'roofMount') return estimateCosts(input, level).roofMount;
  const base: Record<Exclude<WorkKey, 'roofMount'>, number> = {
    scaffold: input.mode === 'balcony' ? 150 : 900,
    surge: 350,
    sls: 250,
    circuit: 500,
    grounding: 600,
  };
  return round(base[key] * priceLevels[level]);
}
export function cabinetPrice(cabinet: WorkOptions['cabinet'], level: PriceLevel): number {
  const base = { ready: 0, upgrade: 1100, new: 2800 };
  return round(base[cabinet] * priceLevels[level]);
}
export function resolveCosts(input: Inputs, work: WorkOptions, level: PriceLevel): Inputs {
  const resolved = {
    ...input,
    electrics:
      input.electrics +
      (work.cabinet === 'ready'
        ? 0
        : (work.overrides.cabinet ?? cabinetPrice(work.cabinet, level))),
  };
  for (const item of workItems) {
    const bundled = work.cabinet === 'new' && (item.key === 'surge' || item.key === 'sls');
    if (work[item.key] && !bundled)
      resolved[item.bucket] += work.overrides[item.key] ?? workPrice(item.key, input, level);
  }
  return resolved;
}
export function presetSetup(
  id: string,
  level: PriceLevel = 'orientation'
): { input: Inputs; work: WorkOptions } {
  const preset = presets.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown solar preset: ${id}`);
  const values = { ...defaults, ...preset.values };
  const balcony = values.mode === 'balcony';
  const estimate = estimateCosts(values, level);
  const input: Inputs = {
    ...values,
    equipment: estimate.equipment,
    installation: estimate.installation,
    electrics: estimate.electrics,
    batteryCost: estimate.batteryCost,
    batteryPower: balcony ? 0.8 : Math.min(5, Math.max(1.5, values.battery / 2)),
    running: balcony ? 10 : Math.round(60 + values.kwp * 6),
    inverterReplacement: balcony ? 150 : 1200,
    batteryReplacement: round(estimate.batteryCost * 0.75),
    batteryRunning: values.battery > 0 ? 15 : 0,
  };
  return { input, work: { ...defaultWork, ...preset.work, overrides: {} } };
}

/** Typical sizes around the chosen one; same power, efficiency and standby, prices per size. */
export function storageOptions(
  base: Inputs,
  automatic: boolean,
  level: PriceLevel
): StorageOption[] {
  const sizes = base.mode === 'balcony' ? [1, 2, 3, 4] : [3, 5, 7.5, 10, 15];
  const perKwh = base.battery > 0 ? base.batteryCost / base.battery : 0;
  const replaceShare = base.batteryCost ? base.batteryReplacement / base.batteryCost : 0.75;
  return [...new Set([...sizes, base.battery])]
    .filter((size) => size > 0)
    .sort((a, b) => a - b)
    .map((battery) => {
      if (battery === base.battery)
        return {
          battery,
          batteryCost: base.batteryCost,
          batteryReplacement: base.batteryReplacement,
        };
      const batteryCost =
        automatic || !perKwh
          ? estimateCosts({ ...base, battery }, level).batteryCost
          : Math.round(perKwh * battery);
      return { battery, batteryCost, batteryReplacement: Math.round(batteryCost * replaceShare) };
    });
}
