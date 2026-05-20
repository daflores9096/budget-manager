<?php

declare(strict_types=1);

return static function (string $method, string $path): void {
    ensure_auth_schema();
    require_role('admin');

    if ($path === '/api/backups' && $method === 'GET') {
        download_database_backup();
        exit;
    }

    if ($path === '/api/backups/restore' && $method === 'POST') {
        restore_database_backup();
        exit;
    }

    json_response(['error' => 'Ruta no encontrada'], 404);
    exit;
};

function backup_db_config(): array
{
    $db = load_config()['db'] ?? [];
    return [
        'host' => (string) ($db['host'] ?? 'db'),
        'port' => (int) ($db['port'] ?? 3306),
        'name' => (string) ($db['name'] ?? 'budget_manager'),
        'user' => (string) ($db['user'] ?? 'budget'),
        'pass' => (string) ($db['pass'] ?? ''),
    ];
}

function run_mysql_tool(array $command, array $env, ?string $stdoutFile = null, ?string $stdinFile = null): array
{
    $descriptors = [
        0 => $stdinFile ? ['file', $stdinFile, 'r'] : ['pipe', 'r'],
        1 => $stdoutFile ? ['file', $stdoutFile, 'w'] : ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = proc_open($command, $descriptors, $pipes, null, $env);
    if (!is_resource($process)) {
        return [1, 'No se pudo iniciar la herramienta de MySQL'];
    }

    if (!$stdinFile && isset($pipes[0]) && is_resource($pipes[0])) {
        fclose($pipes[0]);
    }

    $stdout = '';
    if (!$stdoutFile && isset($pipes[1]) && is_resource($pipes[1])) {
        $stdout = stream_get_contents($pipes[1]) ?: '';
        fclose($pipes[1]);
    }

    $stderr = '';
    if (isset($pipes[2]) && is_resource($pipes[2])) {
        $stderr = stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[2]);
    }

    $code = proc_close($process);
    return [$code, trim($stderr !== '' ? $stderr : $stdout)];
}

function mysql_command_base(string $binary, array $cfg): array
{
    return [
        $binary,
        '--host=' . $cfg['host'],
        '--port=' . (string) $cfg['port'],
        '--user=' . $cfg['user'],
        '--default-character-set=utf8mb4',
    ];
}

function download_database_backup(): void
{
    $cfg = backup_db_config();
    $tmp = tempnam(sys_get_temp_dir(), 'budget-backup-');
    if ($tmp === false) {
        json_response(['error' => 'No se pudo crear el respaldo temporal'], 500);
        return;
    }

    $command = array_merge(mysql_command_base('mysqldump', $cfg), [
        '--single-transaction',
        '--quick',
        '--routines',
        '--triggers',
        '--events',
        '--add-drop-table',
        '--no-tablespaces',
        $cfg['name'],
    ]);

    [$code, $message] = run_mysql_tool($command, ['MYSQL_PWD' => $cfg['pass']], $tmp);
    if ($code !== 0) {
        @unlink($tmp);
        json_response(['error' => 'No se pudo crear el respaldo', 'detail' => $message], 500);
        return;
    }

    $filename = 'budget-manager-backup-' . date('Ymd-His') . '.sql';
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . (string) filesize($tmp));
    header('Cache-Control: no-store');
    readfile($tmp);
    @unlink($tmp);
}

function quote_mysql_identifier(string $identifier): string
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function clear_current_database(): void
{
    $pdo = db();
    $rows = $pdo
        ->query("SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()")
        ->fetchAll();

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    try {
        foreach ($rows as $row) {
            if (($row['TABLE_TYPE'] ?? '') === 'VIEW') {
                $pdo->exec('DROP VIEW IF EXISTS ' . quote_mysql_identifier((string) $row['TABLE_NAME']));
            }
        }
        foreach ($rows as $row) {
            if (($row['TABLE_TYPE'] ?? '') !== 'VIEW') {
                $pdo->exec('DROP TABLE IF EXISTS ' . quote_mysql_identifier((string) $row['TABLE_NAME']));
            }
        }
    } finally {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    }
}

function restore_database_backup(): void
{
    if (!isset($_FILES['backup']) || !is_array($_FILES['backup'])) {
        json_response(['error' => 'Archivo .sql requerido'], 422);
        return;
    }

    $file = $_FILES['backup'];
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        json_response(['error' => 'No se pudo subir el archivo', 'detail' => 'Código de subida: ' . $error], 422);
        return;
    }

    $name = (string) ($file['name'] ?? '');
    $tmpName = (string) ($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        json_response(['error' => 'Archivo subido inválido'], 422);
        return;
    }
    if (!str_ends_with(strtolower($name), '.sql')) {
        json_response(['error' => 'El archivo debe tener extensión .sql'], 422);
        return;
    }

    clear_current_database();

    $cfg = backup_db_config();
    $command = array_merge(mysql_command_base('mysql', $cfg), [
        '--binary-mode',
        $cfg['name'],
    ]);

    [$code, $message] = run_mysql_tool($command, ['MYSQL_PWD' => $cfg['pass']], null, $tmpName);
    if ($code !== 0) {
        json_response(['error' => 'No se pudo restaurar el respaldo', 'detail' => $message], 500);
        return;
    }

    json_response(['ok' => true]);
}
