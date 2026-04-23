import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'EoniWidget',
      formats: ['iife'],
      fileName: () => 'widget',
    },
    outDir: '../public',
    emptyOutDir: false, // CRITICAL — never wipe public/, Nuxt owns it
    rollupOptions: {
      output: {
        entryFileNames: 'widget.js',
        inlineDynamicImports: true,
      },
    },
    minify: 'terser',
    target: 'es2017',
  },
})
