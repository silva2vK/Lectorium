import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    css: {
      postcss: './postcss.config.js',
    },
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'process': 'process/browser',
        'util': 'util',
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react', '@tiptap/react'],
      esbuildOptions: {
        target: 'esnext',
        supported: { 'top-level-await': true },
        // Corrigido: Literais JS puros para o esbuild
        define: {
          global: 'globalThis',
          process: '({})'
        },
      },
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            'pdf-engine': ['pdfjs-dist'],
            'ui-vendor': ['lucide-react', '@tiptap/react'],
          }
        }
      }
    },
    define: {
      // Injeção segura de variáveis de ambiente
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    }
  };
});