#!/bin/bash
# Alternativa manual si no usas el montaje directo de schema_tables.sql en compose.
# En Windows guardar con LF (ver .gitattributes).
set -eo pipefail
export MYSQL_PWD="${MYSQL_ROOT_PASSWORD}"
mysql -uroot --protocol=socket -e "ALTER DATABASE \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -uroot --protocol=socket "${MYSQL_DATABASE}" < /init-helper/schema_tables.sql
