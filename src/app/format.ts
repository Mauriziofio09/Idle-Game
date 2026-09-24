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
const resource = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
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

/**
 * A resource figure as the player reads it: whole when it is whole, one decimal
 * otherwise. Pillar 7 — small, human numbers, never four decimals of noise.
 */
export function formatResource(value: number): string {
  return resource.format(value);
}

/** A span of seconds as an interval, e.g. "25 s". Not the run clock, which is hh:mm:ss. */
export function formatSeconds(value: number): string {
  return `${resource.format(value)} s`;
}

/** A per-second consumption or output, e.g. "1,2 /s". */
export function formatPerSecond(value: number): string {
  return `${resource.format(value)} /s`;
}

/** Run time as hh:mm:ss. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  return [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':');
}

/** Timestamp for a log line: mm:ss while a run is short, hh:mm:ss once it is long. */
export function formatLogTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, '0');
  if (whole < 3600) {
    return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
  }
  return formatDuration(whole);
}
