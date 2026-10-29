import type { Energy, Inputs } from './model';

export const policyChecked = '2026-10-29';
export const policySource = 'https://dserver.bundestag.de/btd/21/078/2107867.pdf';
export type PolicyProfile = 'draft' | 'current' | 'zero' | 'manual';
export interface PolicySettings {
  profile: PolicyProfile;
  directMode: 'after' | 'immediate';
  marketPrice: number;
  solarMarketValue: number;
  marketingFee: number;
  marketingCost: number;
  technologyYear: number;
  technologyCost: number;
  meterAnnual: number;
  controlAnnual: number;
  automaticLimit: boolean;
}
/** Editable budgets and market-price sensitivities, not supplier quotes or regulated prices. */
export const policyDefaults: PolicySettings = {
  profile: 'draft',
  directMode: 'after',
  marketPrice: 0.04,
  solarMarketValue: 0.04,
  marketingFee: 0.005,
  marketingCost: 120,
  technologyYear: 1,
  technologyCost: 250,
  meterAnnual: 50,
  controlAnnual: 50,
  automaticLimit: true,
};
const monthStart = (index: number) => Date.UTC(Math.floor(index / 12), index % 12, 1);
const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
function anniversary(commission: string, offset: number) {
  const [year, month, day] = commission.split('-').map(Number);
  const last = new Date(Date.UTC(year + offset, month, 0)).getUTCDate();
  return Date.UTC(year + offset, month - 1, Math.min(day, last));
}
export function continuedRate(kwp: number, commission: string) {
  const periods = Math.max(0, Math.floor((monthIndex(commission) - (2026 * 12 + 7)) / 6));
  const step = (rate: number) => Math.round(rate * 0.99 ** periods * 10000) / 10000;
  return (
    (Math.min(kwp, 10) * step(0.077) +
      Math.max(0, Math.min(kwp - 10, 30)) * step(0.0666) +
      Math.max(0, kwp - 40) * step(0.0544)) /
    kwp
  );
}
export function transitionRate(commission: string) {
  const periods = Math.max(0, Math.floor((monthIndex(commission) - (2027 * 12 + 7)) / 6) + 1);
  const value = Math.round(6.2 * 0.99 ** periods * 100) / 100;
  return { transition: Math.max(0, (value - 1) / 100), premium: value / 100 };
}
export function transitionEligible(kwp: number, commission: string) {
  const year = Number(commission.slice(0, 4));
  return (
    (year === 2027 && kwp < 50) ||
    (year === 2028 && kwp < 25) ||
    (year >= 2029 && year <= 2030 && kwp < 7)
  );
}
export function validatePolicy(settings: PolicySettings, commission: string): string | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(commission) ||
    !Number.isFinite(Date.parse(commission)) ||
    iso(Date.parse(commission)) !== commission ||
    commission < '2026-08-01' ||
    commission > '2030-12-31'
  )
    return 'Bitte eine gültige Inbetriebnahme zwischen 01.08.2026 und 31.12.2030 wählen.';
  if (
    Object.values(settings).some(
      (v) => v === undefined || (typeof v === 'number' && (!Number.isFinite(v) || v < 0))
    )
  )
    return 'Bitte die Markt- und Technikbudgets vollständig und nichtnegativ eingeben.';
  if (
    !Number.isInteger(settings.technologyYear) ||
    settings.technologyYear < 1 ||
    settings.technologyYear > 26
  )
    return 'Mess-/Steuertechnik bitte ab Betriebsjahr 1 bis 26 annehmen (26 = außerhalb des Zeitraums).';
  return null;
}
function policyName(profile: PolicyProfile, balcony: boolean, published: boolean) {
  if (balcony) return 'Steckersolar ohne Einspeiseerlös';
  if (profile === 'draft') return 'EEG-2027-Entwurf (nicht beschlossen)';
  if (profile === 'zero') return 'Nullerlös-Szenario';
  if (profile === 'manual') return 'Eigener Vergütungssatz';
  return published ? 'Veröffentlichte Regeln 2026' : 'Bisheriges EEG fortgeschrieben (Annahme)';
}
function initialRate(profile: PolicyProfile, balcony: boolean, input: Inputs, commission: string) {
  if (balcony || profile === 'zero') return 0;
  if (profile === 'manual') return input.tariff;
  if (profile === 'draft') return transitionRate(commission).transition;
  return continuedRate(input.kwp, commission);
}
function needsTechnology(input: Inputs, draft: boolean, market: boolean) {
  if (input.mode === 'balcony') return false;
  return draft ? input.kwp > 2 || market : input.kwp > 7;
}
export function createPolicy(input: Inputs, commission: string, settings: PolicySettings) {
  const effective =
    settings.profile === 'draft' && commission < '2027-01-01' ? 'current' : settings.profile;
  const draft = (effective === 'draft' || effective === 'zero') && commission >= '2027-01-01';
  const balcony = input.mode === 'balcony';
  const published = effective === 'current' && commission <= '2026-12-31';
  const transitionEnd = monthStart(monthIndex(commission) + 37);
  const eligible = draft && transitionEligible(input.kwp, commission);
  const market = effective === 'draft' && !balcony;
  const rates = transitionRate(commission);
  const technologyNeeded = needsTechnology(input, draft, market);
  const supportEnd = Date.UTC(Number(commission.slice(0, 4)) + 21, 0, 1);
  const technologyDate = anniversary(commission, settings.technologyYear - 1);
  const plannedMarketStart =
    eligible && settings.directMode === 'after' ? transitionEnd : Date.parse(commission);
  const marketStart = market ? Math.max(plannedMarketStart, technologyDate) : plannedMarketStart;
  const negativeFrom = Date.UTC(new Date(technologyDate).getUTCFullYear() + 1, 0, 1);
  const name = policyName(effective, balcony, published);
  return {
    ...settings,
    effective,
    commission,
    checked: policyChecked,
    source: policySource,
    name,
    published,
    draft,
    balcony,
    market,
    eligible,
    rate: initialRate(effective, balcony, input, commission),
    premium: rates.premium,
    transitionEnd: iso(transitionEnd),
    marketStart: iso(marketStart),
    bonusEnd: iso(monthStart(monthIndex(iso(marketStart)) + 49)),
    bonusRate: input.kwp < 25 ? 0.015 : 0,
    supportEnd: iso(supportEnd),
    technologyNeeded,
    technologyDate: iso(technologyDate),
    negativeFrom: iso(negativeFrom),
    setupCost: technologyNeeded && settings.technologyYear === 1 ? settings.technologyCost : 0,
    limitation:
      'Szenariomodell: Monatsmittel, gleichmäßige Verteilung innerhalb eines Monats; negative Preise als frei gewählter Erlösanteil. Keine Viertelstundenabrechnung, keine automatische Förderverlängerung nach § 51a, kein MiSpeL-Netzladen oder V2G.',
  };
}
export type PolicyPlan = ReturnType<typeof createPolicy>;
export function policyExportLimit(plan: PolicyPlan, input: Inputs, year: number) {
  if (!plan.automaticLimit || plan.balcony) return input.exportLimit;
  if (plan.draft) return 50;
  return year >= plan.technologyYear ? 100 : 60;
}
/** One operating year's calendar-month shares. Repeated weather months remain energy-conserving. */
function calendarShares(commission: string, year: number) {
  const start = anniversary(commission, year - 1),
    end = anniversary(commission, year);
  const shares: { month: number; date: string; share: number }[] = [];
  for (let index = monthIndex(iso(start)); monthStart(index) < end; index++) {
    const a = monthStart(index),
      b = monthStart(index + 1);
    const left = Math.max(a, start),
      right = Math.min(b, end);
    shares.push({ month: index % 12, date: iso(left), share: (right - left) / (b - a) });
  }
  return shares.map((part) => ({
    ...part,
    share:
      part.share /
      shares.filter((p) => p.month === part.month).reduce((sum, p) => sum + p.share, 0),
  }));
}
function directTerms(plan: PolicyPlan, input: Inputs, date: string, paid: number) {
  const bonus = input.kwp < 25 && date < plan.bonusEnd ? plan.bonusRate : 0;
  // For >=25 kW use a simplified annual market-value premium, not a guaranteed sales price.
  const premium =
    input.kwp >= 25 && date < plan.supportEnd
      ? Math.max(0, plan.premium - plan.solarMarketValue)
      : 0;
  return {
    phase: 'Direktmarkt',
    rate: (plan.marketPrice + premium) * paid,
    bonus: bonus * paid,
    fee: plan.marketingFee,
    market: true,
  };
}
/** Rates by date, with market-price and negative-price assumptions kept explicit. */
export function exportTerms(plan: PolicyPlan, input: Inputs, date: string) {
  if (plan.balcony || plan.effective === 'zero')
    return { phase: 'Ohne Erlös', rate: 0, bonus: 0, fee: 0, market: false };
  const negative =
    input.kwp >= 2 && (date >= plan.negativeFrom || (plan.market && date >= plan.marketStart));
  const paid = 1 - (negative ? input.negativeShare / 100 : 0);
  if (plan.market && date >= plan.marketStart) return directTerms(plan, input, date, paid);
  const supported = plan.market
    ? date < plan.transitionEnd && plan.eligible
    : date < plan.supportEnd;
  let phase = 'Ohne Fördererlös';
  if (plan.market) phase = 'Unentgeltlich bis Direktmarkt';
  if (supported) phase = plan.market ? 'Übergangszahlung' : 'Fester Satz';
  return {
    phase,
    rate: supported ? plan.rate * paid : 0,
    bonus: 0,
    fee: 0,
    market: false,
  };
}
export function policyYear(plan: PolicyPlan, input: Inputs, energy: Energy, year: number) {
  let exportRevenue = 0,
    bonusRevenue = 0,
    marketingCost = 0;
  const phases = new Set<string>();
  for (const part of calendarShares(plan.commission, year)) {
    const terms = exportTerms(plan, input, part.date);
    const exported = energy.monthly[part.month].export * part.share;
    exportRevenue += exported * terms.rate;
    bonusRevenue += exported * terms.bonus;
    marketingCost +=
      exported * terms.fee + (terms.market ? (plan.marketingCost / 12) * part.share : 0);
    phases.add(terms.phase);
  }
  const technologyCost =
    plan.technologyNeeded && year >= plan.technologyYear
      ? plan.meterAnnual + plan.controlAnnual
      : 0;
  const technologyInvestment =
    plan.technologyNeeded && year === plan.technologyYear && year > 1 ? plan.technologyCost : 0;
  return {
    exportRevenue,
    bonusRevenue,
    marketingCost,
    technologyCost,
    technologyInvestment,
    phase: [...phases].join(' / '),
    exportLimit: policyExportLimit(plan, input, year),
  };
}
