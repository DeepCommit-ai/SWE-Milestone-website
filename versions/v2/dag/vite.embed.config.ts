import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Builds embed.tsx into a self-contained IIFE bundle (React + react-flow + dagre
// + components + CSS all inlined) vendored to the site's assets/ dir. No CDN.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: path.resolve(__dirname, '../../../assets'),
    emptyOutDir: false,
    cssCodeSplit: false,
    minify: true,
    lib: {
      entry: path.resolve(__dirname, 'embed.tsx'),
      name: 'MstoneDAGBundle',
      formats: ['iife'],
      fileName: () => 'mstone-dag.js',
    },
    rollupOptions: {
      output: { assetFileNames: 'mstone-dag.[ext]' },
    },
  },
});
