<?php

declare(strict_types=1);

return static function (string $method, string $path): void {
    ensure_auth_schema();

    // GET /api/auth/me
    if ($path === '/api/auth/me' && $method === 'GET') {
        $u = auth_user();
        if (!$u) {
            json_response(['user' => null], 200);
            exit;
        }
        json_response(['user' => $u], 200);
        exit;
    }

    // POST /api/auth/login
    if ($path === '/api/auth/login' && $method === 'POST') {
        $body = read_json_body();
        $login = strtolower(trim((string) ($body['email'] ?? $body['login'] ?? $body['username'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        if ($login === '' || $password === '' || mb_strlen($login) > 190) {
            json_response(['error' => 'email/password inválidos'], 422);
            exit;
        }
        $stmt = db()->prepare('SELECT id, username, email, name, role, password_hash, disabled FROM users WHERE email = ? OR username = ? LIMIT 1');
        $stmt->execute([$login, $login]);
        $row = $stmt->fetch();
        if (!$row || !empty($row['disabled']) || !password_verify($password, (string) $row['password_hash'])) {
            json_response(['error' => 'Credenciales inválidas'], 401);
            exit;
        }
        $token = random_token(32);
        $h = token_hash($token);
        $ttl = 60 * 60 * 24 * 14; // 14 days
        $ins = db()->prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 14 DAY))');
        $ins->execute([(int) $row['id'], $h]);
        set_session_cookie($token, $ttl);
        json_response([
            'user' => [
                'id' => (int) $row['id'],
                'username' => (string) ($row['username'] ?? ''),
                'email' => (string) $row['email'],
                'name' => (string) $row['name'],
                'role' => (string) $row['role'],
            ],
            // Optional for mobile clients; web still uses HttpOnly cookie.
            'access_token' => $token,
        ]);
        exit;
    }

    // POST /api/auth/logout
    if ($path === '/api/auth/logout' && $method === 'POST') {
        $token = '';

        $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (is_string($hdr) && preg_match('/^Bearer\s+(.+)$/i', trim($hdr), $m)) {
            $token = trim((string) $m[1]);
        }
        if ($token === '') {
            $token = (string) ($_COOKIE[auth_cookie_name()] ?? '');
        }

        if ($token !== '') {
            $h = token_hash($token);
            try {
                $del = db()->prepare('DELETE FROM sessions WHERE token_hash = ?');
                $del->execute([$h]);
            } catch (Throwable $e) {
                // ignore
            }
        }
        clear_session_cookie();
        json_response(['ok' => true]);
        exit;
    }

    // POST /api/auth/forgot (dev mode: return reset_link)
    if ($path === '/api/auth/forgot' && $method === 'POST') {
        $body = read_json_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        if ($email === '' || mb_strlen($email) > 190) {
            json_response(['error' => 'email inválido'], 422);
            exit;
        }

        $stmt = db()->prepare('SELECT id, disabled FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        $resetLink = null;
        if ($row && empty($row['disabled'])) {
            $token = random_token(32);
            $h = token_hash($token);
            $ins = db()->prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 60 MINUTE))');
            $ins->execute([(int) $row['id'], $h]);
            $base = getenv('APP_BASE_URL') ?: 'http://localhost:8080';
            $resetLink = rtrim($base, '/') . '/reset-password?token=' . urlencode($token);
        }

        // Always respond ok (avoid email enumeration)
        json_response([
            'ok' => true,
            'reset_link' => $resetLink, // dev mode
        ]);
        exit;
    }

    // POST /api/auth/reset
    if ($path === '/api/auth/reset' && $method === 'POST') {
        $body = read_json_body();
        $token = (string) ($body['token'] ?? '');
        $newPassword = (string) ($body['new_password'] ?? '');
        if ($token === '' || mb_strlen($token) > 512) {
            json_response(['error' => 'token inválido'], 422);
            exit;
        }
        if (mb_strlen($newPassword) < 6) {
            json_response(['error' => 'La contraseña debe tener al menos 6 caracteres'], 422);
            exit;
        }

        $h = token_hash($token);
        $stmt = db()->prepare(
            'SELECT id, user_id
             FROM password_resets
             WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
             LIMIT 1'
        );
        $stmt->execute([$h]);
        $row = $stmt->fetch();
        if (!$row) {
            json_response(['error' => 'Token inválido o expirado'], 422);
            exit;
        }

        $ph = password_hash($newPassword, PASSWORD_DEFAULT);
        $upd = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $upd->execute([$ph, (int) $row['user_id']]);

        $mark = db()->prepare('UPDATE password_resets SET used_at = NOW() WHERE id = ?');
        $mark->execute([(int) $row['id']]);

        // Invalidate all sessions for this user
        try {
            $del = db()->prepare('DELETE FROM sessions WHERE user_id = ?');
            $del->execute([(int) $row['user_id']]);
        } catch (Throwable $e) {
            // ignore
        }

        clear_session_cookie();
        json_response(['ok' => true]);
        exit;
    }

    // POST /api/auth/bootstrap (dev only): create first admin if none exists
    if ($path === '/api/auth/bootstrap' && $method === 'POST') {
        $allow = (getenv('ALLOW_BOOTSTRAP') ?: '1') === '1';
        if (!$allow) {
            json_response(['error' => 'bootstrap disabled'], 403);
            exit;
        }
        $count = (int) db()->query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'")->fetch()['c'];
        if ($count > 0) {
            json_response(['error' => 'admin already exists'], 409);
            exit;
        }
        $body = read_json_body();
        $username = normalize_username((string) ($body['username'] ?? 'admin'));
        $email = strtolower(trim((string) ($body['email'] ?? 'admin@example.com')));
        $name = trim((string) ($body['name'] ?? 'Admin'));
        $password = (string) ($body['password'] ?? '');
        if ($username === '' || mb_strlen($username) < 3 || mb_strlen($username) > 64) {
            json_response(['error' => 'username inválido'], 422);
            exit;
        }
        if ($password === '') {
            $password = base64url_encode(random_bytes(9));
        }
        $ph = password_hash($password, PASSWORD_DEFAULT);
        $ins = db()->prepare("INSERT INTO users (username, email, name, role, password_hash) VALUES (?, ?, ?, 'admin', ?)");
        $ins->execute([$username, $email, $name, $ph]);
        json_response(['ok' => true, 'username' => $username, 'email' => $email, 'temp_password' => $password], 201);
        exit;
    }

    json_response(['error' => 'Ruta no encontrada'], 404);
    exit;
};

