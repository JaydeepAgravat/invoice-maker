/**
 * Line item units. Keys are stable (stored in the database); labels are
 * translated in the UI and PDF. Users can also type a custom unit.
 */

export type UnitSystem = 'METRIC' | 'IMPERIAL';

export type UnitDef = {
  key: string;
  group:
    | 'COUNT'
    | 'TIME'
    | 'LENGTH'
    | 'AREA'
    | 'VOLUME'
    | 'WEIGHT'
    | 'DISTANCE';
  /** Undefined means the unit fits both systems. */
  system?: UnitSystem;
};

export const UNITS: readonly UnitDef[] = [
  { key: 'item', group: 'COUNT' },
  { key: 'unit', group: 'COUNT' },
  { key: 'pc', group: 'COUNT' },
  { key: 'project', group: 'COUNT' },
  { key: 'hr', group: 'TIME' },
  { key: 'day', group: 'TIME' },
  { key: 'week', group: 'TIME' },
  { key: 'month', group: 'TIME' },
  { key: 'm', group: 'LENGTH', system: 'METRIC' },
  { key: 'ft', group: 'LENGTH', system: 'IMPERIAL' },
  { key: 'm2', group: 'AREA', system: 'METRIC' },
  { key: 'ft2', group: 'AREA', system: 'IMPERIAL' },
  { key: 'm3', group: 'VOLUME', system: 'METRIC' },
  { key: 'yd3', group: 'VOLUME', system: 'IMPERIAL' },
  { key: 'l', group: 'VOLUME', system: 'METRIC' },
  { key: 'gal', group: 'VOLUME', system: 'IMPERIAL' },
  { key: 'kg', group: 'WEIGHT', system: 'METRIC' },
  { key: 'lb', group: 'WEIGHT', system: 'IMPERIAL' },
  { key: 'km', group: 'DISTANCE', system: 'METRIC' },
  { key: 'mi', group: 'DISTANCE', system: 'IMPERIAL' },
];

/** Units in picker order: shared units first, then the preferred system, then the other. */
export const unitsFor = (preferred: UnitSystem): UnitDef[] => {
  const rank = (u: UnitDef) =>
    u.system === undefined ? 0 : u.system === preferred ? 1 : 2;
  return [...UNITS].sort((a, b) => rank(a) - rank(b));
};

export const isKnownUnit = (key: string): boolean =>
  UNITS.some(u => u.key === key);
