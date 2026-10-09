import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

import { devSolutions } from './tools/devSolutions.ts'

export default defineConfig({
  // 사용자 개발 서버와 Playwright 서버의 의존성 묶음 분리
  cacheDir: process.env.CUBOUND_E2E ? 'node_modules/.vite-e2e' : undefined,
  plugins: [react(), tailwindcss(), devSolutions()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
