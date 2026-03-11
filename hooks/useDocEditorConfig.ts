
import { useState, useEffect, useMemo } from 'react';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { FontFamily } from '@tiptap/extension-font-family';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CharacterCount } from '@tiptap/extension-character-count';
import { Typography } from '@tiptap/extension-typography';
import { Dropcursor } from '@tiptap/extension-dropcursor';
import { Focus } from '@tiptap/extension-focus';
import { Gapcursor } from '@tiptap/extension-gapcursor';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

import { FontSize, LineHeight, Indent, PageBreak, FootnoteSeparator, MathExtension, MermaidExtension, QrCodeExtension, ParagraphExtended, HeadingExtended, SectionBreak, ABNTBlockquote, CodeBlockExtension, UniqueIdExtension, TrailingNodeExtension, ChartExtension, ColumnsExtension } from '../components/doc/extensions/customExtensions';
import { CustomImage } from '../components/doc/extensions/CustomImage'; 
import { PaginationExtension } from '../components/doc/extensions/PaginationExtension';
import { TableOfContentsExtension } from '../components/doc/extensions/TableOfContentsExtension';
import { FootnoteExtension } from '../components/doc/extensions/FootnoteExtension';
import { CommentExtension } from '../components/doc/extensions/CommentExtension';

interface UserInfo {
  name: string;
  color: string;
}

interface UseDocEditorConfigProps {
  onUpdate?: () => void;
  fileId: string;
  userInfo: UserInfo;
  onTableDoubleClick?: () => void; // Nova prop
}

export const useDocEditorConfig = ({ onUpdate, fileId, userInfo, onTableDoubleClick }: UseDocEditorConfigProps) => {
  const [spellCheck, setSpellCheck] = useState(true);
  const [language, setLanguage] = useState('pt-BR');

  // Setup Yjs
  const ydoc = useMemo(() => new Y.Doc(), [fileId]);
  
  // Setup WebRTC Provider
  // Disable for local files to prevent network spam and errors
  const provider = useMemo(() => {
    if (!fileId || fileId.startsWith('local-') || fileId.startsWith('new-')) return null;
    return new WebrtcProvider(`drive-workspace-${fileId}`, ydoc);
  }, [fileId, ydoc]);

  useEffect(() => {
    return () => {
      provider?.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  const editor = useEditor({
    autofocus: 'start', // Garante foco inicial
    extensions: [
      StarterKit.configure({
        dropcursor: false,
        paragraph: false,
        heading: false, // Disable default heading
        blockquote: false,
        history: false, 
        codeBlock: false,
        gapcursor: false, 
      }),
      UniqueIdExtension,
      TrailingNodeExtension,
      Gapcursor,
      CodeBlockExtension,
      Collaboration.configure({
        document: ydoc,
      }),
      // Only attach Cursor extension if provider is active
      ...(provider ? [
        CollaborationCursor.configure({
          provider: provider,
          user: userInfo,
        })
      ] : []),
      ParagraphExtended,
      HeadingExtended,
      ABNTBlockquote,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph', 'image'], defaultAlignment: 'justify' }),
      CustomImage.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            backgroundColor: {
              default: null,
              parseHTML: element => element.style.backgroundColor || null,
              renderHTML: attributes => {
                if (!attributes.backgroundColor) return {};
                return { style: `background-color: ${attributes.backgroundColor}` };
              },
            },
          }
        }
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize,
      LineHeight,
      Indent,
      PageBreak,
      SectionBreak,
      FootnoteSeparator, 
      PaginationExtension.configure({
          pageHeight: 1123,      // A4 padrão, será atualizado pelo DocEditor
          pageMarginTop: 96,
          pageMarginBottom: 96,
          pageGap: 20,
      }),
      Subscript,
      Superscript,
      MathExtension,
      MermaidExtension,
      QrCodeExtension,
      ChartExtension, 
      ColumnsExtension,
      TableOfContentsExtension,
      FootnoteExtension,
      CommentExtension,
      Placeholder.configure({
        // E3: Placeholder por tipo de nó
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            const level = node.attrs.level;
            if (level === 1) return 'Título 1 — Seção primária (ABNT: maiúsculas)';
            if (level === 2) return 'Título 2 — Seção secundária';
            if (level === 3) return 'Título 3 — Seção terciária';
            return 'Título';
          }
          if (node.type.name === 'blockquote') {
            return 'Citação direta longa — recuo 4cm, fonte 10pt, espaçamento 1.0 (ABNT NBR 10520)';
          }
          return "Digite '/' para comandos ou comece a escrever...";
        },
        includeChildren: true,
      }),
      CharacterCount,
      Typography,
      Dropcursor.configure({
        color: 'var(--brand)',
        width: 2,
      }),
      // E4: Focus — adiciona classe 'has-focus' no nó ativo para destaque visual no tablet
      Focus.configure({
        className: 'has-focus',
        mode: 'shallowest',
      }),
    ],
    editorProps: {
        attributes: {
            // Adicionado white-space: pre-wrap para renderizar \t corretamente
            class: 'focus:outline-none doc-content notranslate',
            style: 'min-height: 100%; white-space: pre-wrap; tab-size: 4;',
            spellcheck: spellCheck.toString(),
            lang: language,
            translate: 'no'
        },
        handleDOMEvents: {
          dblclick: (view, event) => {
            const target = event.target as HTMLElement;
            // Check if the double click was inside a table cell/header
            if (target.closest('td') || target.closest('th')) {
              if (onTableDoubleClick) {
                onTableDoubleClick();
                // Opcional: retornar true se quiser impedir a seleção nativa de texto do browser
                // return true; 
              }
            }
            return false;
          }
        }
    },
    onUpdate: () => {
        if (onUpdate) onUpdate();
    }
  }, [fileId, provider]); // Re-create if provider changes (e.g. going online/saved)

  useEffect(() => {
    if (editor && editor.view.dom) {
       editor.view.dom.style.padding = '0'; 
       editor.view.dom.style.backgroundColor = 'transparent';
       editor.view.dom.style.lineHeight = '1.5'; 
       editor.view.dom.style.fontSize = '12pt';
       editor.view.dom.style.fontFamily = '"Times New Roman", Times, serif';
       editor.view.dom.style.color = '#000000'; 
       
       editor.view.dom.setAttribute('spellcheck', spellCheck.toString());
       editor.view.dom.setAttribute('lang', language);
    }
  }, [editor, spellCheck, language]);

  // F1: Listener para injeção de conteúdo Markdown do Sintetizador Lexicográfico
  // Disparo: OperationalArchive → window.dispatchEvent('inject-markdown-to-doc', { fileId, markdown })
  useEffect(() => {
    if (!editor || !fileId) return;

    const handleInject = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.markdown) return;
      // Só injeta se o evento for para este documento
      if (detail.fileId && detail.fileId !== fileId) return;

      // Insere no cursor atual; se nada selecionado, insere ao final
      const { from } = editor.state.selection;
      if (from > 0) {
        editor.chain().focus().insertContentAt(from, detail.markdown).run();
      } else {
        editor.chain().focus().insertContent(detail.markdown).run();
      }
    };

    window.addEventListener('inject-markdown-to-doc', handleInject);
    return () => window.removeEventListener('inject-markdown-to-doc', handleInject);
  }, [editor, fileId]);

  return {
    editor,
    spellCheck,
    setSpellCheck,
    language,
    setLanguage
  };
};
