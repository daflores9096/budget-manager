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

    if (is_file($local)) {
        /** @var array $cfg */
        $cfg = require $local;
    } elseif (is_file($example)) {
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
