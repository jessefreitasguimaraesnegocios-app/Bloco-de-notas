import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'CyberVault AI',
          short_name: 'CyberVault',
          description: 'Cofre seguro para notas sensíveis.',
          lang: 'pt-BR',
          dir: 'ltr',
          theme_color: '#0a0a0c',
          background_color: '#0a0a0c',
          display: 'standalone',
          display_override: ['standalone', 'browser'],
          scope: '/',
          start_url: '/',
          categories: ['productivity', 'utilities'],
          icons: [
            {src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png'},
            {src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png'},
            {src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api',
                expiration: {maxEntries: 50, maxAgeSeconds: 60 * 60 * 24}
              }
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(
        env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ''
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
