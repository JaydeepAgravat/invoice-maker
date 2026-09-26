/** Expense categories: few enough to pick at a glance, broad enough for tax time. */
export const EXPENSE_CATEGORIES = [
  'MATERIALS',
  'TOOLS',
  'SUBCONTRACTORS',
  'FUEL',
  'TRAVEL',
  'MEALS',
  'OFFICE',
  'SOFTWARE',
  'PHONE',
  'MARKETING',
  'INSURANCE',
  'RENT',
  'FEES',
  'OTHER',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const isExpenseCategory = (v: string | null | undefined): v is ExpenseCategory =>
  !!v && (EXPENSE_CATEGORIES as readonly string[]).includes(v);
