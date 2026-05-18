<?php

declare(strict_types=1);

return static function (string $method): void {
    if ($method !== 'GET') {
        json_response(['error' => 'Method not allowed'], 405);
        exit;
    }
    $c = load_config()['db'];
    db()->query('SELECT 1');

    $debug = isset($_GET['debug']) && $_GET['debug'] === '1'
        && (getenv('ALLOW_BOOTSTRAP') === '1' || getenv('ALLOW_BOOTSTRAP') === 'true');

    $payload = ['ok' => true];
    if ($debug) {
        $payload['db'] = [
            'host' => $c['host'],
            'name' => $c['name'],
            'user' => $c['user'],
            'password_configured' => $c['pass'] !== '',
            'config_source' => is_file(dirname(__DIR__) . '/config.local.php') ? 'config.local.php' : 'env',
        ];
    }

    json_response($payload);
    exit;
};

