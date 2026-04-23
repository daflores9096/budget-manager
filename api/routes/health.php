<?php

declare(strict_types=1);

return static function (string $method): void {
    if ($method !== 'GET') {
        json_response(['error' => 'Method not allowed'], 405);
        exit;
    }
    db()->query('SELECT 1');
    json_response(['ok' => true]);
    exit;
};

