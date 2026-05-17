#!/bin/sh
# Antes de Apache: crear config.local.php desde variables del contenedor (getenv()
# en CLI sí ve el entorno Docker; Synology/mod_php a veces no).
set -e
php /usr/local/bin/write-config-from-env.php
exec docker-php-entrypoint "$@"
