/** German number formats used across the calculator. */
export const currency = (n: number) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const number = (n: number, decimals = 0) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: decimals });

/** Rate of return such as the internal rate, "5,3 %" or "−1,2 %"; null when it has no value. */
export const rate = (n: number | null) =>
  n === null ? 'nicht bestimmbar' : `${n < 0 ? '−' : ''}${number(Math.abs(n), 1)}\u00a0%`;

/** Signed yearly change, for example "+2 %", "−1,5 %" or "±0 %". */
export const percent = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${number(Math.abs(n), 1)} %`;
