/// <reference types="vitest/config" />
import { readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * `public/data/raw` holds the source Findex workbook used by `npm run data:build`. The app only
 * reads `public/data/processed`, so the workbook (~18 MB) must never be published.
 */
function excludeRawData(): Plugin {
  let outDir = 'dist'
  return {
    name: 'finlens:exclude-raw-data',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      rmSync(resolve(outDir, 'data/raw'), { recursive: true, force: true })
    },
  }
}

/**
 * The security headers from public/_headers (the `/*` block), so `vite preview` — and therefore
 * the end-to-end tests — run under the same Content-Security-Policy as production.
 * `upgrade-insecure-requests` is dropped because the preview is served over plain http.
 */
function productionHeaders(): Record<string, string> {
  const text = readFileSync(new URL('./public/_headers', import.meta.url), 'utf8')
  const block = text.split(/^\/\*\s*$/m)[1]?.split(/^\S/m)[0] ?? ''
  const headers: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const m = /^\s+([\w-]+):\s*(.+)$/.exec(line)
    if (m) headers[m[1]!] = m[2]!.replace(/;?\s*upgrade-insecure-requests/, '')
  }
  return headers
}

export default defineConfig({
  preview: { headers: productionHeaders() },
  plugins: [react(), tailwindcss(), excludeRawData()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // Source maps add ~7 MB; build with SOURCEMAP=true when debugging a production issue.
    sourcemap: process.env.SOURCEMAP === 'true',
    rollupOptions: {
      output: {
        // Keep heavy visualization libraries out of the initial bundle.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // Tiny helpers shared by the shell and the chart libraries live with React so the
          // first paint never has to download Recharts or D3.
          if (/[\\/](clsx|tailwind-merge|use-sync-external-store|react-is)[\\/]/.test(id))
            return 'vendor-react'
          if (/[\\/](d3-|d3[\\/]|topojson)/.test(id)) return 'vendor-d3'
          if (/[\\/](recharts|victory-vendor)[\\/]/.test(id)) return 'vendor-recharts'
          if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return 'vendor-react'
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // UI primitives and page shells are covered by the Playwright suite (tests/e2e).
      exclude: ['src/**/*.test.*', 'src/components/ui/**', 'src/main.tsx', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'html', 'lcov'],
      // Business logic is held to a high bar; `npm run test:coverage` fails below these.
      thresholds: {
        'src/lib/**/*.ts': { lines: 85 },
        'src/features/**/*.logic.ts': { lines: 85 },
        'src/data/**/*.ts': { lines: 75 },
      },
    },
  },
})
