-- Run once on an existing database (NAS or local) to speed up date-range queries.
-- Safe to re-run only if indexes are missing; duplicate index names will error.

USE budget_manager;

ALTER TABLE incomes
  ADD INDEX idx_incomes_entry_date (entry_date);

ALTER TABLE expenses
  ADD INDEX idx_expenses_entry_date (entry_date),
  ADD INDEX idx_expenses_category_date (category, entry_date);
