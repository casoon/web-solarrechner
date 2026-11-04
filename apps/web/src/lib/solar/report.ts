import type { Document, Element } from '@casoon/lightweight-pdf';
import { energyColors } from './energy-display';
import {
  type calculate,
  comparisonBuffer,
  type Inputs,
  leasedCar,
  peakProfiles,
  type SolarProfile,
  storageGrades,
  surplusCharging,
  wallboxLabels,
} from './model';
import type { PolicyPlan } from './policy';
import { cabinetPrice, type PriceLevel, type WorkOptions, workItems, workPrice } from './presets';
import {
  billBreakdown,
  breakEvenRows,
  carRows,
  carSolarShare,
  monthlyBurden,
  priceScenarios,
} from './result-display';

export interface ReportSnapshot {
  input: Inputs;
  base: Inputs;
  work: WorkOptions;
  priceLevel: PriceLevel;
  preset: string;
  profile: Omit<SolarProfile, 'hours'>;
  result: ReturnType<typeof calculate>;
  selectedBattery: boolean;
  commission: string;
  autoTariff: boolean;
  tariffBasis: string;
  stale: boolean;
  created: string;
  /** Second roof surface; `input.kwp` is then the total of both surfaces. */
  second?: { kwp: number; angle: number; aspect: number };
  /** Other system sizes in the selected view, when the calculator has computed them. */
  sizes?: { input: Inputs; result: Result }[];
  /** Charging habits without and with storage, when the household has cars. */
  charging?: { label: string; input: Inputs; without: Result; with: Result }[];
  /** The same system under other revenue rules in the selected view. */
  tariffs?: { name: string; selected: boolean; result: Result }[];
}
const num = (n: number, digits = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: digits });
const eur = (n: number) => `${num(n)} EUR`;
const signedEur = (n: number) => `${Math.round(n) > 0 ? '+' : ''}${eur(n)}`;
function secondSurface({ second, input }: ReportSnapshot) {
  if (!second) return '';
  return ` Zweite Dachfläche: ${num(second.kwp, 1)} kWp, ${second.angle}° Neigung, Azimut ${second.aspect}°. Die Modulleistung ist die Summe beider Flächen: ${num(input.kwp - second.kwp, 1)} + ${num(second.kwp, 1)} kWp.`;
}
type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
/** Same series colours as the Chartlet diagrams in the calculator. */
const colors = {
  solar: rgb(energyColors.solar),
  solarLight: [229, 207, 168] as Rgb,
  storage: rgb(energyColors.storage),
  grid: rgb(energyColors.grid),
  neutral: rgb(energyColors.neutral),
  ink: [34, 31, 28] as Rgb,
  muted: [112, 106, 98] as Rgb,
  rule: [226, 221, 212] as Rgb,
  surface: [248, 246, 242] as Rgb,
  white: [255, 255, 255] as Rgb,
};
const text = (content: string, size = 10, bold = false, color?: Rgb): Element => ({
  type: 'text',
  content,
  style: { size, font: bold ? 'sans-bold' : 'sans-regular', line_height: 1.3, color },
});
/** Running text: more line height than labels and table cells, so paragraphs read loosely. */
const para = (content: string, size = 10, bold = false, color?: Rgb): Element => ({
  type: 'text',
  content,
  style: { size, font: bold ? 'sans-bold' : 'sans-regular', line_height: 1.5, color },
});
const gap = (size = 10): Element => ({ type: 'spacer', size });
const heading = (content: string): Element =>
  ({
    ...text(content, 17, true),
    common: { keep_with_next: true },
  }) as Element;
const table = (headers: string[], rows: string[][]): Element => ({
  type: 'table',
  cell_padding: 5,
  columns: headers.map((_, i) => ({
    width: { flex: i === 0 ? 1.7 : 1 },
    align: i === 0 ? 'start' : 'end',
  })),
  header: headers.map((v) => ({ element: text(v, 9, true), background: colors.rule })),
  rows: rows.map((row) => row.map((v) => ({ element: text(v, 9) }))),
  striped: colors.surface,
});

// Chartlet-like charts drawn from vector rectangles; the PDF renderer has no SVG input.
const bar = (height: number, color: Rgb, common: Record<string, unknown> = {}): Element[] =>
  height > 0.05 ? [{ type: 'rect', common: { height, background: color, ...common } }] : [];
const space = (size: number): Element[] => (size > 0.05 ? [gap(size)] : []);
const label = (content: string) => text(content, 8, true, colors.muted);
/** Segments stack from the bottom; `max` maps to `height`. */
const stack = (segments: [number, Rgb][], max: number, height: number): Element => {
  const total = segments.reduce((sum, [v]) => sum + Math.max(0, v), 0);
  return {
    type: 'column',
    common: { flex: 1 },
    children: [
      ...space(height - (total / max) * height),
      ...[...segments]
        .reverse()
        .flatMap(([v, color]) => bar((Math.max(0, v) / max) * height, color)),
    ],
  };
};
/** 100 % bar: flex widths keep the proportions without measuring. */
const shareBar = (segments: [number, Rgb][]): Element => ({
  type: 'row',
  children: segments
    .filter(([v]) => v > 0.5)
    .map(([v, color]) => ({ type: 'rect', common: { flex: v, height: 12, background: color } })),
});
const legend = (items: [string, Rgb][]): Element => ({
  type: 'row',
  gap: 12,
  children: items.map(([content, color]) => ({
    type: 'row',
    gap: 4,
    children: [
      { type: 'column', children: [gap(2), ...bar(7, color, { width: 7 })] },
      text(content, 8, false, colors.muted),
    ],
  })),
});
const tile = (title: string, value: string, note: string, color: Rgb): Element => ({
  type: 'column',
  gap: 3,
  common: { flex: 1, padding: 9, background: colors.surface, corner_radius: 4 },
  children: [
    ...bar(3, color, { width: 22 }),
    gap(2),
    text(title, 8, true, colors.muted),
    text(value, 16, true, colors.ink),
    text(note, 8, false, colors.muted),
  ],
});
const percent = (part: number, whole: number) => `${num(whole > 0 ? (part / whole) * 100 : 0)} %`;
const autarky = (e: Result['energy']) => percent(Math.max(0, e.load - e.grid), e.load);
/** Share of the solar yield used in the house: the usual "Eigenverbrauchsquote". */
const solarUse = (e: Result['energy']) => percent(e.direct + e.charge, e.pv);

type Result = ReturnType<typeof calculate>['with'];

/** Page 1: headline figures and Chartlet-style charts of the selected view. */
function summary(s: ReportSnapshot, current: Result, pages: number): Element[] {
  const i = s.input;
  const r = s.result;
  const e = current.energy;
  const demand = e.direct + e.battery + e.grid;
  const withBattery = s.selectedBattery && i.battery > 0;
  const view = withBattery ? `mit ${num(i.battery, 1)} kWh Speicher` : 'ohne Speicher';
  const section = (title: string, note?: string): Element[] => [
    gap(16),
    {
      type: 'row',
      common: { keep_with_next: true },
      children: [
        { ...text(title, 11, true, colors.ink), common: { flex: 1 } } as Element,
        ...(note ? [text(note, 8, false, colors.muted)] : []),
      ],
    },
    gap(6),
  ];

  const monthMax = Math.max(
    1,
    ...e.monthly.map((m) => Math.max(m.pv, m.direct + m.battery + m.grid))
  );
  const monthHeight = 104;
  const months: Element = {
    type: 'row',
    gap: 7,
    children: e.monthly.map((m) => ({
      type: 'column',
      gap: 3,
      common: { flex: 1 },
      children: [
        {
          type: 'row',
          gap: 1.5,
          children: [
            stack([[m.pv, colors.solarLight]], monthMax, monthHeight),
            stack(
              [
                [m.direct, colors.solar],
                [m.battery, colors.storage],
                [m.grid, colors.grid],
              ],
              monthMax,
              monthHeight
            ),
          ],
        },
        {
          ...text(m.month, 7, false, colors.muted),
          style: { size: 7, align: 'center', color: colors.muted },
        } as Element,
      ],
    })),
  };

  const balances = current.cashflows.map((c) => c.balance);
  const top = Math.max(0, ...balances);
  const bottom = Math.max(0, ...balances.map((v) => -v));
  const saldoHeight = 70;
  const scale = saldoHeight / Math.max(1, top + bottom);
  const saldo: Element = {
    type: 'row',
    gap: 2,
    children: current.cashflows.map((c) => ({
      type: 'column',
      common: { flex: 1 },
      children: [
        ...space((top - Math.max(0, c.balance)) * scale),
        ...bar(Math.max(0, c.balance) * scale, colors.storage),
        ...bar(0.6, colors.ink),
        ...bar(Math.max(0, -c.balance) * scale, colors.neutral),
        ...space((bottom - Math.max(0, -c.balance)) * scale),
        gap(3),
        {
          type: 'text',
          content: c.year % 5 === 0 ? String(c.year) : ' ',
          style: { size: 7, align: 'center', color: colors.muted },
        },
      ],
    })),
  };

  const compare = (title: string, a: number, b: number, format: (v: number) => string) => {
    const max = Math.max(1, a, b);
    const line = (name: string, v: number, color: Rgb): Element => ({
      type: 'row',
      gap: 6,
      children: [
        { ...text(name, 8, false, colors.muted), common: { width: 70 } } as Element,
        {
          type: 'row',
          gap: 6,
          common: { flex: 1 },
          children: [
            ...(v > 0
              ? [
                  {
                    type: 'rect',
                    common: { flex: v / max, height: 9, background: color },
                  } as Element,
                ]
              : []),
            ...(v < max
              ? [{ type: 'rect', common: { flex: 1 - Math.max(0, v) / max, height: 9 } } as Element]
              : []),
          ],
        },
        {
          ...text(format(v), 8, true, colors.ink),
          common: { width: 72 },
          style: { size: 8, font: 'sans-bold', align: 'end', color: colors.ink },
        } as Element,
      ],
    });
    return {
      type: 'column',
      gap: 4,
      common: { flex: 1 },
      children: [
        label(title),
        line('Ohne Speicher', a, colors.neutral),
        line(`Mit ${num(i.battery, 1)} kWh`, b, colors.storage),
      ],
    } as Element;
  };

  return [
    {
      type: 'column',
      gap: 4,
      common: { padding: 16, background: colors.ink, corner_radius: 6 },
      children: [
        {
          type: 'row',
          children: [
            {
              ...text('CASOON / SOLARRECHNER', 8, true, colors.solarLight),
              common: { flex: 1 },
            } as Element,
            text(`1 / ${pages}`, 8, true, colors.solarLight),
          ],
        },
        gap(4),
        text('Dein Solarvergleich', 22, true, colors.white),
        text(
          `${s.profile.location} · ${num(i.kwp, 1)} kWp · ${i.mode === 'roof' ? 'Dachanlage' : 'Balkonkraftwerk'} · Ergebnisansicht ${view}`,
          10,
          false,
          colors.white
        ),
        text(`Erstellt ${s.created} · solarrechner.casoon.de`, 8, false, colors.solarLight),
      ],
    },
    gap(14),
    {
      type: 'row',
      gap: 8,
      children: [
        tile('Investition', eur(current.investment), view, colors.neutral),
        tile('Nettovorteil', eur(current.benefit), 'im ersten Jahr', colors.solar),
        tile(
          'Autarkiegrad',
          autarky(e),
          `Verbrauch gedeckt · ${solarUse(e)} des Solarstroms selbst genutzt`,
          colors.storage
        ),
        tile(
          'Amortisation',
          current.payback ? `Jahr ${current.payback}` : 'offen',
          i.loanPercent > 0
            ? `ohne Kredit · mit Kredit ${current.equityPayback ? `ab Jahr ${current.equityPayback}` : 'offen'}, Saldo nach ${i.years} Jahren ${signedEur(current.equityBalance)}`
            : current.payback
              ? 'Projektsaldo danach positiv'
              : `nicht in ${i.years} Jahren`,
          colors.grid
        ),
      ],
    },
    ...section('Strom im Jahresverlauf', 'kWh pro Monat'),
    months,
    gap(8),
    legend([
      ['Solarerzeugung', colors.solarLight],
      ['Bedarf: direkt solar', colors.solar],
      ...(withBattery ? [['aus dem Speicher', colors.storage] as [string, Rgb]] : []),
      ['aus dem Netz', colors.grid],
    ]),
    ...section('Jahresbilanz', `${num(e.pv)} kWh Solar · ${num(demand)} kWh Bedarf`),
    {
      type: 'row',
      gap: 16,
      children: [
        {
          type: 'column',
          gap: 5,
          common: { flex: 1 },
          children: [
            label('Woher der Strom kommt'),
            shareBar([
              [e.direct, colors.solar],
              [e.battery, colors.storage],
              [e.grid, colors.grid],
            ]),
            text(
              `Direkt ${percent(e.direct, demand)} · Speicher ${percent(e.battery, demand)} · Netz ${percent(e.grid, demand)}`,
              8,
              false,
              colors.muted
            ),
          ],
        },
        {
          type: 'column',
          gap: 5,
          common: { flex: 1 },
          children: [
            label('Wohin der Solarstrom geht'),
            shareBar([
              [e.direct, colors.solar],
              [e.charge, colors.storage],
              [e.export, colors.grid],
              [e.curtailed, colors.neutral],
            ]),
            text(
              `Direkt ${percent(e.direct, e.pv)} · Speicher ${percent(e.charge, e.pv)} · Einspeisung ${percent(e.export, e.pv)} · begrenzt ${percent(e.curtailed, e.pv)}`,
              8,
              false,
              colors.muted
            ),
          ],
        },
      ],
    },
    ...section(
      `Projektsaldo über ${i.years} Jahre`,
      `Start ${eur(balances[0])} · Ende ${eur(current.balance)} · ohne Finanzierung`
    ),
    saldo,
    ...(i.battery > 0
      ? [
          ...section(
            'Speicher im Vergleich',
            `zusätzlich ${eur(r.extraBenefit)} / Jahr · ${eur(r.extraNpv)} Kapitalwert`
          ),
          {
            type: 'row',
            gap: 20,
            children: [
              compare('Investition', r.without.investment, r.with.investment, eur),
              compare(
                'Netzbezug im ersten Jahr',
                r.without.energy.grid,
                r.with.energy.grid,
                (v) => `${num(v)} kWh`
              ),
            ],
          } as Element,
        ]
      : []),
    gap(16),
    text(
      'Grobe Schätzung für den Einstieg, eigene Pläne und das Verständnis von Angeboten; kein Angebotsrechner und keine Ertragszusage. Alle Annahmen und Quellen folgen auf den nächsten Seiten.',
      8,
      false,
      colors.muted
    ),
  ];
}

type InputKey = [keyof Inputs, string, string?];
const inputRows = (i: Inputs, keys: InputKey[]) =>
  keys.map(([key, label, unit]) => [
    label,
    typeof i[key] === 'number'
      ? `${num(i[key] as number, 4)}${unit ? ` ${unit}` : ''}`
      : String(i[key]),
  ]);
/** Rows of the system and consumption assumptions; switched-off appliances show no values. */
function systemRows(i: Inputs): string[][] {
  const rows = (keys: InputKey[]) => inputRows(i, keys);
  const cars: InputKey[] = [
    ['km', 'Fahrleistung je Auto', 'km/Jahr'],
    ['carUse', 'Fahrverbrauch je Auto', 'kWh/100 km'],
    ['homeCharge', 'Zu Hause geladen', '%'],
    ['chargeLoss', 'Ladeverluste', '%'],
    ['chargePower', 'Gemeinsame Ladeleistung', 'kW'],
    ...(i.chargeTime === 'day'
      ? ([
          ['carDaysHome', 'Tage pro Woche mit Auto tagsüber zu Hause'],
          ['carBuffer', 'Puffer im Autoakku', 'kWh'],
        ] as InputKey[])
      : []),
  ];
  return [
    ...rows([
      ['kwp', 'Modulleistung', 'kWp'],
      ['ac', 'AC-Wechselrichterleistung', 'kW'],
      ['shade', 'Ertragsabschlag Schatten', '%'],
      ['weather', 'Sonnenjahr gegenüber Mittel', '%'],
      ['household', 'Haushalt ohne Auto / Wärmepumpe', 'kWh/Jahr'],
    ]),
    ...(i.mode === 'roof'
      ? [
          [
            'Einspeisegrenze (Anteil der Modulleistung)',
            `${num(i.exportLimit)} % = ${num((i.kwp * i.exportLimit) / 100, 1)} kW`,
          ],
        ]
      : []),
    [
      'Zusätzliche konstante Grundlast',
      i.baseWatts ? `${num(i.baseWatts)} W, im Haushalt enthalten` : 'keine, nur Tagesprofil',
    ],
    [
      'Haushaltsprofil',
      { evening: 'Morgens / abends', day: 'Auch tagsüber', flat: 'Gleichmäßig' }[i.pattern],
    ],
    ['Lastspitzen', peakProfiles[i.peaks].label],
    ['Elektroautos', i.cars ? num(i.cars) : 'keine'],
    ...(i.cars > 0
      ? [
          ...rows(cars).map((row) =>
            row[0] === 'Gemeinsame Ladeleistung' && i.chargeTime === 'day'
              ? [row[0], `${row[1]} · Wallbox ${wallboxLabels[i.wallbox].toLowerCase()}`]
              : row
          ),
          [
            'Laden zu Hause',
            `${i.chargeTime === 'day' ? 'PV-Überschuss 9-17 Uhr, Rest ab 17 Uhr' : '18-24 Uhr'}${
              i.battery > 0
                ? `; Speicher lädt ${i.storageChargesCar ? 'auch' : 'nicht'} ins Auto`
                : ''
            }`,
          ],
        ]
      : []),
    ['Wärmepumpe', i.heat ? 'einbezogen' : 'keine'],
    ...(i.heat
      ? rows([
          ['heatDemand', 'Nutzwärme inkl. Warmwasser', 'kWh/Jahr'],
          ['jaz', 'Jahresarbeitszahl'],
        ])
      : []),
    [
      'Speicherqualität, Wirkungsgrad, Standby',
      `${storageGrades[i.batteryGrade].label} · ${num(i.efficiency)} % · ${num(i.standby)} W`,
    ],
    ...rows([
      ['battery', 'Nutzbarer Speicher', 'kWh'],
      ['batteryPower', 'Speicherleistung', 'kW'],
      ['degradation', 'PV-Alterung pro Jahr', '%'],
      ['batteryDegradation', 'Speicheralterung pro Jahr', '%'],
    ]),
  ];
}

/** Yearly cash flows; credit columns only when part of the investment is financed. */
const rateText = (v: number | null) => (v === null ? 'nicht bestimmbar' : `${num(v, 1)} %`);
const paybackText = (year: number | null, years: number) =>
  year ? `ab Jahr ${year}` : `nicht in ${years} Jahren`;
/** What the calculator shows below the summary: the electricity bill, price scenarios and the loan. */
function costsPage(s: ReportSnapshot, current: Result, page: (title: string) => Element[]) {
  const i = s.input;
  const withBattery = current === s.result.with;
  const bill = billBreakdown(current, i, withBattery);
  const loan = i.loanPercent > 0;
  return [
    ...page('Stromkosten und Finanzierung'),
    text(
      `Ohne Anlage zahlst du im ersten Betriebsjahr ${eur(bill.without)} für Strom, mit Anlage ${eur(bill.with)}${bill.with < bill.without ? `, also ${eur(bill.without - bill.with)} weniger` : ''}. Arbeitspreis ${num(i.price * 100, 1)} ct/kWh, Grundpreis ${eur(i.basePrice)} im Jahr; er fällt in beiden Fällen an. Ohne Anschaffung, Kredit und Ersatzgeräte.`
    ),
    gap(),
    table(
      ['Stromkosten im ersten Jahr', 'EUR'],
      [
        ['Ohne Anlage: Strom aus dem Netz und Grundpreis', eur(bill.without)],
        ...bill.steps.map((step) => [step.label, signedEur(step.value)]),
        ['Mit Anlage', eur(bill.with)],
      ]
    ),
    ...(loan
      ? [
          gap(12),
          heading('Deine Finanzierung'),
          gap(5),
          table(
            ['Kredit', 'Wert'],
            [
              [
                'Darlehen',
                `${eur(current.principal)} über ${num(i.loanYears)} Jahre zu ${num(i.interest, 1)} %`,
              ],
              ['Monatliche Kreditrate', eur(current.rate)],
              [
                'Vorteil im ersten Jahr nach zwölf Raten',
                signedEur(current.benefit - current.rate * 12),
              ],
              ['Aus eigener Tasche zu Beginn', eur(current.ownFunds)],
              ['Kreditkosten (Zinsen und Gebühren, ganze Laufzeit)', eur(current.loanCost)],
              [`Saldo mit Kredit nach ${i.years} Jahren`, signedEur(current.equityBalance)],
              [
                'Positiver Saldo mit Kredit (ohne Kredit)',
                `${paybackText(current.equityPayback, i.years)} (${paybackText(current.payback, i.years)})`,
              ],
              [
                `Mehr als ${num(i.discount, 1)} % Geldanlage mit Kredit (ohne)`,
                `${signedEur(current.equityNpv)} (${signedEur(current.npv)})`,
              ],
              [
                'Verzinsung der Anlage / Kreditzins',
                `${rateText(current.irr)} / ${num(i.interest, 1)} %`,
              ],
            ]
          ),
          gap(5),
          text(
            current.irr !== null && current.irr >= i.interest
              ? 'Die Anlage verzinst sich besser, als der Kredit kostet: Der Kredit lohnt sich unter diesen Annahmen.'
              : 'Die Anlage verzinst sich schlechter, als der Kredit kostet: Der Kredit frisst einen Teil des Ertrags. Mit eigenem Geld stünde die Rechnung besser da.',
            9,
            true
          ),
        ]
      : []),
  ];
}
/** How much the result hangs on the electricity price and on the revenue for fed-in power. */
function sensitivityPage(s: ReportSnapshot, current: Result, page: (title: string) => Element[]) {
  const i = s.input;
  return [
    ...page('Strompreis und Vergütung'),
    heading('Wenn sich der Strompreis ändert'),
    text(
      'Gleiche Anlage und Energiebilanz, nur der Wert des selbst genutzten Stroms ändert sich.',
      9
    ),
    gap(5),
    table(
      ['Strompreis pro Jahr', 'Kapitalwert', 'Positiver Saldo, ohne Kredit'],
      priceScenarios(current.cashflows, i).map((v) => [
        `${v.label}${v.change === i.priceChange ? ' (deine Annahme)' : ''}`,
        signedEur(v.npv),
        paybackText(v.payback, i.years),
      ])
    ),
    gap(8),
    table(
      ['Ab wann rechnet es sich?', 'Strompreis heute', 'Preissteigerung pro Jahr'],
      breakEvenRows(current.cashflows, i).map((v) => [v.label, v.price, v.change])
    ),
    gap(4),
    para(
      `Strompreis heute bei ${num(i.priceChange, 1)} % Steigerung pro Jahr, oder Steigerung pro Jahr bei ${num(i.price * 100, 1)} ct/kWh, sonst gleiche Annahmen. Das sagt nichts darüber, wie wahrscheinlich ein solcher Preis ist; Studien zur künftigen Strompreisentwicklung sind uneinig.`,
      9
    ),
    ...(s.tariffs && s.tariffs.length > 1
      ? [
          gap(12),
          heading('Wenn sich die Einspeisevergütung ändert'),
          text(
            'Gleiche Anlage und Energiebilanz, nur die Regeln für eingespeisten Strom wechseln. Ob für 2027 null, die Übergangszahlung des Entwurfs oder die Fortschreibung gilt, ist offen.',
            9
          ),
          gap(5),
          table(
            ['Regel', 'Erlös 1. Jahr', 'Vorteil 1. Jahr', 'Kapitalwert', 'Positiver Saldo'],
            s.tariffs.map((t) => [
              `${t.name}${t.selected ? ' (gewählt)' : ''}`,
              eur(t.result.firstYear.exportRevenue + t.result.firstYear.bonusRevenue),
              eur(t.result.benefit),
              signedEur(t.result.npv),
              paybackText(t.result.payback, i.years),
            ])
          ),
        ]
      : []),
  ];
}
/** With a loan: the monthly money flow over the whole period, as in the calculator. */
function burdenPage(s: ReportSnapshot, current: Result, page: (title: string) => Element[]) {
  const i = s.input;
  if (i.loanPercent <= 0) return [];
  return [
    ...page('Monatliche Belastung mit Kredit'),
    text(
      `EUR im Monat, Jahr für Jahr mit ${num(i.priceChange, 1)} % Strompreisänderung pro Jahr und ${eur(i.basePrice)} Grundpreis im Jahr. Strom und Betrieb mit Anlage: Netzstrom, Grundpreis und laufende Kosten abzüglich Einspeiseerlös; in Jahren mit Ersatzgeräten steigt der Wert, im letzten Jahr zählt ein Restwert mit. Unterschied: Plus heißt, mit Anlage und Kredit zahlst du weniger als ohne Anlage.${current.ownFunds > 0 ? ` Zusätzlich zahlst du zu Beginn ${eur(current.ownFunds)} aus eigener Tasche; die Tabelle zeigt nur die laufenden Beträge. Ob sich die ganze Investition lohnt, zeigen Kapitalwert (${signedEur(current.npv)}) und Verzinsung (${rateText(current.irr)}), nicht die Monatsbeträge.` : ''}`
    ),
    gap(),
    table(
      [
        'Jahr',
        'Strom ohne Anlage',
        'Strom und Betrieb mit Anlage',
        'Kreditrate',
        'Mit Anlage und Kredit',
        'Unterschied',
      ],
      monthlyBurden(current, i).map((row) => [
        String(row.year),
        num(row.without),
        num(row.power),
        num(row.rate),
        num(row.total),
        `${Math.round(row.difference) > 0 ? '+' : ''}${num(row.difference)}`,
      ])
    ),
  ];
}
const residual = (v: Result) => v.cashflows.at(-1)?.residual ?? 0;
function financeSection(i: Inputs, current: Result): Element[] {
  const loan = i.loanPercent > 0;
  return [
    text(
      `Gewählte Ergebnisansicht, in EUR. Strompreisänderung ${num(i.priceChange, 1)} %/Jahr. Überschuss im Jahr: Ersparnis und Erlöse abzüglich laufender Kosten, Ersatzgeräten und Technik. Saldo ohne Kredit: alle Überschüsse aufsummiert ab der Investition.${loan ? ' Saldo mit Kredit: was nach Kreditraten aus eigener Tasche bleibt, aufsummiert.' : ''}`
    ),
    gap(),
    table(
      [
        'Jahr',
        'Überschuss im Jahr',
        'davon Ersatzgeräte',
        'Saldo ohne Kredit',
        ...(loan ? ['Saldo mit Kredit', 'Restschuld'] : []),
      ],
      current.cashflows.map((v) => [
        String(v.year),
        num(v.cash),
        v.replacement ? `-${num(v.replacement)}` : '',
        num(v.balance),
        ...(loan ? [num(v.equity), num(v.debt)] : []),
      ])
    ),
    gap(),
    text(
      `${loan ? `Kaufpreis ${eur(current.investment)}; Rate, Kreditkosten und der Vergleich mit und ohne Kredit stehen auf der Seite „Stromkosten und Finanzierung“. ` : 'Amortisation bedeutet rechnerische Kostendeckung. '}${i.batteryReplace ? '' : 'Der Speicher wird am Lebensende nicht ersetzt; danach läuft die Anlage ohne Speicher. '}Kein Restwert der Anlage nach ${i.years} Jahren${residual(current) > 0 ? `; nur der zuletzt gekaufte Ersatzspeicher zählt im letzten Jahr mit ${eur(residual(current))} Restwert` : ''}. Erlösphasen gemäß gewähltem Regelszenario; keine automatische Förderverlängerung wegen negativer Preise.`,
      9
    ),
  ];
}

/** Builds a document from the exact applied calculation, independent of later UI changes. */
export function reportDocument(s: ReportSnapshot): Document {
  const i = s.input;
  const policy = s.result.policy;
  const pages = (policy ? 11 : 10) + (i.loanPercent > 0 ? 1 : 0) + (i.cars > 0 ? 1 : 0);
  const r = s.result;
  const current = s.selectedBattery && i.battery > 0 ? r.with : r.without;
  let index = 1;
  const page = (title: string): Element[] => [
    { type: 'page_break' },
    {
      type: 'row',
      children: [
        { ...text('CASOON / SOLARRECHNER', 8, true, colors.muted), common: { flex: 1 } } as Element,
        text(`${++index} / ${pages}`, 8, true, colors.muted),
      ],
    },
    gap(4),
    { type: 'line', thickness: 0.5, color: colors.rule },
    gap(),
    heading(title),
    gap(),
  ];
  const comparison: [string, (v: typeof current) => string][] = [
    ['Vollständige Investition', (v) => eur(v.investment)],
    [
      `Stromkosten im ersten Jahr (ohne Anlage ${eur(billBreakdown(r.without, i, false).without)})`,
      (v) => eur(billBreakdown(v, i, v === r.with).with),
    ],
    ['Nettovorteil im ersten Jahr', (v) => `${eur(v.benefit)} / Jahr`],
    [
      'Dauerhaft positiver Projektsaldo',
      (v) => (v.payback ? `ab Jahr ${v.payback}` : `nicht in ${i.years} Jahren`),
    ],
    [
      `Mehr als ${num(i.discount, 1)} % Geldanlage${i.loanPercent > 0 ? ', ohne Kredit' : ' (Kapitalwert)'}`,
      (v) => signedEur(v.npv),
    ],
    [
      'Verzinsung des Geldes (Rendite)',
      (v) => (v.irr === null ? 'nicht bestimmbar' : `${num(v.irr, 1)} %`),
    ],
    [`Projektsaldo nach ${i.years} Jahren`, (v) => eur(v.balance)],
    ['Autarkiegrad (Verbrauch gedeckt)', (v) => autarky(v.energy)],
    ['Eigenverbrauchsquote (Solarstrom selbst genutzt)', (v) => solarUse(v.energy)],
    ...(i.loanPercent > 0
      ? ([
          ['Monatliche Kreditrate', (v) => eur(v.rate)],
          [`Saldo mit Kredit nach ${i.years} Jahren`, (v) => signedEur(v.equityBalance)],
        ] as [string, (v: typeof current) => string][])
      : []),
  ];
  const costRows = [
    ['Module / Wechselrichter', eur(s.base.equipment)],
    ['Montagematerial (Basis)', eur(s.base.installation)],
    ['Elektroanschluss / Prüfung (Basis)', eur(s.base.electrics)],
    ['Weitere Kosten', eur(s.base.extras)],
    ...workItems.map((w) => [
      w.label,
      s.work.cabinet === 'new' && (w.key === 'surge' || w.key === 'sls')
        ? 'im neuen Schrank enthalten'
        : s.work[w.key]
          ? eur(s.work.overrides[w.key] ?? workPrice(w.key, i, s.priceLevel))
          : 'nicht angesetzt',
    ]),
    [
      'Zählerschrank',
      s.work.cabinet === 'ready'
        ? 'vorhanden / 0 EUR'
        : eur(s.work.overrides.cabinet ?? cabinetPrice(s.work.cabinet, s.priceLevel)),
    ],
    ...(surplusCharging(i)
      ? [['Aufpreis Solar-Überschussladen (Wallbox)', eur(i.wallboxCost)]]
      : []),
    ['Zusätzliche Mess-/Steuertechnik (Start)', eur(policy?.setupCost ?? 0)],
    ['Speicheraufpreis (Vergleich)', eur(i.batteryCost)],
  ];
  const rows = (keys: InputKey[]) => inputRows(i, keys);
  return {
    page_format: 'A4',
    lang: 'de-DE',
    margin: { top: 32, bottom: 32, left: 36, right: 36 },
    metadata: {
      title: 'Solarrechner - Szenario und Ergebnis',
      author: 'CASOON',
      creator: 'Lightweight PDF 0.3.1',
      subject: 'Solarvergleich / solar-demo-3',
    },
    children: [
      ...summary(s, current, pages),
      ...page('Ergebnis im Vergleich'),
      text(
        `Startpunkt war die Vorlage „${s.preset}“. Gerechnet wird mit den Werten auf den Annahmen-Seiten.`
      ),
      gap(),
      table(
        ['Ergebnis', 'Ohne Speicher', `Mit ${num(i.battery, 1)} kWh`],
        comparison.map(([label, value]) => [label, value(r.without), value(r.with)])
      ),
      gap(),
      text(
        `Speicher zusätzlich: ${eur(r.extraBenefit)} Nettovorteil im ersten Jahr; ${eur(r.extraNpv)} Kapitalwert über ${i.years} Jahre.`,
        11,
        true
      ),
      gap(),
      heading('Kosten und gewählte Arbeiten'),
      gap(5),
      table(['Position', 'Budget'], costRows),
      gap(),
      text(
        'Grobe Schätzung für den Einstieg, eigene Pläne und das Verständnis von Angeboten; kein Angebotsrechner. Sonne, Wetter und Verbrauch schwanken. Keine Genauigkeit auf den Cent oder die Kilowattstunde und keine Ertragszusage.',
        9
      ),
      ...costsPage(s, current, page),
      ...sensitivityPage(s, current, page),
      ...burdenPage(s, current, page),
      ...variantsPage(s, page),
      ...carPage(s, current, page),
      ...page('Energiebilanz im ersten Jahr'),
      para(
        'Monatswerte in kWh aus der Stundenbilanz. Solar: Ertrag vor Begrenzung. Verbrauch: inklusive Speicher-Standby, gedeckt durch direkt genutzten Solarstrom, Abgabe aus dem Speicher und Netzbezug. Eingespeist: ins Netz abgegebener Überschuss. Abgeregelt: wegen Wechselrichter- oder Einspeisegrenze verloren.'
      ),
      gap(),
      table(
        [
          'Monat',
          'Solar',
          'Verbrauch',
          'Direkt genutzt',
          'Aus Speicher',
          'Netzbezug',
          'Eingespeist',
          'Abgeregelt',
        ],
        current.energy.monthly.map((m) => [
          m.month,
          ...[
            m.pv,
            m.direct + m.battery + m.grid,
            m.direct,
            m.battery,
            m.grid,
            m.export,
            m.curtailed,
          ].map((v) => num(v)),
        ])
      ),
      gap(16),
      table(
        ['Jahresbilanz', 'kWh'],
        [
          ['Solarertrag vor Begrenzung', num(current.energy.pv)],
          ['Verbrauch inklusive Standby', num(current.energy.load + current.energy.standby)],
          ['Netzbezug', num(current.energy.grid)],
          ['Einspeisung', num(current.energy.export)],
          ['Speicherverluste', num(current.energy.losses)],
          ['Speicher-Standby', num(current.energy.standby)],
          ...(i.cars > 0
            ? [['Auto-Energie, die im Ladefenster nicht ladbar war', num(current.energy.unmetCar)]]
            : []),
        ]
      ),
      gap(),
      para(
        `Gerechnet wird Stunde für Stunde: Eingespeister Sommerstrom gleicht Netzbezug im Winter nicht aus. Rundungsdifferenzen sind möglich.${i.cars === 2 ? ' Beide Autos verwenden dasselbe Fahr- und Ladeprofil.' : ''}`
      ),
      ...page('Wirtschaftlichkeit über die Laufzeit'),
      ...financeSection(i, current),
      ...page('Annahmen: Anlage und Verbrauch'),
      para(
        `Tatsächlich verwendetes Ertragsprofil: ${s.profile.location}; ${s.profile.lat} / ${s.profile.lon}; ${s.profile.angle}° Neigung; Azimut ${s.profile.aspect}° (0° = Süd).${secondSurface(s)}`
      ),
      ...(s.stale
        ? [
            para(
              'Hinweis: Geänderte Standort-/Dachwerte wurden noch nicht übernommen. Dieser Bericht verwendet das zuletzt geladene Profil.',
              10,
              true
            ),
          ]
        : []),
      gap(),
      table(['Annahme', 'Wert'], systemRows(i)),
      gap(),
      para(
        'Speicherwerte gelten für die Vergleichsvariante mit Speicher. Vereinfachte AC-Kopplung, ein Zähler, bis zu zwei Dachflächen an einem Wechselrichter; keine Dachplanung. Die Einspeisegrenze gilt bis zum Einbau der Steuertechnik oder dauerhaft, je nach Regelszenario; darüber wird abgeregelt.'
      ),
      ...page('Annahmen, Quellen und Grenzen'),
      table(
        ['Kosten / Finanzierung', 'Wert'],
        [
          [
            'Preisniveau',
            { low: 'Günstig', orientation: 'Orientierung', high: 'Aufwendig' }[s.priceLevel],
          ],
          ['Inbetriebnahme', s.commission],
          ['Tarifgrundlage', s.autoTariff ? s.tariffBasis : 'Eigene Annahme'],
          ...rows([
            ['price', 'Strom-Arbeitspreis', 'EUR/kWh'],
            ['basePrice', 'Grundpreis (mit und ohne Anlage)', 'EUR/Jahr'],
            ['priceChange', 'Strompreisänderung pro Jahr', '%'],
            ...(!policy
              ? [
                  ['tariff', 'Einspeisetarif (Dachanlage)', 'EUR/kWh'] as [
                    keyof Inputs,
                    string,
                    string,
                  ],
                ]
              : []),
            ['negativeShare', 'Einspeisung ohne Vergütung (negative Preise)', '%'],
            ['years', 'Betrachtungszeitraum', 'Jahre'],
            ['discount', 'Diskontsatz', '%'],
            ['running', 'Laufende Kosten ohne Speicher', 'EUR/Jahr'],
            ['prosumerFee', 'Höherer Netz-Grundpreis (Annahme)', 'EUR/Jahr'],
            ['batteryRunning', 'Zusätzliche Speicherkosten', 'EUR/Jahr'],
            ['inverterReplacement', 'Wechselrichterersatz', 'EUR'],
            ['inverterYear', 'Wechselrichterersatz im Jahr'],
            ['batteryReplacement', 'Speicherersatz', 'EUR'],
            ['batteryYear', 'Erster Speicherersatz im Jahr'],
            ['batteryCycles', 'Vollzyklen bis zum Speicherersatz'],
            ['loanPercent', 'Kreditfinanzierter Anteil', '%'],
            ['interest', 'Sollzins', '%/Jahr'],
            ['loanYears', 'Kreditlaufzeit', 'Jahre'],
            ['fees', 'Einmalige Kreditgebühren', 'EUR'],
          ]),
        ]
      ),
      gap(),
      para(`PVGIS: ${s.profile.period}. Abruf: ${s.profile.retrieved}. ${s.profile.source}`, 9),
      gap(6),
      para(
        'Eigene synthetische Lastprofile. Preisorientierung: Verbraucherzentrale NRW, Angebotsauswertung Stand 28.08.2026; keine aktuellen Marktmittel. Kostenaufteilung, Preisstufen und Zusatzbudgets sind eigene veränderbare Schätzungen. GeoNames-Ortsdaten: CC BY 4.0.',
        9
      ),
      gap(5),
      {
        ...text('Methodik und verlinkte Originalquellen: solarrechner.casoon.de/de/about/', 9),
        url: 'https://solarrechner.casoon.de/de/about/',
      } as Element,
      gap(5),
      para(
        'Der PDF-Bericht entsteht lokal im Browser. Vor einer Investition Angebote, Gebäudeeignung und Anschlussbedingungen prüfen.',
        9
      ),
      ...(policy
        ? [...page('Regelszenario und Erlösphasen'), ...policyDetails(policy, current, i)]
        : []),
    ],
  };
}

const glossary: [string, string][] = [
  [
    'Stromkosten im ersten Jahr',
    'Was du noch für Strom zahlst: Netzstrom und Grundpreis plus Betrieb der Anlage, abzüglich Einspeiseerlös. Der Grundpreis fällt mit und ohne Anlage an.',
  ],
  [
    'Nettovorteil',
    'Gesparter Strom plus Einspeiseerlös, abzüglich laufender Kosten, in einem Jahr.',
  ],
  ['Autarkiegrad', 'Anteil deines Stromverbrauchs, den Anlage und Speicher selbst decken.'],
  [
    'Eigenverbrauchsquote',
    'Anteil des Solarstroms, der im Haus genutzt statt eingespeist wird. Angebote nennen oft diesen Wert.',
  ],
  [
    'Projektsaldo',
    'Investition und alle Überschüsse aufsummiert, ohne Kredit. Ab der Amortisation bleibt er positiv.',
  ],
  [
    'Kapitalwert',
    'Alle künftigen Überschüsse abgezinst auf heute, minus Investition. Über null: besser als eine Geldanlage zum Diskontsatz.',
  ],
  [
    'Interner Zinsfuß',
    'Die Rendite, mit der sich das eingesetzte Geld über den Zeitraum verzinst.',
  ],
  [
    'Einspeisegrenze',
    'Höchstens so viel Leistung darf ins Netz. Was darüber liegt und nicht genutzt wird, geht verloren (abgeregelt).',
  ],
];
/** Thought experiment: a leased second car that charges at home instead of the storage. */
function leaseIdea(s: ReportSnapshot): Element[] {
  const i = s.input;
  const always = s.charging?.at(-1)?.without;
  if (!always || i.battery <= 0) return [];
  const l = leasedCar(s.result.with, always, i);
  const perMonth = (v: number) => `${eur(v)} / Monat`;
  return [
    text('Idee: geleastes Zweitauto statt Speicher', 11, true),
    gap(6),
    para(
      `Statt ${num(i.battery, 1)} kWh Speicher ein zweites E-Auto leasen. Ihr fahrt abwechselnd, die Kilometer bleiben gleich, eines steht immer zu Hause und lädt mit Sonnenstrom. Der Speicher fällt ganz weg: kein Kaufpreis, kein Ersatz, keine laufenden Kosten.`,
      9
    ),
    gap(5),
    table(
      ['Gedankenspiel', 'Betrag'],
      [
        [
          'Weniger Investition (ohne Speicher, mit Wallbox)',
          `${eur(l.storageSaved)}${l.months >= 1 ? ` = ${num(l.months)} Raten` : ''}`,
        ],
        ['Vorteil im ersten Jahr gegenüber dem Speicher', perMonth(l.yearly)],
        [`Alles über ${i.years} Jahre als Monatsbetrag`, perMonth(l.monthly)],
        [
          `Zweites Auto: Leasing ${eur(i.leaseRate)} + Nebenkosten ${eur(i.leaseExtra)}`,
          perMonth(l.cost),
        ],
        ['Bleibt aus eigener Tasche', perMonth(l.remaining)],
      ]
    ),
    gap(8),
    para(
      'Nur ein Anstoß zum Weiterdenken. Das Auto nimmt Sonnenstrom nur für die eigenen Kilometer auf und gibt abends nichts ans Haus zurück. Nicht gerechnet: ein ersetzter Verbrenner und dessen Sprit.',
      9
    ),
    gap(14),
  ];
}
/** Other sizes and charging habits, then the leasing idea and a short glossary on their own page. */
/** The car's home charging by source and month; only with cars. */
function carPage(s: ReportSnapshot, current: Result, page: (title: string) => Element[]) {
  const i = s.input;
  if (i.cars <= 0) return [];
  const e = current.energy;
  return [
    ...page('Laden des Autos zu Hause'),
    para(
      `Wie viel der Heimladung aus Sonnenstrom, aus dem Speicher und aus dem Netz kommt, Monat für Monat in kWh. Im ersten Jahr kommen ${num(carSolarShare(e))} % aus Sonnenstrom (direkt und über den Speicher). Das Haus hat immer Vorrang, dann lädt das Auto, dann der Speicher.${i.battery > 0 && !i.storageChargesCar ? ' Der Speicher gibt nichts ins Auto ab.' : ''}`
    ),
    gap(),
    table(
      ['Monat', 'Ladung', 'Direkt aus Sonne', 'Aus Speicher', 'Aus Netz', 'Solaranteil'],
      carRows(e).map((r) => [
        r.Monat,
        num(r.Ladung_kWh),
        num(r.Direkt_aus_Sonne_kWh),
        num(r.Aus_Speicher_kWh),
        num(r.Aus_Netz_kWh),
        `${num(r.Solaranteil_Prozent)} %`,
      ])
    ),
    gap(),
    para(
      `Jahr: ${num(e.car.pv + e.car.battery + e.car.grid)} kWh Ladung, davon ${num(e.car.pv)} kWh direkt aus Sonne, ${num(e.car.battery)} kWh aus dem Speicher, ${num(e.car.grid)} kWh aus dem Netz. Ladung inklusive Ladeverlusten, wie sie am Zähler ankommt.`,
      9
    ),
  ];
}
function variantsPage(s: ReportSnapshot, page: (title: string) => Element[]): Element[] {
  const i = s.input;
  const view =
    s.selectedBattery && i.battery > 0
      ? `jeweils mit ${num(i.battery, 1)} kWh Speicher`
      : 'jeweils ohne Speicher';
  const best = s.sizes?.reduce<(typeof s.sizes)[number] | undefined>(
    (a, b) => (!a || b.result.npv > a.result.npv ? b : a),
    undefined
  );
  return [
    ...page('Größe und Laden im Vergleich'),
    ...(s.sizes?.length && best
      ? [
          text('Anlagengröße im Vergleich', 11, true),
          gap(5),
          table(
            [
              'Anlage',
              'Investition',
              'Autarkiegrad',
              'Selbst genutzt',
              'Stromkosten 1. Jahr',
              'Vorteil 1. Jahr',
              'Kapitalwert',
            ],
            s.sizes.map(({ input, result }) => [
              `${num(input.kwp, 1)} kWp${input.kwp === i.kwp ? ' (gewählt)' : ''}`,
              eur(result.investment),
              autarky(result.energy),
              solarUse(result.energy),
              eur(billBreakdown(result, input, s.selectedBattery && i.battery > 0).with),
              eur(result.benefit),
              eur(result.npv),
            ])
          ),
          gap(8),
          para(
            `Dieselbe Dachausrichtung, ${view}, Regeln je Größe. Den höchsten Kapitalwert hat ${num(best.input.kwp, 1)} kWp. Größere Anlagen nur, wenn das Dach Platz hat.`,
            9
          ),
          gap(14),
        ]
      : []),
    ...(s.charging?.length
      ? [
          text('Laden des Autos im Vergleich', 11, true),
          gap(5),
          table(
            [
              'Laden',
              'Speicher',
              'Netzbezug',
              'Autarkiegrad',
              'Stromkosten 1. Jahr',
              'Vorteil 1. Jahr',
              'Kapitalwert',
            ],
            s.charging.flatMap((c) =>
              [c.without, ...(i.battery > 0 ? [c.with] : [])].map((v, k) => [
                k === 0 ? c.label : '',
                k === 0 ? 'ohne' : `${num(i.battery, 1)} kWh`,
                `${num(v.energy.grid)} kWh`,
                autarky(v.energy),
                eur(billBreakdown(v, c.input, k > 0).with),
                eur(v.benefit),
                eur(v.npv),
              ])
            )
          ),
          gap(8),
          para(
            `Dieselben Autos und Kilometer. „Immer ein Auto zu Hause“: etwa Homeoffice oder zwei Autos im Wechsel; fehlende Ladung darf bis zu ${comparisonBuffer} kWh auf den nächsten sonnigen Tag warten. Beim Laden tagsüber enthält die Investition ${eur(i.wallboxCost)} für eine Wallbox mit Solarsteuerung. Kosten eines zweiten Autos sind nicht enthalten.`,
            9
          ),
          gap(14),
        ]
      : []),
    ...page(s.input.battery > 0 && s.charging?.length ? 'Gedankenspiel und Begriffe' : 'Begriffe'),
    ...leaseIdea(s),
    ...(s.input.battery > 0 && s.charging?.length ? [text('Begriffe', 11, true), gap(8)] : []),
    ...glossary.flatMap(([term, meaning]) => [
      { ...text(term, 10, true), common: { keep_with_next: true } } as Element,
      gap(2),
      para(meaning, 10),
      gap(12),
    ]),
  ];
}

function policyDetails(
  policy: PolicyPlan,
  current: ReturnType<typeof calculate>['with'],
  i: Inputs
): Element[] {
  const revenue = current.firstYear.exportRevenue + current.firstYear.bonusRevenue;
  return [
    para(
      revenue > 0
        ? `Kurz gesagt: Für eingespeisten Strom rechnet dieses Szenario im ersten Jahr mit ${eur(revenue)} Erlös, Anfangssatz ${num(policy.rate * 100, 2)} ct/kWh.`
        : 'Kurz gesagt: Für eingespeisten Strom bekommst du in diesem Szenario im ersten Jahr nichts. Jede Kilowattstunde lohnt sich dann nur, wenn du sie selbst nutzt.',
      11,
      true
    ),
    gap(),
    text(`${policy.name} | Prüfstand ${policy.checked}`, 10, true),
    gap(),
    table(
      ['Annahme / Regel', 'Wert'],
      [
        ['Inbetriebnahme', policy.commission],
        ['Anfangssatz (Übergang / Fest)', `${num(policy.rate * 100, 2)} ct/kWh`],
        [
          'Übergangsfrist endet vor',
          policy.market && policy.eligible ? policy.transitionEnd : 'keine Übergangsphase',
        ],
        ['Direktmarkt im Modell ab', policy.market ? policy.marketStart : 'nicht gewählt'],
        [
          'Bonus für sonstige Direktvermarktung',
          policy.market && policy.bonusRate > 0
            ? `${num(policy.bonusRate * 100, 2)} ct/kWh bis vor ${policy.bonusEnd}`
            : 'nicht angesetzt',
        ],
        ['Marktpreis in vergüteten Zeiten (Annahme)', `${num(policy.marketPrice * 100, 2)} ct/kWh`],
        ['Solar-Jahresmarktwert (Annahme)', `${num(policy.solarMarketValue * 100, 2)} ct/kWh`],
        [
          'Vermarktung variabel / fix (Annahmen)',
          `${num(policy.marketingFee * 100, 2)} ct/kWh / ${eur(policy.marketingCost)} pro Jahr`,
        ],
        ['Mess-/Steuertechnik ab Betriebsjahr', String(policy.technologyYear)],
        ['Zusätzlicher Einbau (Annahme)', eur(policy.technologyCost)],
        [
          'Zusätzlicher Mess-/Steuerbetrieb (Annahmen)',
          `${eur(policy.meterAnnual)} + ${eur(policy.controlAnnual)} pro Jahr`,
        ],
        [
          'Technikbudget in diesem Fall aktiv',
          policy.technologyNeeded ? 'ja, soweit nicht bereits enthalten' : 'nein',
        ],
        [
          'Exportlimit Jahr 1 / Automatik',
          `${current.firstYear.exportLimit} % / ${policy.automaticLimit ? 'Regelprofil' : 'eigene Vorgabe'}`,
        ],
        ['Negativpreis-Sensitivität', `${num(i.negativeShare)} % unbezahlter Export`],
        ['Bei festen Sätzen aktiv ab', policy.negativeFrom],
        [
          'Jahr 1: Erlös / Bonus',
          `${eur(current.firstYear.exportRevenue)} / ${eur(current.firstYear.bonusRevenue)}`,
        ],
        [
          'Jahr 1: Vermarktung / Technikbetrieb',
          `${eur(current.firstYear.marketingCost)} / ${eur(current.firstYear.technologyCost)}`,
        ],
      ]
    ),
    gap(),
    para(
      '2027-Regeln sind ein nicht beschlossener Entwurf. Übergangszahlung endet am Ende des 36. Folgemonats, Bonus am Ende des 48. Folgemonats der ersten Direktvermarktung. Bei späterer Technik kann nach dem Übergang eine unbezahlte Phase entstehen. Ab 25 kW ist die Marktprämie über einen angenommenen jährlichen Marktwert vereinfacht; keine garantierte Verkaufspreisuntergrenze.',
      9
    ),
    gap(),
    para(policy.limitation, 9),
    gap(),
    para(
      'Markt- und Kostenbudgets sind frei veränderbare Annahmen. Sie werden nur in passenden Phasen angesetzt. Bei Steckersolar und im Nullerlös-Szenario fallen keine Vermarktungsentgelte an. Zusätzliche Technik außerhalb des Betrachtungszeitraums wird nicht berechnet.',
      9
    ),
    gap(),
    {
      ...text('Primärquelle: Bundestagsdrucksache 21/7867 (Regierungsentwurf)', 9),
      url: policy.source,
    } as Element,
  ];
}

/** Lazy browser-only renderer; no household or financial values leave the browser. */
export async function renderReport(snapshot: ReportSnapshot): Promise<Uint8Array> {
  const url = `${window.location.origin}/vendor/lightweight-pdf/lightweight_pdf.js`;
  const api = (await import(
    /* @vite-ignore */ url
  )) as typeof import('@casoon/lightweight-pdf/pkg/lightweight_pdf.js');
  await api.default();
  const renderer = api.LightweightPdf.withDefaultFonts();
  try {
    return renderer.render(
      JSON.stringify({ schema_version: 1, document: reportDocument(snapshot) })
    );
  } finally {
    renderer.free();
  }
}
