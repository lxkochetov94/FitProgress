import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/FitProgress/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/fitprogress-logo-calm.jpg'],
      manifest: {
        name: 'FitProgress',
        short_name: 'FitProgress',
        description: 'Офлайн-дневник силовых тренировок: план, факт, RIR, боль, замены и Excel.',
        theme_color: '#f7f8f7',
        background_color: '#f7f8f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'brand/fitprogress-logo-calm.jpg', sizes: '128x128', type: 'image/jpeg', purpose: 'any' },
          { src: 'brand/fitprogress-logo-calm.jpg', sizes: '128x128', type: 'image/jpeg', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,gif,webp,webmanifest}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fitprogress-images',
              expiration: { maxEntries: 240, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
})
