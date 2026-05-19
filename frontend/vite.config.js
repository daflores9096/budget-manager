import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Docker local: WEB_PORT=18080 en .env → proxy debe apuntar al mismo puerto (no 8080).
  const apiProxyTarget = env.VITE_DEV_API_PROXY || 'http://127.0.0.1:18080';

  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg'],
      manifest: {
        name: 'Budget Manager',
        short_name: 'Presupuesto',
        description: 'Gastos, ingresos y presupuesto mensual.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#eefaf8',
        theme_color: '#0f766e',
        icons: [
          {
            src: '/app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Never treat API routes as navigation fallbacks.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // Cache-first for static assets.
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'style' ||
              request.destination === 'script' ||
              request.destination === 'image' ||
              url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // Network-first for API (keep data fresh).
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
};
});
