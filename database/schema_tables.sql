-- Tablas dentro de la base ya seleccionada (Docker: MYSQL_DATABASE).
-- Instalación manual: crear la base y luego ejecutar este archivo dentro de ella.

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

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
  user_id INT UNSIGNED NULL,
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
  user_id INT UNSIGNED NULL,
  expense_type ENUM('fixed','variable') NOT NULL DEFAULT 'variable',
  entry_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  expected_amount DECIMAL(12,2) NULL,
  actual_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  category VARCHAR(64) NOT NULL DEFAULT 'Varios',
  paid TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_expenses_month FOREIGN KEY (budget_month_id)
    REFERENCES budget_months (id) ON DELETE CASCADE,
  KEY idx_expenses_month_type (budget_month_id, expense_type),
  KEY idx_expenses_user (user_id)
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

-- Users & auth
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(190) NOT NULL,
  name VARCHAR(120) NOT NULL DEFAULT '',
  role ENUM('admin','appuser') NOT NULL DEFAULT 'appuser',
  password_hash VARCHAR(255) NOT NULL,
  disabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE KEY uq_sessions_token_hash (token_hash),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_resets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_password_resets_token_hash (token_hash),
  KEY idx_password_resets_user (user_id),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
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

-- Admin por defecto (login: admin o admin@localhost / admin1234). Cambiar en producción.
INSERT IGNORE INTO users (username, email, name, role, password_hash, disabled) VALUES
  ('admin', 'admin@localhost', 'Admin', 'admin', '$2y$10$6jdtnwIDTFNAuFFPnpHuyOYNLui/kf03sNOc53WA/D/qHWfDaG4Xa', 0);
