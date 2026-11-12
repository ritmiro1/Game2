import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()], base: './',
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app', 'localhost'], proxy: { '/api': 'http://127.0.0.1:3101' } },
  build: { target: 'es2022', sourcemap: true },
});
