import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // split the stable stuff out so routine updates only invalidate the
        // app chunk: vendor (react etc) and data (the squad database) change
        // far less often than game code
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
          if (id.includes('/src/data/')) return 'data'
        },
      },
    },
  },
})
