
import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { useDocEditorConfig } from '../hooks/useDocEditorConfig';
import { useDocFileHandler } from '../hooks/useDocFileHandler';
import { usePageLayout, PageLayoutState } from '../hooks/usePageLayout';
import { useDocUI } from '../hooks/useDocUI';
import { useSlideNavigation } from '../hooks/useSlideNavigation';
import { CommentData } from '../components/doc/CommentsSidebar';
import { Reference, EditorStats, MIME_TYPES } from '../types';
import { auth } from '../firebase';
import { generateDocxBlob } from '../services/docxService';
import { PageSettings } from '../components/doc/modals/PageSetupModal';
import { getDb } from '../services/db';

interface DocEditorContextProps {
  // Core
  editor: Editor | null;
  fileId: string;
  fileName: string;
  currentName: string;
  setCurrentName: (name: string) => void;
  userInfo: { name: string; color: string };
  isLocalFile: boolean;
  
  // States
  comments: CommentData[];
  references: Reference[];
  setReferences: React.Dispatch<React.SetStateAction<Reference[]>>;
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  activeHeaderFooterTab: 'header' | 'footer';
  setActiveHeaderFooterTab: (tab: 'header' | 'footer') => void;
  isSharing: boolean;
  currentPage: number;
  stats: EditorStats;
  
  // UI & Layout
  ui: ReturnType<typeof useDocUI>;
  layout: ReturnType<typeof usePageLayout>;
  fileHandler: ReturnType<typeof useDocFileHandler>;
  spellCheck: boolean;
  setSpellCheck: (v: boolean) => void;
  
  // Refs
  contentRef: React.RefObject<HTMLDivElement>;
  docScrollerRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  
  // Actions
  nextPage: () => void;
  prevPage: () => void;
  handleJumpToPage: (page: number) => void;
  handleApplyColumns: (count: number) => void;
  handleAddComment: (text: string) => void;
  triggerImageUpload: () => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleNativeShare: () => Promise<void>;
  handleVersionRestore: (content: any) => void;
  handleHeaderFooterApply: (header: string, footer: string) => void;
  insertFootnote: (content: string) => void;
  handleInsertBibliography: () => Promise<void>;
  
  // Navigation Callbacks (from props)
  onToggleMenu: () => void;
  onBack?: () => void;
}

const DocEditorContext = createContext<DocEditorContextProps | null>(null);

export const useDocEditorContext = () => {
  const context = useContext(DocEditorContext);
  if (!context) throw new Error("useDocEditorContext must be used within a DocEditorProvider");
  return context;
};

interface ProviderProps {
  children: React.ReactNode;
  fileId: string;
  fileName: string;
  fileBlob?: Blob;
  accessToken: string;
  fileParents?: string[];
  onToggleMenu: () => void;
  onAuthError?: () => void;
  onBack?: () => void;
}

export const DocEditorProvider: React.FC<ProviderProps> = ({
  children, fileId, fileName, fileBlob, accessToken, fileParents, onToggleMenu, onAuthError, onBack
}) => {
  const isLocalFile = fileId.startsWith('local-') || !accessToken;
  const [comments, setComments] = useState<CommentData[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [activeHeaderFooterTab, setActiveHeaderFooterTab] = useState<'header' | 'footer'>('header');
  const [isSharing, setIsSharing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState<EditorStats>({ words: 0, chars: 0, charsNoSpace: 0, readTime: 0 });
  
  const contentRef = useRef<HTMLDivElement>(null);
  const docScrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userInfo = useMemo(() => {
    const u = auth.currentUser;
    return { name: u?.displayName || 'Visitante', color: '#4ade80' };
  }, []);

  // --- Hooks Initialization ---
  const ui = useDocUI();
  
  const { editor, spellCheck, setSpellCheck } = useDocEditorConfig({ 
    fileId, 
    userInfo,
    onTableDoubleClick: () => ui.toggleModal('tableProperties', true),
    onUpdate: () => {
        // Update stats reactively
        if (editor) {
            const words = editor.storage.characterCount.words();
            const chars = editor.storage.characterCount.characters();
            setStats({ 
                words, 
                chars, 
                charsNoSpace: chars - (words - 1), // Aproximação simples ou usar lógica customizada
                readTime: Math.ceil(words / 200) 
            });
        }
    }
  });

  // Initial stats load
  useEffect(() => {
      if (editor) {
          const words = editor.storage.characterCount.words();
          const chars = editor.storage.characterCount.characters();
          setStats({ words, chars, charsNoSpace: chars, readTime: Math.ceil(words / 200) });
      }
  }, [editor]);

  const layout = usePageLayout({
    editor,
    initialSettings: { paperSize: 'a4', orientation: 'portrait', pageColor: '#ffffff', marginTop: 3, marginBottom: 2, marginLeft: 3, marginRight: 2 },
    contentRef
  });

  const fileHandler = useDocFileHandler({
    editor, fileId, fileName, fileBlob, accessToken, isLocalFile, fileParents, onAuthError, onBack,
    onFitWidth: layout.handleFitWidth, 
    onLoadSettings: layout.setPageSettings,
    onLoadComments: setComments, 
    onLoadReferences: setReferences
  });

  // --- Navigation Logic ---
  const { nextPage, prevPage } = useSlideNavigation({
    currentPage,
    totalPages: layout.totalPages,
    isSlideMode: true,
    onPageChange: (newPage) => {
      setCurrentPage(newPage);
      if (docScrollerRef.current) {
          docScrollerRef.current.scrollTop = 0;
      }
    }
  });

  const handleJumpToPage = useCallback((page: number) => {
      const target = Math.max(1, Math.min(page, layout.totalPages));
      setCurrentPage(target);
  }, [layout.totalPages]);

  // --- Auto Pagination Effect ---
  useEffect(() => {
    if (!editor) return;

    const checkCursorPage = () => {
        if (!editor || editor.isDestroyed || !editor.view) return;

        const { selection, doc } = editor.state;
        const { from } = selection;
        if (from < 0 || from > doc.content.size) return;

        try {
            const pageHeight = layout.currentPaper.heightPx;
            const pageGap = 20;
            const totalUnit = pageHeight + pageGap;

            const domResult = editor.view.domAtPos(from);
            const domNode = domResult.node;
            const element = (domNode instanceof HTMLElement ? domNode : domNode.parentElement) as HTMLElement;
            
            if (element) {
                let offsetTop = element.offsetTop;
                let currentEl = element;
                
                while(currentEl && !currentEl.classList.contains('ProseMirror') && currentEl.parentElement) {
                    currentEl = currentEl.parentElement;
                    offsetTop += currentEl.offsetTop;
                }

                const calculatedPage = Math.floor(offsetTop / totalUnit) + 1;

                if (calculatedPage !== currentPage && calculatedPage >= 1 && calculatedPage <= layout.totalPages) {
                    setCurrentPage(calculatedPage);
                    if (docScrollerRef.current) docScrollerRef.current.scrollTop = 0;
                }
            }
        } catch (e) {}
    };

    editor.on('selectionUpdate', checkCursorPage);
    editor.on('update', checkCursorPage);

    return () => { 
        editor.off('selectionUpdate', checkCursorPage); 
        editor.off('update', checkCursorPage);
    }
  }, [editor, currentPage, layout.currentPaper.heightPx, layout.totalPages]);

  // --- Event Listeners ---
  useEffect(() => {
      const handleRegionEdit = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          if (detail && detail.type) {
              setActiveHeaderFooterTab(detail.type);
              ui.toggleModal('headerFooter', true);
          }
      };
      window.addEventListener('edit-region', handleRegionEdit);
      return () => window.removeEventListener('edit-region', handleRegionEdit);
  }, [ui]);

  // --- Action Handlers ---

  const handleApplyColumns = (count: number) => {
    if (!editor) return;
    if (count === 1) {
        (editor.chain().focus() as any).unsetColumns().run();
    } else {
        (editor.chain().focus() as any).setColumns(count).run();
    }
  };

  const handleAddComment = useCallback((text: string) => {
    if (!editor) return;
    const id = `comment-${Date.now()}`;
    (editor.chain().focus() as any).setComment(id).run();
    setComments(prev => [...prev, { id, text, author: userInfo.name, createdAt: new Date().toISOString() }]);
    setActiveCommentId(id);
  }, [editor, userInfo.name]);

  const triggerImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editor) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        if (src) {
          editor.chain().focus().setImage({ src }).run();
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  }, [editor]);

  const handleNativeShare = useCallback(async () => {
    if (!editor) return;
    setIsSharing(true);
    try {
      const json = editor.getJSON();
      const blob = await generateDocxBlob(json, layout.pageSettings, comments, references);
      const fileNameWithExt = fileHandler.currentName.endsWith('.docx') ? fileHandler.currentName : `${fileHandler.currentName}.docx`;
      const file = new File([blob], fileNameWithExt, { type: MIME_TYPES.DOCX });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileHandler.currentName, text: 'Documento compartilhado via Lectorium' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileNameWithExt;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') { alert("Não foi possível compartilhar o arquivo."); }
    } finally {
      setIsSharing(false);
    }
  }, [editor, fileHandler.currentName, layout.pageSettings, comments, references]);

  const handleVersionRestore = useCallback((content: any) => {
      if (editor) {
          editor.commands.setContent(content);
      }
  }, [editor]);

  const handleHeaderFooterApply = (header: string, footer: string) => {
      layout.setPageSettings(prev => ({ ...prev, headerText: header, footerText: footer }));
  };

  const insertFootnote = (content: string) => {
      if (editor) {
          (editor.chain().focus() as any).setFootnote({ content }).run();
      }
  };

  const handleInsertBibliography = async () => {
      if (!editor) return;
      
      const json = editor.getJSON();
      const citations = new Set<string>();
      
      // Traverse JSON to find mentions
      const traverse = (node: any) => {
          if (node.type === 'mention') {
              citations.add(node.attrs.id);
          }
          if (node.content) {
              node.content.forEach(traverse);
          }
      };
      traverse(json);
      
      if (citations.size === 0) {
          alert("Nenhuma citação encontrada no documento.");
          return;
      }
      
      const db = await getDb();
      const metadataList = [];
      
      for (const id of citations) {
          const meta = await db.get('pdfMetadata', id);
          if (meta) metadataList.push(meta);
      }
      
      // Sort alphabetically
      metadataList.sort((a, b) => a.author.localeCompare(b.author));
      
      // Format ABNT
      let html = `<h1>Referências Bibliográficas</h1>`;
      metadataList.forEach(m => {
          html += `<p style="margin-bottom: 12px;">${m.author.toUpperCase()}. <strong>${m.title}</strong>. ${m.publisher || 'S.l.'}, ${m.year}.</p>`;
      });
      
      editor.chain().focus().insertContent(html).run();
  };

  const value: DocEditorContextProps = {
    editor,
    fileId,
    fileName,
    currentName: fileHandler.currentName,
    setCurrentName: fileHandler.setCurrentName,
    userInfo,
    isLocalFile,
    comments,
    references,
    setReferences,
    activeCommentId,
    setActiveCommentId,
    activeHeaderFooterTab,
    setActiveHeaderFooterTab,
    isSharing,
    currentPage,
    stats,
    ui,
    layout,
    fileHandler,
    spellCheck,
    setSpellCheck,
    contentRef,
    docScrollerRef,
    fileInputRef,
    nextPage,
    prevPage,
    handleJumpToPage,
    handleApplyColumns,
    handleAddComment,
    triggerImageUpload,
    handleImageUpload,
    handleNativeShare,
    handleVersionRestore,
    handleHeaderFooterApply,
    insertFootnote,
    handleInsertBibliography,
    onToggleMenu,
    onBack
  };

  return (
    <DocEditorContext.Provider value={value}>
      {children}
    </DocEditorContext.Provider>
  );
};
