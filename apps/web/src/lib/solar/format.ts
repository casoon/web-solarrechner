/** German number formats used across the calculator. */
export const currency = (n: number) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** Amount with an explicit sign, "+1.200 €" or "−300 €", for balances that can go either way. */
export const signedCurrency = (n: number) =>
  `${Math.round(n) > 0 ? '+' : Math.round(n) < 0 ? '−' : ''}${currency(Math.abs(n))}`;

export const number = (n: number, decimals = 0) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: decimals });

/** Rate of return such as the internal rate, "5,3 %" or "−1,2 %"; null when it has no value. */
export const rate = (n: number | null) =>
  n === null ? 'nicht bestimmbar' : `${n < 0 ? '−' : ''}${number(Math.abs(n), 1)}\u00a0%`;

/** Signed yearly change, for example "+2 %", "−1,5 %" or "±0 %". */
export const percent = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${number(Math.abs(n), 1)} %`;
