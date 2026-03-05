import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

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
      nodePolyfills({
        // Reduzimos ao essencial para evitar conflitos de caminho no esbuild
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      // REMOVEMOS o pdfjs-dist do include/exclude aqui para deixar o Vite tratar nativamente
      include: [
        'react', 
        'react-dom', 
        'lucide-react', 
        '@tiptap/react'
      ],
      esbuildOptions: {
        target: 'esnext',
        supported: {
          'top-level-await': true
        },
        // Esta é a chave: impede o esbuild de travar em polyfills de terceiros
        external: ['unrar-js'] 
      },
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
      rollupOptions: {
        // Garantimos que essas libs não quebrem o empacotamento
        external: ['unrar-js'],
        output: {
          manualChunks: {
            'pdf-vendor': ['pdfjs-dist'],
            'ui-vendor': ['lucide-react', '@tiptap/react'],
          }
        }
      }
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'global': 'window',
    }
  };
});