import type { Energy } from './model';

export const energyColors = {
  solar: '#a76b15',
  storage: '#34745a',
  grid: '#466c9c',
  neutral: '#756e66',
};
export function energyTokens(colors: (keyof typeof energyColors)[]) {
  return Object.fromEntries(
    colors.map((color, index) => [`color-${index + 1}`, energyColors[color]])
  );
}

/** Every link spans one column, so no band can pass behind an unrelated node. */
export function energyFlow(e: Energy) {
  const delta = e.endSoc - e.startSoc;
  const storageLabel = delta < -0.5 ? 'Ladung + Anfangsbestand' : 'In den Speicher geladen';
  const links = [
    { from: 'Solarpotenzial', to: 'Direkt genutzt', value: e.direct },
    { from: 'Direkt genutzt', to: 'Bedarf inkl. Standby', value: e.direct },
    { from: 'Solarpotenzial', to: storageLabel, value: e.charge },
    { from: storageLabel, to: 'Bedarf inkl. Standby', value: e.battery },
    { from: storageLabel, to: 'Speicherverluste', value: e.losses },
    { from: 'Solarpotenzial', to: 'Überschuss', value: e.export },
    { from: 'Überschuss', to: 'Einspeisung ins Netz', value: e.export },
    { from: 'Solarpotenzial', to: 'Leistungsbegrenzung', value: e.curtailed },
    { from: 'Leistungsbegrenzung', to: 'Am Wechselrichter gekappt', value: e.clipped },
    { from: 'Leistungsbegrenzung', to: 'Über dem Exportlimit', value: e.curtailed - e.clipped },
    { from: 'Netzbezug', to: 'Aus dem Netz genutzt', value: e.grid },
    { from: 'Aus dem Netz genutzt', to: 'Bedarf inkl. Standby', value: e.grid },
    { from: 'Anfangsbestand entnommen', to: storageLabel, value: -delta },
    { from: storageLabel, to: 'Mehrbestand am Jahresende', value: delta },
  ]
    .map((link) => ({ ...link, value: Math.round(link.value) }))
    .filter((link) => link.value > 0);
  const used = new Set(links.flatMap((link) => [link.from, link.to]));
  const nodes = [
    { label: 'Solarpotenzial', column: 0, color: 1 },
    { label: 'Netzbezug', column: 0, color: 3 },
    { label: 'Anfangsbestand entnommen', column: 0, color: 2 },
    { label: 'Direkt genutzt', column: 1, color: 1 },
    { label: storageLabel, column: 1, color: 2 },
    { label: 'Aus dem Netz genutzt', column: 1, color: 3 },
    { label: 'Überschuss', column: 1, color: 1 },
    { label: 'Leistungsbegrenzung', column: 1, color: 4 },
    { label: 'Bedarf inkl. Standby', column: 2, color: 4 },
    { label: 'Speicherverluste', column: 2, color: 4 },
    { label: 'Mehrbestand am Jahresende', column: 2, color: 2 },
    { label: 'Einspeisung ins Netz', column: 2, color: 4 },
    { label: 'Am Wechselrichter gekappt', column: 2, color: 4 },
    { label: 'Über dem Exportlimit', column: 2, color: 4 },
  ].filter((node) => used.has(node.label));
  return {
    schemaVersion: 1,
    showTitle: false,
    type: 'sankey',
    title: 'Stromquellen, Wege und Ziele im ersten Jahr, in kWh',
    source: 'Stündliche Bilanz · Bedarf inklusive Speicher-Standby · Verluste separat',
    width: 1000,
    height: 600,
    tokens: energyTokens(['solar', 'storage', 'grid', 'neutral']),
    sankey: { nodes, links, order: 'listed' },
  };
}
