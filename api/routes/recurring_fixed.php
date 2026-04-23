<?php

declare(strict_types=1);

/**
 * Recurring monthly fixed expenses (templates) + per-month completion.
 *
 * Mounted from public/index.php (same scope as get_or_create_month_id, require_category, etc.).
 */
return static function (string $method, string $path): void {
    ensure_recurring_fixed_schema();

    if ($path === '/api/recurring-fixed/pending' && $method === 'GET') {
        $year = isset($_GET['year']) ? (int) $_GET['year'] : 0;
        $month = isset($_GET['month']) ? (int) $_GET['month'] : 0;
        if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12) {
            json_response(['error' => 'year y month requeridos (válidos)'], 422);
            exit;
        }
        $stmt = db()->prepare(
            'SELECT r.id, r.title, r.expected_amount, r.category
             FROM recurring_fixed_expenses r
             LEFT JOIN recurring_fixed_expense_monthly m
               ON m.recurring_fixed_expense_id = r.id AND m.year = ? AND m.month = ?
             WHERE m.recurring_fixed_expense_id IS NULL
             ORDER BY r.title ASC'
        );
        $stmt->execute([$year, $month]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int) $r['id'];
            $r['title'] = (string) $r['title'];
            $r['expected_amount'] = (float) $r['expected_amount'];
            $r['category'] = (string) $r['category'];
        }
        unset($r);
        json_response(['pending' => $rows, 'year' => $year, 'month' => $month]);
        exit;
    }

    if ($path === '/api/recurring-fixed' && $method === 'GET') {
        $stmt = db()->query('SELECT id, title, expected_amount, category FROM recurring_fixed_expenses ORDER BY title ASC');
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int) $r['id'];
            $r['title'] = (string) $r['title'];
            $r['expected_amount'] = (float) $r['expected_amount'];
            $r['category'] = (string) $r['category'];
        }
        unset($r);
        json_response(['items' => $rows]);
        exit;
    }

    if ($path === '/api/recurring-fixed' && $method === 'POST') {
        $body = read_json_body();
        $title = trim((string) ($body['title'] ?? ''));
        $category = (string) ($body['category'] ?? 'Varios');
        require_category($category);
        $expected = isset($body['expected_amount']) ? (float) $body['expected_amount'] : 0.0;
        if ($title === '' || mb_strlen($title) > 255) {
            json_response(['error' => 'title inválido'], 422);
            exit;
        }
        if ($expected < 0) {
            json_response(['error' => 'expected_amount no puede ser negativo'], 422);
            exit;
        }
        $ins = db()->prepare('INSERT INTO recurring_fixed_expenses (title, expected_amount, category) VALUES (?,?,?)');
        $ins->execute([$title, $expected, $category]);
        $id = (int) db()->lastInsertId();
        json_response(['id' => $id, 'title' => $title, 'expected_amount' => $expected, 'category' => $category], 201);
        exit;
    }

    if (preg_match('#^/api/recurring-fixed/(\d+)/pay$#', $path, $m) && $method === 'POST') {
        $rid = (int) $m[1];
        $row = db()->prepare('SELECT id, title, expected_amount, category FROM recurring_fixed_expenses WHERE id = ?');
        $row->execute([$rid]);
        $tpl = $row->fetch();
        if (!$tpl) {
            json_response(['error' => 'Plantilla no encontrada'], 404);
            exit;
        }
        $body = read_json_body();
        $date = (string) ($body['date'] ?? '');
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            json_response(['error' => 'date inválida (YYYY-MM-DD)'], 422);
            exit;
        }
        $actual = isset($body['actual']) ? (float) $body['actual'] : 0.0;
        if ($actual < 0) {
            json_response(['error' => 'actual no puede ser negativo'], 422);
            exit;
        }
        [$y, $mth] = array_map('intval', explode('-', $date, 3));
        $chk = db()->prepare(
            'SELECT 1 FROM recurring_fixed_expense_monthly WHERE recurring_fixed_expense_id = ? AND year = ? AND month = ?'
        );
        $chk->execute([$rid, $y, $mth]);
        if ($chk->fetch()) {
            json_response(['error' => 'Este gasto fijo ya fue registrado para ese mes'], 409);
            exit;
        }

        $category = (string) $tpl['category'];
        require_category($category);
        $monthId = get_or_create_month_id($y, $mth);
        $title = (string) $tpl['title'];
        $expected = (float) $tpl['expected_amount'];

        $stmt = db()->prepare(
            'INSERT INTO expenses (budget_month_id, expense_type, entry_date, description, expected_amount, actual_amount, category, paid)
             VALUES (?,?,?,?,?,?,?,1)'
        );
        $stmt->execute([$monthId, 'fixed', $date, $title, $expected, $actual, $category]);
        $expenseId = (int) db()->lastInsertId();

        $link = db()->prepare(
            'INSERT INTO recurring_fixed_expense_monthly (recurring_fixed_expense_id, year, month, expense_id) VALUES (?,?,?,?)'
        );
        $link->execute([$rid, $y, $mth, $expenseId]);

        json_response(['ok' => true, 'expense_id' => $expenseId]);
        exit;
    }

    if (preg_match('#^/api/recurring-fixed/(\d+)$#', $path, $m)) {
        $id = (int) $m[1];

        if ($method === 'PATCH') {
            $exists = db()->prepare('SELECT id FROM recurring_fixed_expenses WHERE id = ?');
            $exists->execute([$id]);
            if (!$exists->fetch()) {
                json_response(['error' => 'Plantilla no encontrada'], 404);
                exit;
            }
            $body = read_json_body();
            $fields = [];
            $params = [];
            if (array_key_exists('title', $body)) {
                $t = trim((string) $body['title']);
                if ($t === '' || mb_strlen($t) > 255) {
                    json_response(['error' => 'title inválido'], 422);
                    exit;
                }
                $fields[] = 'title = ?';
                $params[] = $t;
            }
            if (array_key_exists('expected_amount', $body)) {
                $ex = (float) $body['expected_amount'];
                if ($ex < 0) {
                    json_response(['error' => 'expected_amount no puede ser negativo'], 422);
                    exit;
                }
                $fields[] = 'expected_amount = ?';
                $params[] = $ex;
            }
            if (array_key_exists('category', $body)) {
                $cat = (string) $body['category'];
                require_category($cat);
                $fields[] = 'category = ?';
                $params[] = $cat;
            }
            if ($fields === []) {
                json_response(['error' => 'Sin campos para actualizar'], 422);
                exit;
            }
            $params[] = $id;
            $sql = 'UPDATE recurring_fixed_expenses SET ' . implode(', ', $fields) . ' WHERE id = ?';
            $stmt = db()->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            exit;
        }

        if ($method === 'DELETE') {
            $del = db()->prepare('DELETE FROM recurring_fixed_expenses WHERE id = ?');
            $del->execute([$id]);
            if ($del->rowCount() === 0) {
                json_response(['error' => 'Plantilla no encontrada'], 404);
                exit;
            }
            json_response(['ok' => true]);
            exit;
        }
    }

    json_response(['error' => 'Ruta no encontrada'], 404);
    exit;
};

function ensure_recurring_fixed_schema(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    db()->exec(
        'CREATE TABLE IF NOT EXISTS recurring_fixed_expenses (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL DEFAULT \'\',
            expected_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            category VARCHAR(64) NOT NULL DEFAULT \'Varios\',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS recurring_fixed_expense_monthly (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}
