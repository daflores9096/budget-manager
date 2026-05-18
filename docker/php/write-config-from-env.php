#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Ejecutado al iniciar el contenedor API (CLI tiene el entorno de Docker intacto).
 * Escribe api/config.local.php para que PDO use las credenciales aunque Apache no exporte PASSENV.
 */

$cfg = [
    'db' => [
        'host' => getenv('DB_HOST') !== false && getenv('DB_HOST') !== ''
            ? (string) getenv('DB_HOST')
            : 'db',
        'port' => getenv('DB_PORT') !== false && getenv('DB_PORT') !== ''
            ? (int) getenv('DB_PORT')
            : 3306,
        'name' => getenv('DB_NAME') !== false && getenv('DB_NAME') !== ''
            ? (string) getenv('DB_NAME')
            : 'budget_manager',
        'user' => getenv('DB_USER') !== false && getenv('DB_USER') !== ''
            ? (string) getenv('DB_USER')
            : 'budget',
        'pass' => getenv('DB_PASS') !== false ? (string) getenv('DB_PASS') : '',
        'charset' => 'utf8mb4',
    ],
];

$path = '/var/www/html/config.local.php';

// Solo la sección db; load_config() combina con getenv() y usa estos valores si getenv falla.
$content = "<?php\n\ndeclare(strict_types=1);\n\nreturn " . var_export($cfg, true) . ";\n";

if (file_put_contents($path, $content) === false) {
    fwrite(STDERR, "write-config-from-env: no se pudo escribir {$path}\n");
    exit(1);
}

fwrite(
    STDERR,
    sprintf(
        "write-config-from-env: db host=%s name=%s user=%s pass_len=%d\n",
        $cfg['db']['host'],
        $cfg['db']['name'],
        $cfg['db']['user'],
        strlen($cfg['db']['pass'])
    )
);
