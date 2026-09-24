/**
 * All number and time formatting goes through here.
 *
 * prompt.md pillar 7: everything stays human-readable — percentages and at most four
 * digits, never scientific notation. German locale, via Intl.
 */

const LOCALE = 'de-DE';

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const twoDecimals = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const signedTwoDecimals = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
});

export function formatInteger(value: number): string {
  return integer.format(value);
}

export function formatPercent(value: number): string {
  return `${integer.format(value)} %`;
}

export function formatMetres(value: number): string {
  return `${oneDecimal.format(value)} m`;
}

export function formatMultiplier(value: number): string {
  return `×${oneDecimal.format(value)}`;
}

export function formatEntropy(value: number): string {
  return oneDecimal.format(value);
}

/** A per-second rate with an explicit sign, e.g. "+0,60 /s" or "−1,20 /s". */
export function formatRate(value: number): string {
  return `${signedTwoDecimals.format(value)} /s`;
}

export function formatAmount(value: number): string {
  return twoDecimals.format(value);
}

/** Run time as hh:mm:ss. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  return [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':');
}
