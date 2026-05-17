#!/bin/bash
# Carga el esquema en la BD creada por MYSQL_DATABASE (usuario budget ya tiene grants ahí).
# schema_tables.sql no va como *.sql dentro de docker-entrypoint-initdb.d para que Docker no lo ejecute solo.
set -eo pipefail
export MYSQL_PWD="${MYSQL_ROOT_PASSWORD}"

echo "[budget-manager-init] Charset utf8mb4 en base \`${MYSQL_DATABASE}\` …"
mysql -uroot --protocol=socket -e "ALTER DATABASE \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "[budget-manager-init] Creando tablas en \`${MYSQL_DATABASE}\` …"
mysql -uroot --protocol=socket "${MYSQL_DATABASE}" < /init-helper/schema_tables.sql

echo "[budget-manager-init] Listo."
