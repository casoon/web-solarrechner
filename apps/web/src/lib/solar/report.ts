import type { Document, Element } from '@casoon/lightweight-pdf';
import { energyColors } from './energy-display';
import { type calculate, type Inputs, peakProfiles, type SolarProfile } from './model';
import type { PolicyPlan } from './policy';
import { cabinetPrice, type PriceLevel, type WorkOptions, workItems, workPrice } from './presets';

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
}
const num = (n: number, digits = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: digits });
const eur = (n: number) => `${num(n)} EUR`;
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
          'Eigenversorgung',
          percent(Math.max(0, e.load - e.grid), e.load),
          'netto, aus Stundenbilanz',
          colors.storage
        ),
        tile(
          'Amortisation',
          current.payback ? `Jahr ${current.payback}` : 'offen',
          current.payback ? 'Projektsaldo danach positiv' : `nicht in ${i.years} Jahren`,
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

/** Builds a document from the exact applied calculation, independent of later UI changes. */
export function reportDocument(s: ReportSnapshot): Document {
  const i = s.input;
  const policy = s.result.policy;
  const pages = policy ? 7 : 6;
  const r = s.result;
  const current = s.selectedBattery && i.battery > 0 ? r.with : r.without;
  const page = (title: string, index: number): Element[] => [
    { type: 'page_break' },
    {
      type: 'row',
      children: [
        { ...text('CASOON / SOLARRECHNER', 8, true, colors.muted), common: { flex: 1 } } as Element,
        text(`${index} / ${pages}`, 8, true, colors.muted),
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
    ['Nettovorteil im ersten Jahr', (v) => `${eur(v.benefit)} / Jahr`],
    [
      'Dauerhaft positiver Projektsaldo',
      (v) => (v.payback ? `ab Jahr ${v.payback}` : `nicht in ${i.years} Jahren`),
    ],
    ['Kapitalwert (ohne Finanzierung)', (v) => eur(v.npv)],
    [
      'Interner Zinsfuß (Rendite)',
      (v) => (v.irr === null ? 'nicht bestimmbar' : `${num(v.irr, 1)} %`),
    ],
    [`Projektsaldo nach ${i.years} Jahren`, (v) => eur(v.balance)],
    [
      'Eigenversorgung, netto',
      (v) => `${num(Math.max(0, ((v.energy.load - v.energy.grid) / v.energy.load) * 100), 1)} %`,
    ],
    ['Monatliche Kreditrate', (v) => eur(v.rate)],
    ['Restschuld am Ende', (v) => eur(v.debt)],
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
    ['Zusätzliche Mess-/Steuertechnik (Start)', eur(policy?.setupCost ?? 0)],
    ['Speicheraufpreis (Vergleich)', eur(i.batteryCost)],
  ];
  const rows = (keys: [keyof Inputs, string, string?][]) =>
    keys.map(([key, label, unit]) => [
      label,
      typeof i[key] === 'number'
        ? `${num(i[key] as number, 4)}${unit ? ` ${unit}` : ''}`
        : String(i[key]),
    ]);
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
      ...page('Ergebnis im Vergleich', 2),
      text(`Ausgangsvorlage (danach anpassbar): ${s.preset}`),
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
      ...page('Energiebilanz im ersten Jahr', 3),
      text(
        'Monatswerte aus stündlichem Abgleich, in kWh. PV vor Leistungsbegrenzung; Bedarf inklusive Speicher-Standby.'
      ),
      gap(),
      table(
        ['Monat', 'PV', 'Bedarf', 'Direkt', 'Akku', 'Netz', 'Export', 'Abregel.'],
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
          ['PV-Potenzial vor Begrenzung', num(current.energy.pv)],
          ['Bedarf inklusive Standby', num(current.energy.load + current.energy.standby)],
          ['Netzbezug', num(current.energy.grid)],
          ['Einspeisung', num(current.energy.export)],
          ['Speicherverluste', num(current.energy.losses)],
          ['Speicher-Standby', num(current.energy.standby)],
          ['Nicht im Ladefenster ladbare Auto-Energie', num(current.energy.unmetCar)],
        ]
      ),
      gap(),
      text(
        'Sommerüberschüsse gleichen Winterdefizite nicht aus. Eigenversorgung ist netto nach Netzbezug berechnet. Rundungsdifferenzen sind möglich. Beide Autos verwenden dasselbe Fahr- und Ladeprofil.'
      ),
      ...page('Wirtschaftlichkeit über die Laufzeit', 4),
      text(
        `Gewählte Ergebnisansicht. Strompreisänderung ${num(i.priceChange, 1)} %/Jahr; Diskontsatz ${num(i.discount, 1)} %. Projektsaldo ohne Finanzierung, Eigenkapitalsaldo nach Kreditflüssen.`
      ),
      gap(),
      table(
        ['Jahr', 'Cashflow EUR', 'Projektsaldo EUR', 'Eigenkapital EUR', 'Restschuld EUR'],
        current.cashflows.map((v) => [
          String(v.year),
          num(v.cash),
          num(v.balance),
          num(v.equity),
          num(v.debt),
        ])
      ),
      gap(),
      text(
        `Eigenkapitalsaldo nach Abzug der Restschuld am Ende: ${eur(current.equityBalance)}. Amortisation bedeutet rechnerische Kostendeckung; ein Kredit kann dann noch laufen. Ersatzgeräte und laufende Kosten sind nach den Annahmen berücksichtigt. Kein Restwert. Erlösphasen gemäß gewähltem Regelszenario; keine automatische Förderverlängerung wegen negativer Preise.`,
        9
      ),
      ...page('Annahmen: Anlage und Verbrauch', 5),
      text(
        `Tatsächlich verwendetes Ertragsprofil: ${s.profile.location}; ${s.profile.lat} / ${s.profile.lon}; ${s.profile.angle}° Neigung; Azimut ${s.profile.aspect}° (0° = Süd).${secondSurface(s)}`
      ),
      ...(s.stale
        ? [
            text(
              'Hinweis: Geänderte Standort-/Dachwerte wurden noch nicht übernommen. Dieser Bericht verwendet das zuletzt geladene Profil.',
              10,
              true
            ),
          ]
        : []),
      gap(),
      table(
        ['Annahme', 'Wert'],
        [
          ...rows([
            ['kwp', 'Modulleistung', 'kWp'],
            ['ac', 'AC-Wechselrichterleistung', 'kW'],
            ['shade', 'Ertragsabschlag Schatten', '%'],
            ['weather', 'Sonnenjahr gegenüber Mittel', '%'],
            ['exportLimit', 'Exportlimit (Dachanlage)', '%'],
            ['household', 'Haushalt ohne Auto / Wärmepumpe', 'kWh/Jahr'],
            ['baseWatts', 'Enthaltene Grundlast', 'W'],
          ]),
          [
            'Haushaltsprofil',
            { evening: 'Morgens / abends', day: 'Auch tagsüber', flat: 'Gleichmäßig' }[i.pattern],
          ],
          ['Lastspitzen', peakProfiles[i.peaks].label],
          ...rows([
            ['cars', 'Elektroautos'],
            ['km', 'Fahrleistung je Auto', 'km/Jahr'],
            ['carUse', 'Fahrverbrauch je Auto', 'kWh/100 km'],
            ['homeCharge', 'Zu Hause geladen', '%'],
            ['chargeLoss', 'Ladeverluste', '%'],
            ['chargePower', 'Gemeinsame Ladeleistung', 'kW'],
          ]),
          [
            'Laden zu Hause',
            i.chargeTime === 'day' ? 'PV-Überschuss 9-17 Uhr, Rest ab 17 Uhr' : '18-24 Uhr',
          ],
          ['Wärmepumpe', i.heat ? 'einbezogen' : 'nicht einbezogen'],
          ...rows([
            ['heatDemand', 'Nutzwärme inkl. Warmwasser', 'kWh/Jahr'],
            ['jaz', 'Jahresarbeitszahl'],
            ['battery', 'Nutzbarer Speicher', 'kWh'],
            ['batteryPower', 'Speicherleistung', 'kW'],
            ['efficiency', 'Gesamtwirkungsgrad Speicher', '%'],
            ['standby', 'Speicher-Standby', 'W'],
            ['degradation', 'PV-Alterung pro Jahr', '%'],
            ['batteryDegradation', 'Speicheralterung pro Jahr', '%'],
          ]),
        ]
      ),
      gap(),
      text(
        'Bei deaktiviertem Auto / Wärmepumpe bleiben deren Startwerte dokumentiert, werden aber nicht als Verbrauch angesetzt. Speicherwerte gelten für die Vergleichsvariante mit Speicher. Vereinfachte AC-Kopplung, ein Zähler, bis zu zwei Dachflächen an einem Wechselrichter; keine Dachplanung.'
      ),
      ...page('Annahmen, Quellen und Grenzen', 6),
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
            ['negativeShare', 'Unvergüteter Export (Dachanlage)', '%'],
            ['years', 'Betrachtungszeitraum', 'Jahre'],
            ['discount', 'Diskontsatz', '%'],
            ['running', 'Laufende Kosten ohne Speicher', 'EUR/Jahr'],
            ['prosumerFee', 'Höherer Netz-Grundpreis (Annahme)', 'EUR/Jahr'],
            ['batteryRunning', 'Zusätzliche Speicherkosten', 'EUR/Jahr'],
            ['inverterReplacement', 'Wechselrichterersatz', 'EUR'],
            ['inverterYear', 'Wechselrichterersatz im Jahr'],
            ['batteryReplacement', 'Speicherersatz', 'EUR'],
            ['batteryYear', 'Speicherersatz spätestens im Jahr'],
            ['batteryCycles', 'Vollzyklen bis zum Speicherersatz'],
            ['loanPercent', 'Kreditfinanzierter Anteil', '%'],
            ['interest', 'Sollzins', '%/Jahr'],
            ['loanYears', 'Kreditlaufzeit', 'Jahre'],
            ['fees', 'Einmalige Kreditgebühren', 'EUR'],
          ]),
        ]
      ),
      gap(),
      text(`PVGIS: ${s.profile.period}. Abruf: ${s.profile.retrieved}. ${s.profile.source}`, 9),
      text(
        'Eigene synthetische Lastprofile. Preisorientierung: Verbraucherzentrale NRW, Angebotsauswertung Stand 28.08.2026; keine aktuellen Marktmittel. Kostenaufteilung, Preisstufen und Zusatzbudgets sind eigene veränderbare Schätzungen. GeoNames-Ortsdaten: CC BY 4.0.',
        9
      ),
      gap(5),
      {
        ...text('Methodik und verlinkte Originalquellen: solarrechner.casoon.de/de/about/', 9),
        url: 'https://solarrechner.casoon.de/de/about/',
      } as Element,
      gap(5),
      text(
        'Demo mit Chartlet, Open Grid, Astro, Svelte und Lightweight PDF. Der PDF-Export entsteht lokal im Browser. Vor einer Investition Angebote, Gebäudeeignung und Anschlussbedingungen prüfen. Modell: solar-demo-3.',
        9
      ),
      ...(policy
        ? [...page('Regelszenario und Erlösphasen', 7), ...policyDetails(policy, current, i)]
        : []),
    ],
  };
}

function policyDetails(
  policy: PolicyPlan,
  current: ReturnType<typeof calculate>['with'],
  i: Inputs
): Element[] {
  return [
    text(`${policy.name} | Prüfstand ${policy.checked}`, 11, true),
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
    text(
      '2027-Regeln sind ein nicht beschlossener Entwurf. Übergangszahlung endet am Ende des 36. Folgemonats, Bonus am Ende des 48. Folgemonats der ersten Direktvermarktung. Bei späterer Technik kann nach dem Übergang eine unbezahlte Phase entstehen. Ab 25 kW ist die Marktprämie über einen angenommenen jährlichen Marktwert vereinfacht; keine garantierte Verkaufspreisuntergrenze.',
      9
    ),
    gap(),
    text(policy.limitation, 9),
    gap(),
    text(
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
