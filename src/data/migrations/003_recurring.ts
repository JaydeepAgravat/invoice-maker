/**
 * Schema v3: recurring schedules count occurrences from a fixed anchor date,
 * so month-end schedules never drift.
 */
export const migration003 = [
  'ALTER TABLE recurring_schedules ADD COLUMN anchor_date TEXT',
  'ALTER TABLE recurring_schedules ADD COLUMN next_index INTEGER NOT NULL DEFAULT 0',
  'UPDATE recurring_schedules SET anchor_date = next_date WHERE anchor_date IS NULL',
  'CREATE INDEX idx_recurring_template ON recurring_schedules(template_document_id)',
];
