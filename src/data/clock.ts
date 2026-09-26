import { localDate, type ISODate } from '@/domain/dates';

/** Injected time source so repositories are deterministic in tests. */
export type Clock = { now(): number; today(): ISODate };

export const systemClock: Clock = {
  now: () => Date.now(),
  today: () => localDate(),
};
