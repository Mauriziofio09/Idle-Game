import {
  formatDuration,
  formatLogTime,
  formatMultiplier,
  formatPerSecond,
  formatPercent,
  formatRate,
  formatResource,
} from './format';

/**
 * Pillar 7: everything the player reads stays small and human. German locale, so the
 * decimal separator is a comma and no figure ever arrives in scientific notation.
 */
describe('formatting', () => {
  it('writes run time as hh:mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration(61)).toBe('00:01:01');
    expect(formatDuration(3600)).toBe('01:00:00');
    expect(formatDuration(3661)).toBe('01:01:01');
    expect(formatDuration(-5)).toBe('00:00:00');
  });

  it('switches the log stamp from mm:ss to hh:mm:ss exactly at one hour', () => {
    expect(formatLogTime(0)).toBe('00:00');
    expect(formatLogTime(12)).toBe('00:12');
    expect(formatLogTime(2462)).toBe('41:02');
    expect(formatLogTime(3599)).toBe('59:59');
    // The boundary itself already belongs to the long form.
    expect(formatLogTime(3600)).toBe('01:00:00');
    expect(formatLogTime(3601)).toBe('01:00:01');
  });

  it('keeps resource figures whole when they are whole', () => {
    expect(formatResource(8)).toBe('8');
    expect(formatResource(10)).toBe('10');
    expect(formatResource(38.07)).toBe('38,1');
    expect(formatResource(0)).toBe('0');
  });

  it('writes rates with a unit and a sign', () => {
    expect(formatPerSecond(1.2)).toBe('1,2 /s');
    expect(formatPerSecond(0)).toBe('0 /s');
    expect(formatRate(0.6)).toBe('+0,60 /s');
    expect(formatRate(-1.2)).toBe('-1,20 /s');
  });

  it('rounds percentages to whole numbers', () => {
    expect(formatPercent(0)).toBe('0 %');
    expect(formatPercent(83.4)).toBe('83 %');
    expect(formatPercent(100)).toBe('100 %');
  });

  it('writes the decay multiplier the way prompt.md section 5.2 shows it', () => {
    expect(formatMultiplier(1)).toBe('×1,0');
    expect(formatMultiplier(1.6)).toBe('×1,6');
  });

  it('never falls back to scientific notation', () => {
    for (const value of [1e6, 1e-7, 123456.789]) {
      expect(formatResource(value)).not.toContain('E');
      expect(formatResource(value)).not.toContain('e');
    }
  });
});
