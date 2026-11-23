import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: { rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], supabase: ['@supabase/supabase-js'], motion: ['framer-motion'] } } } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand-mark.svg', 'pill.svg', 'icons/pill-3d.png', 'icons/droplet-3d.png'],
      manifest: {
        name: 'MEDControl',
        short_name: 'MEDControl',
        description: 'Lembrete de medicamentos no celular, pensado para facilitar o dia a dia.',
        lang: 'pt-BR',
        theme_color: '#087f83',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand-mark.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        importScripts: ['/push-sw.js'],
        navigateFallbackDenylist: [/^\/auth\//],
      },
    }),
  ],
})
