import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const unsafeGlobalFallback = /Function\((['"])return this\1\)\(\)/g;

// Lodash 4's legacy global-object probe uses the Function constructor, which
// trips strict CSP scanners. Modern target browsers provide globalThis.
function cspSafeGlobalFallback() {
  return {
    name: 'csp-safe-global-fallback',
    enforce: 'pre' as const,
    transform(code: string) {
      if (!unsafeGlobalFallback.test(code)) return null;
      unsafeGlobalFallback.lastIndex = 0;
      return {
        code: code.replace(unsafeGlobalFallback, 'globalThis'),
        map: null,
      };
    },
    generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && output.code && unsafeGlobalFallback.test(output.code)) {
          this.error('DAG bundle contains a CSP-unsafe Function constructor fallback');
        }
        unsafeGlobalFallback.lastIndex = 0;
      }
    },
  };
}

// Builds embed.tsx into a self-contained IIFE bundle (React + react-flow + dagre
// + components + CSS all inlined) vendored to the site's assets/ dir. No CDN.
export default defineConfig({
  plugins: [cspSafeGlobalFallback(), react()],
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
