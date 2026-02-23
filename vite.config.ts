
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
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
      minify: 'esbuild',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'tiptap-core': ['@tiptap/react', '@tiptap/core', '@tiptap/pm'],
            'tiptap-extensions': [
              '@tiptap/starter-kit',
              '@tiptap/extension-table',
              '@tiptap/extension-table-row',
              '@tiptap/extension-table-cell',
              '@tiptap/extension-table-header',
              '@tiptap/extension-image',
              '@tiptap/extension-link',
              '@tiptap/extension-highlight',
              '@tiptap/extension-underline',
              '@tiptap/extension-text-align',
              '@tiptap/extension-placeholder',
              '@tiptap/extension-task-list',
              '@tiptap/extension-task-item',
              '@tiptap/extension-typography',
              '@tiptap/extension-color',
              '@tiptap/extension-text-style',
              '@tiptap/extension-font-family',
              '@tiptap/extension-subscript',
              '@tiptap/extension-superscript',
              '@tiptap/extension-character-count',
              '@tiptap/extension-dropcursor',
              '@tiptap/extension-gapcursor',
              '@tiptap/extension-collaboration',
              '@tiptap/extension-collaboration-cursor',
              '@tiptap/extension-horizontal-rule',
              '@tiptap/extension-heading',
              '@tiptap/extension-code-block-lowlight'
            ],
            'pdf-engine': ['pdfjs-dist'],
            'pdf-lib': ['pdf-lib'],
            'gemini-sdk': ['@google/genai'],
            'visualization': ['mermaid', 'recharts', 'katex'],
            'document-utils': ['docx', 'jszip', 'qrcode'],
            'image-processing': ['heic2any', 'utif', 'daikon']
          },
        },
      },
    },
    server: {
      port: 3000,
      hmr: {
        clientPort: 443,
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY),
    }
  };
});