import {
  addDays,
  addMonths,
  compareDates,
  daysBetween,
  dueDateFromTerms,
  isISODate,
  localDate,
  yearOf,
} from '../dates';

describe('dates', () => {
  it('validates ISO dates including impossible days', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('26-1-1')).toBe(false);
  });

  it('adds days across months, years and DST', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('adds months and clamps to month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-01-15', -2)).toBe('2025-11-15');
    expect(() => addMonths('2026-02-30', 1)).toThrow(RangeError);
  });

  it('counts days and compares', () => {
    expect(daysBetween('2026-09-01', '2026-09-26')).toBe(25);
    expect(daysBetween('2026-09-26', '2026-09-01')).toBe(-25);
    expect(compareDates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareDates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareDates('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('reads the year and rejects garbage', () => {
    expect(yearOf('2026-09-26')).toBe(2026);
    expect(() => yearOf('nope')).toThrow(RangeError);
  });

  it('computes due dates from terms', () => {
    expect(dueDateFromTerms('2026-09-26', 0)).toBe('2026-09-26');
    expect(dueDateFromTerms('2026-09-26', 30)).toBe('2026-10-26');
    expect(() => dueDateFromTerms('2026-09-26', -1)).toThrow(RangeError);
    expect(() => dueDateFromTerms('2026-09-26', 1.5)).toThrow(RangeError);
  });

  it('formats local dates', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(isISODate(localDate())).toBe(true);
  });
});
