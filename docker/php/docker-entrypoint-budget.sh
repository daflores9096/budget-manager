#!/bin/sh
set -e
php /usr/local/bin/write-config-from-env.php
exec docker-php-entrypoint "$@"
