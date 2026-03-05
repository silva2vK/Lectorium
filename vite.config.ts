import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    // ATIVAÇÃO DO MOTOR DE ESTILO
    css: {
      postcss: './postcss.config.js',
    },
    plugins: [
      react(),
      nodePolyfills({
        include: ['fs', 'path', 'process', 'buffer', 'util', 'stream'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    resolve: {
      alias: {
        // Ajuste no alias para garantir resolução de arquivos na raiz e src
        '@': path.resolve(__dirname, './src'),
        'react-is': path.resolve(__dirname, './node_modules/react-is'),
      },
    },
    optimizeDeps: {
      include: [
        'pdfjs-dist', 
        'react', 
        'react-dom', 
        'mermaid', 
        'lucide-react', 
        '@tiptap/react',
        '@tiptap/extension-bubble-menu'
      ],
      exclude: ['pdfjs-dist'],
      needsInterop: ['lucide-react'],
      esbuildOptions: {
        target: 'esnext',
        supported: {
          'top-level-await': true
        }
      },
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        external: ['unrar-js'],
        output: {
          manualChunks(id) {
            if (id.includes('pdfjs-dist')) return 'pdf-engine';
            if (id.includes('@tiptap') || id.includes('lucide-react')) return 'vendor-ui';
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('mermaid') || id.includes('pdf-lib') || id.includes('jszip') || id.includes('docx')) return 'vendor-utils';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('@google/genai')) return 'ai-sdk';
          }
        },
      },
    },
    server: {
      port: 3000
    },
    define: {
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY),
      'global': 'window',
    }
  };
});