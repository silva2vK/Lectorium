
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
    plugins: [
      react(),
      nodePolyfills({
        include: ['fs', 'path'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    optimizeDeps: {
      include: ['pdfjs-dist', 'react', 'react-dom'],
      esbuildOptions: {
        target: 'esnext',
      },
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        external: ['unrar-js'],
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'lectorium-core': [
              '@tiptap/react', 
              '@tiptap/starter-kit',
              '@tiptap/extension-table',
              '@tiptap/extension-image',
              '@tiptap/extension-link',
              '@tiptap/extension-highlight',
              '@tiptap/extension-underline',
              '@tiptap/extension-text-align',
              '@tiptap/extension-placeholder',
              '@tiptap/extension-task-list',
              '@tiptap/extension-typography',
              'pdfjs-dist', 
              'pdf-lib'
            ],
            'heavy-libs': [
              'mermaid', 
              'katex', 
              'recharts', 
              'docx',
              'qrcode'
            ],
            'image-utils-1': ['heic2any', 'utif'],
            'image-utils-2': ['daikon', 'jszip'],
            'ai-sdk': ['@google/genai'],
          },
        },
      },
    },
    server: {
      port: 3000
    },
    define: {
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY),
    }
  };
});