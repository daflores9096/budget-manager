<?php

declare(strict_types=1);

const DEFAULT_CATEGORIES = [
    'Alimentación',
    'Salud',
    'Transporte',
    'Deudas/Créditos',
    'Mascotas',
    'Varios',
    'Servicios Hogar',
    'Entretenimiento',
];

function load_config(): array
{
    $apiDir = __DIR__;
    $local = $apiDir . DIRECTORY_SEPARATOR . 'config.local.php';
    $example = $apiDir . DIRECTORY_SEPARATOR . 'config.example.php';

    // En Docker, config.local.php se genera al arrancar el contenedor (write-config-from-env.php).
    // En Synology/mod_php, getenv('DB_PASS') en Apache a veces devuelve vacío o un valor distinto
    // y pisaba la contraseña correcta del archivo → error 1045. Si existe config.local.php, usarlo.
    if (is_file($local)) {
        /** @var array $cfg */
        $cfg = require $local;
        $db = $cfg['db'] ?? [];

        return [
            'db' => [
                'host' => (string) ($db['host'] ?? 'db'),
                'port' => (int) ($db['port'] ?? 3306),
                'name' => (string) ($db['name'] ?? 'budget_manager'),
                'user' => (string) ($db['user'] ?? 'budget'),
                'pass' => (string) ($db['pass'] ?? ''),
                'charset' => (string) ($db['charset'] ?? 'utf8mb4'),
            ],
        ];
    }

    if (is_file($example)) {
        /** @var array $cfg */
        $cfg = require $example;
    } else {
        $cfg = [];
    }

    $env = static function (string $key, ?string $default = null): ?string {
        $v = getenv($key);
        if ($v === false || $v === '') {
            return $default;
        }
        return $v;
    };

    $db = $cfg['db'] ?? [];

    return [
        'db' => [
            'host' => $env('DB_HOST', $db['host'] ?? '127.0.0.1'),
            'port' => (int) ($env('DB_PORT', isset($db['port']) ? (string) $db['port'] : '3306')),
            'name' => $env('DB_NAME', $db['name'] ?? 'budget_manager'),
            'user' => $env('DB_USER', $db['user'] ?? 'root'),
            'pass' => $env('DB_PASS', $db['pass'] ?? ''),
            'charset' => $db['charset'] ?? 'utf8mb4',
        ],
    ];
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $c = load_config()['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $c['host'],
        $c['port'],
        $c['name'],
        $c['charset']
    );

    $pdo = new PDO($dsn, $c['user'], $c['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function json_response(mixed $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function cors(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

function require_category(string $category): void
{
    $category = normalize_category_name($category);
    if ($category === '') {
        json_response(['error' => 'Categoría no válida'], 422);
        exit;
    }

    // Prefer DB-backed categories (new behavior).
    try {
        ensure_default_categories_exist();
        $stmt = db()->prepare('SELECT 1 FROM categories WHERE name = ?');
        $stmt->execute([$category]);
        if ($stmt->fetchColumn()) {
            return;
        }
    } catch (Throwable $e) {
        // Legacy fallback (if categories table does not exist).
        if (in_array($category, DEFAULT_CATEGORIES, true)) {
            return;
        }
    }

    json_response(['error' => 'Categoría no válida'], 422);
    exit;
}

function ensure_default_categories_exist(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    try {
        $stmt = db()->query('SELECT COUNT(*) AS c FROM categories');
        $row = $stmt->fetch();
        $count = isset($row['c']) ? (int) $row['c'] : 0;
        if ($count > 0) {
            return;
        }
        $ins = db()->prepare('INSERT IGNORE INTO categories (name) VALUES (?)');
        foreach (DEFAULT_CATEGORIES as $name) {
            $ins->execute([$name]);
        }
    } catch (Throwable $e) {
        // ignore
    }
}

function normalize_category_name(string $name): string
{
    $name = preg_replace('/\s+/', ' ', $name);
    if ($name === null) {
        return '';
    }
    return trim($name);
}

// -----------------------------
// Auth / Users / Sessions
// -----------------------------

function ensure_auth_schema(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    db()->exec(
        "CREATE TABLE IF NOT EXISTS users (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
    );

    // Migration for existing DBs (best-effort).
    try {
        db()->exec("ALTER TABLE users ADD COLUMN username VARCHAR(64) NOT NULL DEFAULT ''");
    } catch (Throwable $e) {
        // ignore
    }
    try {
        // Backfill empty usernames to make them unique.
        db()->exec("UPDATE users SET username = CONCAT('user', id) WHERE username = '' OR username IS NULL");
    } catch (Throwable $e) {
        // ignore
    }
    try {
        db()->exec("ALTER TABLE users ADD UNIQUE KEY uq_users_username (username)");
    } catch (Throwable $e) {
        // ignore
    }

    db()->exec(
        "CREATE TABLE IF NOT EXISTS sessions (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            token_hash CHAR(64) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP NULL DEFAULT NULL,
            expires_at TIMESTAMP NOT NULL,
            UNIQUE KEY uq_sessions_token_hash (token_hash),
            KEY idx_sessions_user (user_id),
            CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
    );

    db()->exec(
        "CREATE TABLE IF NOT EXISTS password_resets (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            token_hash CHAR(64) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL DEFAULT NULL,
            UNIQUE KEY uq_password_resets_token_hash (token_hash),
            KEY idx_password_resets_user (user_id),
            CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
    );
}

function base64url_encode(string $raw): string
{
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function random_token(int $bytes = 32): string
{
    return base64url_encode(random_bytes($bytes));
}

function token_hash(string $token): string
{
    return hash('sha256', $token);
}

function auth_cookie_name(): string
{
    return 'bm_session';
}

function set_session_cookie(string $token, int $ttlSeconds): void
{
    $secure = (getenv('COOKIE_SECURE') ?: '') === '1';
    setcookie(auth_cookie_name(), $token, [
        'expires' => time() + $ttlSeconds,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_session_cookie(): void
{
    setcookie(auth_cookie_name(), '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => false,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function auth_user_from_token(string $token): ?array
{
    if ($token === '') {
        return null;
    }
    $h = token_hash($token);
    $stmt = db()->prepare(
        "SELECT u.id, u.username, u.email, u.name, u.role, u.disabled
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > NOW()
         LIMIT 1"
    );
    $stmt->execute([$h]);
    $u = $stmt->fetch();
    if (!$u) {
        return null;
    }
    if (!empty($u['disabled'])) {
        return null;
    }
    // Touch last_seen_at (best-effort)
    try {
        $touch = db()->prepare('UPDATE sessions SET last_seen_at = NOW() WHERE token_hash = ?');
        $touch->execute([$h]);
    } catch (Throwable $e) {
        // ignore
    }
    return [
        'id' => (int) $u['id'],
        'username' => isset($u['username']) ? (string) $u['username'] : '',
        'email' => (string) $u['email'],
        'name' => (string) $u['name'],
        'role' => (string) $u['role'],
    ];
}

function auth_user(): ?array
{
    ensure_auth_schema();

    $bearer = '';
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (is_string($hdr) && preg_match('/^Bearer\s+(.+)$/i', trim($hdr), $m)) {
        $bearer = trim((string) $m[1]);
    }

    $cookie = (string) ($_COOKIE[auth_cookie_name()] ?? '');

    $u = auth_user_from_token($bearer);
    if ($u !== null) {
        return $u;
    }

    // Stale Bearer in localStorage should not block a valid HttpOnly cookie session.
    if ($cookie !== '' && $cookie !== $bearer) {
        return auth_user_from_token($cookie);
    }

    return null;
}

function require_auth(): array
{
    $u = auth_user();
    if (!$u) {
        json_response(['error' => 'No autorizado'], 401);
        exit;
    }
    return $u;
}

function require_role(string $role): array
{
    $u = require_auth();
    if (($u['role'] ?? '') !== $role) {
        json_response(['error' => 'Prohibido'], 403);
        exit;
    }
    return $u;
}

function normalize_username(string $v): string
{
    $v = trim($v);
    $v = strtolower($v);
    // allow letters, numbers, underscore, dot, dash
    $v = preg_replace('/[^a-z0-9_.-]+/', '', $v);
    return $v ?? '';
}

function ensure_ledger_user_schema(): void
{
    // Adds user_id to expenses/incomes so we can show username in lists.
    // Backfill is left as NULL for existing rows.
    try {
        $cols = db()->query("SELECT TABLE_NAME, COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('expenses','incomes')")->fetchAll();
        $has = [];
        foreach ($cols as $c) {
            $has[strtolower((string) $c['TABLE_NAME']) . '.' . strtolower((string) $c['COLUMN_NAME'])] = true;
        }

        if (empty($has['expenses.user_id'])) {
            db()->exec('ALTER TABLE expenses ADD COLUMN user_id INT UNSIGNED NULL');
            db()->exec('ALTER TABLE expenses ADD KEY idx_expenses_user (user_id)');
        }
        if (empty($has['incomes.user_id'])) {
            db()->exec('ALTER TABLE incomes ADD COLUMN user_id INT UNSIGNED NULL');
            db()->exec('ALTER TABLE incomes ADD KEY idx_incomes_user (user_id)');
        }
    } catch (Throwable $e) {
        // best-effort migration; ignore if fails
    }
}
