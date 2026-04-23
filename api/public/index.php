<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'lib.php';

cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

try {
    $routesDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'routes' . DIRECTORY_SEPARATOR;

    if ($path === '/api/health') {
        $handler = require $routesDir . 'health.php';
        $handler($method);
        exit;
    }

    if (str_starts_with($path, '/api/categories')) {
        $handler = require $routesDir . 'categories.php';
        $handler($method, $path);
        // If handler didn't exit, continue to legacy section.
    }

    if (str_starts_with($path, '/api/recurring-fixed')) {
        $handler = require $routesDir . 'recurring_fixed.php';
        $handler($method, $path);
        exit;
    }

    if ($path === '/api/health' && $method === 'GET') {
        db()->query('SELECT 1');
        json_response(['ok' => true]);
        exit;
    }

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
            // Legacy fallback
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
            $oldName = (string) $existing['name'];

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

            // Keep existing expenses pointing to the renamed category.
            $exp = db()->prepare('UPDATE expenses SET category = ? WHERE category = ?');
            $exp->execute([$name, $oldName]);

            json_response(['ok' => true, 'id' => $id, 'name' => $name]);
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
            $name = (string) $existing['name'];
            if ($name === 'Varios') {
                json_response(['error' => 'No se puede eliminar la categoría Varios'], 422);
                exit;
            }

            // Reassign expenses to 'Varios' on delete.
            $fallback = 'Varios';
            $ensure = db()->prepare('INSERT IGNORE INTO categories (name) VALUES (?)');
            $ensure->execute([$fallback]);

            $exp = db()->prepare('UPDATE expenses SET category = ? WHERE category = ?');
            $exp->execute([$fallback, $name]);

            $del = db()->prepare('DELETE FROM categories WHERE id = ?');
            $del->execute([$id]);

            json_response(['ok' => true]);
            exit;
        }
    }

    if ($path === '/api/months' && $method === 'GET') {
        $stmt = db()->query(
            'SELECT bm.id, bm.year, bm.month,
              (SELECT COALESCE(SUM(amount),0) FROM incomes WHERE budget_month_id = bm.id) AS total_income,
              (SELECT COALESCE(SUM(actual_amount),0) FROM expenses WHERE budget_month_id = bm.id) AS total_spent
             FROM budget_months bm
             ORDER BY bm.year ASC, bm.month ASC'
        );
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int) $r['id'];
            $r['year'] = (int) $r['year'];
            $r['month'] = (int) $r['month'];
            $r['total_income'] = (float) $r['total_income'];
            $r['total_spent'] = (float) $r['total_spent'];
            $r['remaining'] = $r['total_income'] - $r['total_spent'];
        }
        unset($r);
        json_response(['months' => $rows]);
        exit;
    }

    if ($path === '/api/months' && $method === 'POST') {
        $body = read_json_body();
        $year = isset($body['year']) ? (int) $body['year'] : 0;
        $month = isset($body['month']) ? (int) $body['month'] : 0;
        if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12) {
            json_response(['error' => 'year o month inválidos'], 422);
            exit;
        }
        $stmt = db()->prepare('INSERT INTO budget_months (year, month) VALUES (?, ?)');
        try {
            $stmt->execute([$year, $month]);
        } catch (PDOException $e) {
            if ((string) $e->getCode() === '23000') {
                json_response(['error' => 'Ese mes ya existe'], 409);
                exit;
            }
            throw $e;
        }
        $id = (int) db()->lastInsertId();
        json_response(['id' => $id, 'year' => $year, 'month' => $month], 201);
        exit;
    }

    if ($path === '/api/transactions' && $method === 'GET') {
        $qs = $_GET ?? [];
        $start = (string) ($qs['start'] ?? '');
        $end = (string) ($qs['end'] ?? '');
        if ($start === '' || $end === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
            json_response(['error' => 'start y end requeridos (YYYY-MM-DD)'], 422);
            exit;
        }
        if ($start > $end) {
            json_response(['error' => 'start no puede ser mayor que end'], 422);
            exit;
        }

        $inc = db()->prepare(
            'SELECT id, entry_date AS date, description, amount
             FROM incomes
             WHERE entry_date BETWEEN ? AND ?
             ORDER BY entry_date ASC, id ASC'
        );
        $inc->execute([$start, $end]);
        $incomes = $inc->fetchAll();
        foreach ($incomes as &$i) {
            $i['id'] = (int) $i['id'];
            $i['amount'] = (float) $i['amount'];
        }
        unset($i);

        $exp = db()->prepare(
            'SELECT id, expense_type AS type, entry_date AS date, description,
                    expected_amount AS expected, actual_amount AS actual, category, paid
             FROM expenses
             WHERE entry_date BETWEEN ? AND ?
             ORDER BY entry_date ASC, id ASC'
        );
        $exp->execute([$start, $end]);
        $expenses = $exp->fetchAll();
        foreach ($expenses as &$e) {
            $e['id'] = (int) $e['id'];
            $e['expected'] = $e['expected'] === null ? null : (float) $e['expected'];
            $e['actual'] = (float) $e['actual'];
            $e['paid'] = (bool) (int) $e['paid'];
        }
        unset($e);

        $ti = array_sum(array_column($incomes, 'amount'));
        $ts = array_sum(array_column($expenses, 'actual'));

        json_response([
            'range' => ['start' => $start, 'end' => $end],
            'summary' => [
                'total_income' => $ti,
                'total_spent' => $ts,
                'remaining' => $ti - $ts,
            ],
            'incomes' => $incomes,
            'expenses' => $expenses,
        ]);
        exit;
    }

    if (preg_match('#^/api/months/(\d+)$#', $path, $m)) {
        $monthId = (int) $m[1];

        if ($method === 'GET') {
            $stmt = db()->prepare('SELECT id, year, month FROM budget_months WHERE id = ?');
            $stmt->execute([$monthId]);
            $bm = $stmt->fetch();
            if (!$bm) {
                json_response(['error' => 'Mes no encontrado'], 404);
                exit;
            }

            $inc = db()->prepare(
                'SELECT id, entry_date AS date, description, amount
                 FROM incomes WHERE budget_month_id = ? ORDER BY entry_date ASC, id ASC'
            );
            $inc->execute([$monthId]);
            $incomes = $inc->fetchAll();
            foreach ($incomes as &$i) {
                $i['id'] = (int) $i['id'];
                $i['amount'] = (float) $i['amount'];
            }
            unset($i);

            $exp = db()->prepare(
                'SELECT id, expense_type AS type, entry_date AS date, description,
                        expected_amount AS expected, actual_amount AS actual, category, paid
                 FROM expenses WHERE budget_month_id = ? ORDER BY entry_date ASC, id ASC'
            );
            $exp->execute([$monthId]);
            $expenses = $exp->fetchAll();
            foreach ($expenses as &$e) {
                $e['id'] = (int) $e['id'];
                $e['expected'] = $e['expected'] === null ? null : (float) $e['expected'];
                $e['actual'] = (float) $e['actual'];
                $e['paid'] = (bool) (int) $e['paid'];
            }
            unset($e);

            $ti = array_sum(array_column($incomes, 'amount'));
            $ts = array_sum(array_column($expenses, 'actual'));

            json_response([
                'month' => [
                    'id' => (int) $bm['id'],
                    'year' => (int) $bm['year'],
                    'month' => (int) $bm['month'],
                ],
                'summary' => [
                    'total_income' => $ti,
                    'total_spent' => $ts,
                    'remaining' => $ti - $ts,
                ],
                'incomes' => $incomes,
                'expenses' => $expenses,
            ]);
            exit;
        }

        if ($method === 'DELETE') {
            $stmt = db()->prepare('DELETE FROM budget_months WHERE id = ?');
            $stmt->execute([$monthId]);
            json_response(['ok' => true]);
            exit;
        }
    }

    if (preg_match('#^/api/months/(\d+)/incomes$#', $path, $m) && $method === 'POST') {
        $monthId = (int) $m[1];
        ensure_month_exists($monthId);
        $body = read_json_body();
        $date = (string) ($body['date'] ?? '');
        $description = trim((string) ($body['description'] ?? ''));
        $amount = isset($body['amount']) ? (float) $body['amount'] : 0.0;
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            json_response(['error' => 'date inválida (YYYY-MM-DD)'], 422);
            exit;
        }
        if ($amount <= 0) {
            json_response(['error' => 'amount debe ser > 0'], 422);
            exit;
        }
        $stmt = db()->prepare(
            'INSERT INTO incomes (budget_month_id, entry_date, description, amount) VALUES (?,?,?,?)'
        );
        $stmt->execute([$monthId, $date, $description, $amount]);
        json_response(['id' => (int) db()->lastInsertId()], 201);
        exit;
    }

    if ($path === '/api/incomes' && $method === 'POST') {
        $body = read_json_body();
        $date = (string) ($body['date'] ?? '');
        $description = trim((string) ($body['description'] ?? ''));
        $amount = isset($body['amount']) ? (float) $body['amount'] : 0.0;
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            json_response(['error' => 'date inválida (YYYY-MM-DD)'], 422);
            exit;
        }
        if ($amount <= 0) {
            json_response(['error' => 'amount debe ser > 0'], 422);
            exit;
        }
        [$y, $mth] = array_map('intval', explode('-', $date, 3));
        $monthId = get_or_create_month_id($y, $mth);

        $stmt = db()->prepare('INSERT INTO incomes (budget_month_id, entry_date, description, amount) VALUES (?,?,?,?)');
        $stmt->execute([$monthId, $date, $description, $amount]);
        json_response(['id' => (int) db()->lastInsertId()], 201);
        exit;
    }

    if (preg_match('#^/api/incomes/(\d+)$#', $path, $m)) {
        $id = (int) $m[1];
        if ($method === 'PATCH') {
            $body = read_json_body();
            $fields = [];
            $params = [];
            if (array_key_exists('date', $body)) {
                $d = (string) $body['date'];
                if ($d === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) {
                    json_response(['error' => 'date inválida'], 422);
                    exit;
                }
                $fields[] = 'entry_date = ?';
                $params[] = $d;
            }
            if (array_key_exists('description', $body)) {
                $fields[] = 'description = ?';
                $params[] = trim((string) $body['description']);
            }
            if (array_key_exists('amount', $body)) {
                $a = (float) $body['amount'];
                if ($a <= 0) {
                    json_response(['error' => 'amount debe ser > 0'], 422);
                    exit;
                }
                $fields[] = 'amount = ?';
                $params[] = $a;
            }
            if ($fields === []) {
                json_response(['error' => 'Sin campos para actualizar'], 422);
                exit;
            }
            $params[] = $id;
            $sql = 'UPDATE incomes SET ' . implode(', ', $fields) . ' WHERE id = ?';
            $stmt = db()->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            exit;
        }
        if ($method === 'DELETE') {
            $stmt = db()->prepare('DELETE FROM incomes WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
            exit;
        }
    }

    if (preg_match('#^/api/months/(\d+)/expenses$#', $path, $m) && $method === 'POST') {
        $monthId = (int) $m[1];
        ensure_month_exists($monthId);
        $body = read_json_body();
        $type = (string) ($body['type'] ?? 'variable');
        if ($type !== 'fixed' && $type !== 'variable') {
            json_response(['error' => 'type debe ser fixed o variable'], 422);
            exit;
        }
        $date = (string) ($body['date'] ?? '');
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            json_response(['error' => 'date inválida (YYYY-MM-DD)'], 422);
            exit;
        }
        $description = trim((string) ($body['description'] ?? ''));
        $category = (string) ($body['category'] ?? 'Varios');
        require_category($category);

        $expected = null;
        if (array_key_exists('expected', $body) && $body['expected'] !== null && $body['expected'] !== '') {
            $expected = (float) $body['expected'];
        }

        $actual = isset($body['actual']) ? (float) $body['actual'] : 0.0;
        if ($actual < 0) {
            json_response(['error' => 'actual no puede ser negativo'], 422);
            exit;
        }

        $paid = !empty($body['paid']) ? 1 : 0;

        if ($type === 'variable') {
            $expected = null;
        }

        $stmt = db()->prepare(
            'INSERT INTO expenses (budget_month_id, expense_type, entry_date, description, expected_amount, actual_amount, category, paid)
             VALUES (?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([$monthId, $type, $date, $description, $expected, $actual, $category, $paid]);
        json_response(['id' => (int) db()->lastInsertId()], 201);
        exit;
    }

    if ($path === '/api/expenses' && $method === 'POST') {
        $body = read_json_body();
        $type = (string) ($body['type'] ?? 'variable');
        if ($type !== 'fixed' && $type !== 'variable') {
            json_response(['error' => 'type debe ser fixed o variable'], 422);
            exit;
        }
        $date = (string) ($body['date'] ?? '');
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            json_response(['error' => 'date inválida (YYYY-MM-DD)'], 422);
            exit;
        }
        $description = trim((string) ($body['description'] ?? ''));
        $category = (string) ($body['category'] ?? 'Varios');
        require_category($category);

        $expected = null;
        if (array_key_exists('expected', $body) && $body['expected'] !== null && $body['expected'] !== '') {
            $expected = (float) $body['expected'];
        }

        $actual = isset($body['actual']) ? (float) $body['actual'] : 0.0;
        if ($actual < 0) {
            json_response(['error' => 'actual no puede ser negativo'], 422);
            exit;
        }

        $paid = !empty($body['paid']) ? 1 : 0;
        if ($type === 'variable') {
            $expected = null;
            $paid = 0;
        }

        [$y, $mth] = array_map('intval', explode('-', $date, 3));
        $monthId = get_or_create_month_id($y, $mth);

        $stmt = db()->prepare(
            'INSERT INTO expenses (budget_month_id, expense_type, entry_date, description, expected_amount, actual_amount, category, paid)
             VALUES (?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([$monthId, $type, $date, $description, $expected, $actual, $category, $paid]);
        json_response(['id' => (int) db()->lastInsertId()], 201);
        exit;
    }

    if (preg_match('#^/api/expenses/(\d+)$#', $path, $m)) {
        $id = (int) $m[1];
        if ($method === 'PATCH') {
            $body = read_json_body();
            $row = db()->prepare('SELECT expense_type FROM expenses WHERE id = ?');
            $row->execute([$id]);
            $existing = $row->fetch();
            if (!$existing) {
                json_response(['error' => 'Gasto no encontrado'], 404);
                exit;
            }
            $type = (string) $existing['expense_type'];

            $fields = [];
            $params = [];
            if (array_key_exists('date', $body)) {
                $d = (string) $body['date'];
                if ($d === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) {
                    json_response(['error' => 'date inválida'], 422);
                    exit;
                }
                $fields[] = 'entry_date = ?';
                $params[] = $d;
            }
            if (array_key_exists('description', $body)) {
                $fields[] = 'description = ?';
                $params[] = trim((string) $body['description']);
            }
            if (array_key_exists('category', $body)) {
                $cat = (string) $body['category'];
                require_category($cat);
                $fields[] = 'category = ?';
                $params[] = $cat;
            }
            if ($type === 'fixed') {
                if (array_key_exists('expected', $body)) {
                    if ($body['expected'] === null || $body['expected'] === '') {
                        $fields[] = 'expected_amount = NULL';
                    } else {
                        $fields[] = 'expected_amount = ?';
                        $params[] = (float) $body['expected'];
                    }
                }
            }
            if (array_key_exists('actual', $body)) {
                $fields[] = 'actual_amount = ?';
                $params[] = (float) $body['actual'];
            }
            if (array_key_exists('paid', $body)) {
                $fields[] = 'paid = ?';
                $params[] = !empty($body['paid']) ? 1 : 0;
            }
            if ($fields === []) {
                json_response(['error' => 'Sin campos para actualizar'], 422);
                exit;
            }
            $params[] = $id;
            $sql = 'UPDATE expenses SET ' . implode(', ', $fields) . ' WHERE id = ?';
            $stmt = db()->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            exit;
        }
        if ($method === 'DELETE') {
            $stmt = db()->prepare('DELETE FROM expenses WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
            exit;
        }
    }

    json_response(['error' => 'Ruta no encontrada'], 404);
} catch (Throwable $e) {
    json_response(['error' => 'Error del servidor', 'detail' => $e->getMessage()], 500);
}

function ensure_month_exists(int $monthId): void
{
    $stmt = db()->prepare('SELECT id FROM budget_months WHERE id = ?');
    $stmt->execute([$monthId]);
    if (!$stmt->fetch()) {
        json_response(['error' => 'Mes no encontrado'], 404);
        exit;
    }
}

function get_or_create_month_id(int $year, int $month): int
{
    if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12) {
        json_response(['error' => 'year o month inválidos'], 422);
        exit;
    }
    $ins = db()->prepare('INSERT IGNORE INTO budget_months (year, month) VALUES (?, ?)');
    $ins->execute([$year, $month]);
    $sel = db()->prepare('SELECT id FROM budget_months WHERE year = ? AND month = ?');
    $sel->execute([$year, $month]);
    $row = $sel->fetch();
    if (!$row) {
        json_response(['error' => 'No se pudo crear el mes'], 500);
        exit;
    }
    return (int) $row['id'];
}
