<?php

declare(strict_types=1);

return static function (string $method, string $path): void {
    ensure_auth_schema();
    require_role('admin');

    if ($path === '/api/users' && $method === 'GET') {
        $stmt = db()->query('SELECT id, username, email, name, role, disabled, created_at, updated_at FROM users ORDER BY id ASC');
        $rows = $stmt->fetchAll();
        foreach ($rows as &$u) {
            $u['id'] = (int) $u['id'];
            $u['username'] = (string) ($u['username'] ?? '');
            $u['email'] = (string) $u['email'];
            $u['name'] = (string) $u['name'];
            $u['role'] = (string) $u['role'];
            $u['disabled'] = (int) $u['disabled'] ? true : false;
        }
        unset($u);
        json_response(['users' => $rows]);
        exit;
    }

    if ($path === '/api/users' && $method === 'POST') {
        $body = read_json_body();
        $username = normalize_username((string) ($body['username'] ?? ''));
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $name = trim((string) ($body['name'] ?? ''));
        $role = (string) ($body['role'] ?? 'appuser');
        $password = (string) ($body['password'] ?? '');
        if ($username === '' || mb_strlen($username) < 3 || mb_strlen($username) > 64) {
            json_response(['error' => 'username inválido'], 422);
            exit;
        }
        if ($email === '' || mb_strlen($email) > 190) {
            json_response(['error' => 'email inválido'], 422);
            exit;
        }
        if ($role !== 'admin' && $role !== 'appuser') {
            json_response(['error' => 'role inválido'], 422);
            exit;
        }
        if ($password === '') {
            $password = base64url_encode(random_bytes(9));
        }
        if (mb_strlen($password) < 6) {
            json_response(['error' => 'password muy corto'], 422);
            exit;
        }
        $ph = password_hash($password, PASSWORD_DEFAULT);
        try {
            $ins = db()->prepare('INSERT INTO users (username, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)');
            $ins->execute([$username, $email, $name, $role, $ph]);
        } catch (PDOException $e) {
            if ((string) $e->getCode() === '23000') {
                json_response(['error' => 'Ese email o username ya existe'], 409);
                exit;
            }
            throw $e;
        }
        $id = (int) db()->lastInsertId();
        json_response(['id' => $id, 'username' => $username, 'email' => $email, 'name' => $name, 'role' => $role, 'temp_password' => $password], 201);
        exit;
    }

    if (preg_match('#^/api/users/(\d+)$#', $path, $m)) {
        $id = (int) $m[1];

        if ($method === 'PATCH') {
            $body = read_json_body();
            $fields = [];
            $params = [];

            if (array_key_exists('username', $body)) {
                $username = normalize_username((string) $body['username']);
                if ($username === '' || mb_strlen($username) < 3 || mb_strlen($username) > 64) {
                    json_response(['error' => 'username inválido'], 422);
                    exit;
                }
                $fields[] = 'username = ?';
                $params[] = $username;
            }

            if (array_key_exists('email', $body)) {
                $email = strtolower(trim((string) $body['email']));
                if ($email === '' || mb_strlen($email) > 190) {
                    json_response(['error' => 'email inválido'], 422);
                    exit;
                }
                $fields[] = 'email = ?';
                $params[] = $email;
            }

            if (array_key_exists('name', $body)) {
                $name = trim((string) $body['name']);
                if (mb_strlen($name) > 120) {
                    json_response(['error' => 'name inválido'], 422);
                    exit;
                }
                $fields[] = 'name = ?';
                $params[] = $name;
            }

            if (array_key_exists('role', $body)) {
                $role = (string) $body['role'];
                if ($role !== 'admin' && $role !== 'appuser') {
                    json_response(['error' => 'role inválido'], 422);
                    exit;
                }
                $fields[] = 'role = ?';
                $params[] = $role;
            }

            if (array_key_exists('disabled', $body)) {
                $fields[] = 'disabled = ?';
                $params[] = !empty($body['disabled']) ? 1 : 0;
            }

            if (array_key_exists('password', $body)) {
                $pw = (string) $body['password'];
                if (mb_strlen($pw) < 6) {
                    json_response(['error' => 'password muy corto'], 422);
                    exit;
                }
                $fields[] = 'password_hash = ?';
                $params[] = password_hash($pw, PASSWORD_DEFAULT);
            }

            if ($fields === []) {
                json_response(['error' => 'Sin campos para actualizar'], 422);
                exit;
            }

            $params[] = $id;
            $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
            try {
                $stmt = db()->prepare($sql);
                $stmt->execute($params);
            } catch (PDOException $e) {
                if ((string) $e->getCode() === '23000') {
                    json_response(['error' => 'Ese email o username ya existe'], 409);
                    exit;
                }
                throw $e;
            }

            if ($stmt->rowCount() === 0) {
                // Could be no-op; verify existence
                $chk = db()->prepare('SELECT 1 FROM users WHERE id = ?');
                $chk->execute([$id]);
                if (!$chk->fetchColumn()) {
                    json_response(['error' => 'Usuario no encontrado'], 404);
                    exit;
                }
            }

            json_response(['ok' => true]);
            exit;
        }

        if ($method === 'DELETE') {
            // Prefer disable; but implement delete as requested
            $del = db()->prepare('DELETE FROM users WHERE id = ?');
            $del->execute([$id]);
            if ($del->rowCount() === 0) {
                json_response(['error' => 'Usuario no encontrado'], 404);
                exit;
            }
            json_response(['ok' => true]);
            exit;
        }
    }

    if (preg_match('#^/api/users/(\d+)/reset-password$#', $path, $m) && $method === 'POST') {
        $id = (int) $m[1];
        $body = read_json_body();
        $pw = (string) ($body['password'] ?? '');
        if ($pw === '') {
            $pw = base64url_encode(random_bytes(9));
        }
        if (mb_strlen($pw) < 6) {
            json_response(['error' => 'password muy corto'], 422);
            exit;
        }
        $chk = db()->prepare('SELECT 1 FROM users WHERE id = ?');
        $chk->execute([$id]);
        if (!$chk->fetchColumn()) {
            json_response(['error' => 'Usuario no encontrado'], 404);
            exit;
        }
        $ph = password_hash($pw, PASSWORD_DEFAULT);
        $upd = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $upd->execute([$ph, $id]);
        // Invalidate sessions
        try {
            $del = db()->prepare('DELETE FROM sessions WHERE user_id = ?');
            $del->execute([$id]);
        } catch (Throwable $e) {
            // ignore
        }
        json_response(['ok' => true, 'temp_password' => $pw]);
        exit;
    }

    json_response(['error' => 'Ruta no encontrada'], 404);
    exit;
};

