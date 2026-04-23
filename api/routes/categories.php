<?php

declare(strict_types=1);

return static function (string $method, string $path): void {
    if ($path === '/api/categories' && $method === 'GET') {
        ensure_default_categories_exist();
        try {
            $stmt = db()->query('SELECT id, name FROM categories ORDER BY name ASC');
            $items = $stmt->fetchAll();
            foreach ($items as &$r) {
                $r['id'] = (int) $r['id'];
                $r['name'] = (string) $r['name'];
            }
            unset($r);
            $names = array_map(static fn(array $r): string => (string) $r['name'], $items);
            json_response(['categories' => $names, 'category_items' => $items]);
        } catch (Throwable $e) {
            json_response(['categories' => DEFAULT_CATEGORIES, 'category_items' => []]);
        }
        exit;
    }

    if ($path === '/api/categories' && $method === 'POST') {
        ensure_default_categories_exist();
        $body = read_json_body();
        $name = normalize_category_name((string) ($body['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 64) {
            json_response(['error' => 'name inválido'], 422);
            exit;
        }
        try {
            $stmt = db()->prepare('INSERT INTO categories (name) VALUES (?)');
            $stmt->execute([$name]);
            json_response(['id' => (int) db()->lastInsertId(), 'name' => $name], 201);
        } catch (PDOException $e) {
            if ((string) $e->getCode() === '23000') {
                json_response(['error' => 'Esa categoría ya existe'], 409);
                exit;
            }
            throw $e;
        }
        exit;
    }

    if (preg_match('#^/api/categories/(\d+)$#', $path, $m)) {
        ensure_default_categories_exist();
        $id = (int) $m[1];

        if ($method === 'PATCH') {
            $body = read_json_body();
            $name = normalize_category_name((string) ($body['name'] ?? ''));
            if ($name === '' || mb_strlen($name) > 64) {
                json_response(['error' => 'name inválido'], 422);
                exit;
            }

            $row = db()->prepare('SELECT id, name FROM categories WHERE id = ?');
            $row->execute([$id]);
            $existing = $row->fetch();
            if (!$existing) {
                json_response(['error' => 'Categoría no encontrada'], 404);
                exit;
            }

            try {
                $upd = db()->prepare('UPDATE categories SET name = ? WHERE id = ?');
                $upd->execute([$name, $id]);
            } catch (PDOException $e) {
                if ((string) $e->getCode() === '23000') {
                    json_response(['error' => 'Esa categoría ya existe'], 409);
                    exit;
                }
                throw $e;
            }

            json_response(['id' => $id, 'name' => $name]);
            exit;
        }

        if ($method === 'DELETE') {
            $row = db()->prepare('SELECT id, name FROM categories WHERE id = ?');
            $row->execute([$id]);
            $existing = $row->fetch();
            if (!$existing) {
                json_response(['error' => 'Categoría no encontrada'], 404);
                exit;
            }

            // Move affected expenses to "Varios"
            $varios = 'Varios';
            try {
                ensure_default_categories_exist();
                $stmt = db()->prepare('SELECT 1 FROM categories WHERE name = ?');
                $stmt->execute([$varios]);
                if (!$stmt->fetchColumn()) {
                    db()->prepare('INSERT IGNORE INTO categories (name) VALUES (?)')->execute([$varios]);
                }
            } catch (Throwable $e) {
                // ignore
            }

            db()->prepare('UPDATE expenses SET category = ? WHERE category = ?')->execute([$varios, (string) $existing['name']]);
            db()->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);
            json_response(['ok' => true]);
            exit;
        }

        json_response(['error' => 'Method not allowed'], 405);
        exit;
    }
};

