-- Presupuesto mensual + ingresos + gastos (fijos / variables)
-- MySQL 8+ recomendado

CREATE DATABASE IF NOT EXISTS budget_manager
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE budget_manager;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_category_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS budget_months (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  year SMALLINT UNSIGNED NOT NULL,
  month TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_year_month (year, month)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS incomes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  budget_month_id INT UNSIGNED NOT NULL,
  entry_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_incomes_month FOREIGN KEY (budget_month_id)
    REFERENCES budget_months (id) ON DELETE CASCADE,
  KEY idx_incomes_month (budget_month_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  budget_month_id INT UNSIGNED NOT NULL,
  expense_type ENUM('fixed','variable') NOT NULL DEFAULT 'variable',
  entry_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  expected_amount DECIMAL(12,2) NULL,
  actual_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  category VARCHAR(64) NOT NULL DEFAULT 'Varios',
  paid TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_expenses_month FOREIGN KEY (budget_month_id)
    REFERENCES budget_months (id) ON DELETE CASCADE,
  KEY idx_expenses_month_type (budget_month_id, expense_type)
) ENGINE=InnoDB;

-- Plantillas de gastos fijos mensuales (mismo monto esperado cada mes)
CREATE TABLE IF NOT EXISTS recurring_fixed_expenses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT '',
  expected_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  category VARCHAR(64) NOT NULL DEFAULT 'Varios',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Un registro por plantilla y mes calendario cuando el usuario registra el pago (enlaza al gasto creado)
CREATE TABLE IF NOT EXISTS recurring_fixed_expense_monthly (
  recurring_fixed_expense_id INT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  month TINYINT UNSIGNED NOT NULL,
  expense_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recurring_fixed_expense_id, year, month),
  KEY idx_rfxm_expense (expense_id),
  CONSTRAINT fk_rfxm_template FOREIGN KEY (recurring_fixed_expense_id)
    REFERENCES recurring_fixed_expenses (id) ON DELETE CASCADE,
  CONSTRAINT fk_rfxm_expense FOREIGN KEY (expense_id)
    REFERENCES expenses (id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO categories (name) VALUES
  ('Alimentación'),
  ('Salud'),
  ('Transporte'),
  ('Deudas/Créditos'),
  ('Mascotas'),
  ('Varios'),
  ('Servicios Hogar'),
  ('Entretenimiento');
