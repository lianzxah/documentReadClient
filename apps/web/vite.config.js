import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Vite engineering configuration.
 *
 * Highlights:
 * - Path alias `@` -> `src`
 * - Dev proxy `/api` -> backend Fastify
 * - Production build is split into long-cacheable vendor chunks via
 *   `manualChunks`, isolating the heaviest dependencies (pdfjs / react-pdf,
 *   mermaid, bytemd, markdown pipeline, katex, i18n) so they are downloaded
 *   on demand once the user actually opens a PDF / Slidev / chat view.
 * - Heavy panels in the UI are wrapped in `React.lazy` so the entry bundle
 *   stays small; the chunks here ensure those lazy boundaries map to a
 *   stable file-name pattern that hashes only when their own deps change.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8787'

  return {
    base: './',
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },

    server: {
      host: '0.0.0.0',
      port: 5174,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },

    preview: {
      host: '0.0.0.0',
      port: 5173,
    },

    // Pre-bundle commonly used deps so cold dev start is fast and consistent.
    // NOTE: do NOT add libs that depend on CommonJS-only transitives here
    // (e.g. react-pdf -> `warning`, bytemd, mermaid). They MUST be
    // pre-bundled by Vite so the CJS->ESM interop works in dev. Lazy
    // loading is still effective in production because `React.lazy` is
    // resolved by Rollup, independent of `optimizeDeps`.
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'zustand',
        'i18next',
        'react-i18next',
        'lucide-react',
        'clsx',
        'tailwind-merge',
        'react-pdf',
        'pdfjs-dist',
        'bytemd',
        '@bytemd/react',
        'mermaid',
        'katex',
        'react-markdown',
      ],
    },

    build: {
      target: 'es2020',
      sourcemap: false,
      cssCodeSplit: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1500,
      // Drop console / debugger in production for a smaller bundle.
      minify: 'esbuild',
      assetsInlineLimit: 4096,
      // Disable modulePreload to avoid evaluation order issues under file:// in Electron.
      modulePreload: false,

      rollupOptions: {
        output: {
          // Stable file naming so long-term HTTP caching works well.
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',

          /**
           * Deterministic vendor splitting. Keys here become chunk names; we
           * group every node_modules import into ONE of the buckets below.
           * NOTE: No catch-all 'vendor' bucket — letting Rollup handle
           * remaining modules avoids circular chunk dependencies that cause
           * TDZ errors in Electron's file:// context.
           */
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined

            // 1) PDF rendering stack — heaviest single dep on the site.
            if (id.includes('pdfjs-dist') || id.includes('react-pdf')) {
              return 'vendor-pdf'
            }

            // 2) Editor ecosystem: ByteMD + Mermaid + their shared deps.
            //    Merged into one chunk to eliminate circular references.
            if (
              id.includes('mermaid') ||
              id.includes('dagre') ||
              id.includes('cytoscape') ||
              id.includes('bytemd') ||
              id.includes('@bytemd')
            ) {
              return 'vendor-editor'
            }

            // 3) Markdown rendering pipeline (chat / slide preview).
            if (
              id.includes('react-markdown') ||
              id.includes('remark') ||
              id.includes('rehype') ||
              id.includes('micromark') ||
              id.includes('mdast') ||
              id.includes('hast') ||
              id.includes('unist') ||
              id.includes('unified')
            ) {
              return 'vendor-markdown'
            }

            // 4) Math typesetting.
            if (id.includes('katex')) {
              return 'vendor-katex'
            }

            // 5) i18n runtime.
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'vendor-i18n'
            }

            // 6) React core — shared by everything, isolate for caching.
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('scheduler')
            ) {
              return 'vendor-react'
            }

            // 7) UI helpers (icons + class utilities).
            if (
              id.includes('lucide-react') ||
              id.includes('clsx') ||
              id.includes('class-variance-authority') ||
              id.includes('tailwind-merge') ||
              id.includes('react-resizable-panels') ||
              id.includes('ahooks')
            ) {
              return 'vendor-ui'
            }

            // Let Rollup handle the rest — no catch-all to avoid circular deps.
            return undefined
          },
        },
      },
    },
  }
})
