#!/bin/sh
# Sincroniza la contraseña del usuario MySQL 'budget' con MYSQL_PASSWORD del contenedor db.
# Uso en el NAS (SSH), desde la carpeta del proyecto:
#   sh scripts/sync-mysql-budget-password.sh
#
# Requiere que el contenedor db esté en marcha (nombre por defecto: budget-manager-db-1).

set -e

DB_CONTAINER="${DB_CONTAINER:-budget-manager-db-1}"

MYSQL_USER="$(docker exec "$DB_CONTAINER" printenv MYSQL_USER)"
MYSQL_DATABASE="$(docker exec "$DB_CONTAINER" printenv MYSQL_DATABASE)"
MYSQL_PASSWORD="$(docker exec "$DB_CONTAINER" printenv MYSQL_PASSWORD)"
MYSQL_ROOT_PASSWORD="$(docker exec "$DB_CONTAINER" printenv MYSQL_ROOT_PASSWORD)"

if [ -z "$MYSQL_USER" ] || [ -z "$MYSQL_DATABASE" ] || [ -z "$MYSQL_PASSWORD" ] || [ -z "$MYSQL_ROOT_PASSWORD" ]; then
  echo "No se leyeron variables MYSQL_* del contenedor $DB_CONTAINER"
  exit 1
fi

echo "Sincronizando usuario '$MYSQL_USER' en base '$MYSQL_DATABASE' …"

docker exec -e "MYSQL_PWD=${MYSQL_ROOT_PASSWORD}" "$DB_CONTAINER" \
  mysql -uroot -e "ALTER USER '${MYSQL_USER}'@'%' IDENTIFIED BY '${MYSQL_PASSWORD}'; FLUSH PRIVILEGES;"

docker exec -e "MYSQL_PWD=${MYSQL_PASSWORD}" "$DB_CONTAINER" \
  mysql -u"${MYSQL_USER}" "${MYSQL_DATABASE}" -e "SELECT 1 AS ok;"

echo "Listo. Reinicia el contenedor api:"
echo "  docker compose up -d --force-recreate api"
