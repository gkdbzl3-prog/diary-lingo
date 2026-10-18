import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 프론트는 web/ 에 있고, /api 는 Express(기본 3000번)로 넘긴다.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${process.env.PORT ?? 3000}`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
