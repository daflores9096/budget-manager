FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite env

WORKDIR /var/www/html

COPY api/lib.php api/config.example.php ./
COPY api/public/ ./public/
COPY api/routes/ ./routes/

COPY docker/php/000-default.conf /etc/apache2/sites-available/000-default.conf
COPY docker/php/write-config-from-env.php /usr/local/bin/write-config-from-env.php
COPY docker/php/docker-entrypoint-budget.sh /usr/local/bin/docker-entrypoint-budget.sh

# CRLF en Windows rompe el shebang → "exec ... no such file or directory"
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint-budget.sh \
    && chmod +x /usr/local/bin/docker-entrypoint-budget.sh \
    && chown -R www-data:www-data /var/www/html

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-budget.sh"]
CMD ["apache2-foreground"]
