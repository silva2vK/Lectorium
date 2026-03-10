import React, { useMemo, useCallback, useState } from 'react';
import { AiChatPanel } from './shared/AiChatPanel';
import { Editor } from '@tiptap/react';
import { Sparkles, X } from 'lucide-react';
import { indexDocumentForSearch } from '../services/ragService';

// Limite seguro para leitura direta — abaixo disso não precisa de RAG
const DIRECT_READ_CHAR_LIMIT = 40000;
// 30 páginas × ~3000 chars = 90000 chars. Acima disso: RAG obrigatório.
const RAG_PAGE_THRESHOLD = 30;

interface Props {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
  fileId?: string;
}

export const DocAiSidebar: React.FC<Props> = ({ editor, isOpen, onClose, documentName, fileId }) => {
  if (!isOpen) return null;

  const [isIndexed, setIsIndexed] = useState(false);

  // Extração completa do texto — sem slice, usado para indexação RAG
  const fullDocumentText = useMemo(() => {
    if (!editor) return "";

    let context = "";
    const json = editor.getJSON();
    const nodes = json.content || [];

    nodes.forEach((node: any) => {
      if (node.type === 'heading') {
        const level = node.attrs?.level || 1;
        const text = node.content?.map((n: any) => n.text || '').join('') || '';
        context += `\n${'#'.repeat(level)} ${text}\n`;
      } else if (node.type === 'paragraph') {
        const text = node.content?.map((n: any) => n.text || '').join('') || '';
        if (text.trim()) context += `${text}\n`;
      } else if (node.type === 'blockquote') {
        const text = node.content?.flatMap((p: any) =>
          p.content?.map((n: any) => n.text || '') || []
        ).join('') || '';
        if (text.trim()) context += `> ${text}\n`;
      } else if (node.type === 'table') {
        // Extrai texto de tabelas linha por linha
        node.content?.forEach((row: any) => {
          const rowText = row.content?.map((cell: any) =>
            cell.content?.flatMap((p: any) =>
              p.content?.map((n: any) => n.text || '') || []
            ).join('') || ''
          ).join(' | ');
          if (rowText.trim()) context += `| ${rowText} |\n`;
        });
      }
    });

    // Extrai comentários inline do CommentExtension
    const comments: string[] = [];
    editor.state.doc.descendants((node, pos) => {
      node.marks.forEach(mark => {
        if (mark.type.name === 'comment' && mark.attrs?.comment) {
          const textAround = editor.state.doc.textBetween(
            Math.max(0, pos - 50),
            Math.min(editor.state.doc.content.size, pos + 50),
            ' '
          );
          comments.push(
            `[COMENTÁRIO DO USUÁRIO]: "${mark.attrs.comment}" ` +
            `[TRECHO]: "${textAround.trim()}"`
          );
        }
      });
    });

    if (comments.length > 0) {
      context += `\n\n--- COMENTÁRIOS E ANOTAÇÕES DO USUÁRIO ---\n`;
      context += comments.join('\n');
    }

    return context.trim();
  }, [editor]);

  // Contexto enviado ao AiChatPanel:
  // — documento curto: texto completo (leitura direta)
  // — documento longo: primeiros 40k chars + aviso (RAG cuida do resto)
  const contextText = useMemo(() => {
    if (fullDocumentText.length <= DIRECT_READ_CHAR_LIMIT) {
      return fullDocumentText;
    }
    const preview = fullDocumentText.slice(0, DIRECT_READ_CHAR_LIMIT);
    return `${preview}\n\n[DOCUMENTO EXTENSO — ${fullDocumentText.length} caracteres totais. Use a Busca Semântica (ícone cérebro) para acessar seções além deste ponto.]`;
  }, [fullDocumentText]);

  // Estimativa de "páginas" para o AiChatPanel decidir se ativa RAG por default.
  // ~3000 chars por página A4 acadêmica. Se >= RAG_PAGE_THRESHOLD,
  // o AiChatPanel ativa isRagActive automaticamente (numPages >= 17 no seu useEffect).
  // Passamos RAG_PAGE_THRESHOLD+1 quando o doc é grande para garantir a ativação.
  const estimatedPages = useMemo(() => {
    const real = Math.ceil(fullDocumentText.length / 3000);
    // Força o AiChatPanel a entrar em modo RAG obrigatório para docs grandes
    return real >= RAG_PAGE_THRESHOLD ? RAG_PAGE_THRESHOLD + 1 : real;
  }, [fullDocumentText]);

  const isLargeDocument = estimatedPages > RAG_PAGE_THRESHOLD;

  // Indexação RAG do documento completo.
  // Para docx: converte texto em blob — ragService usa só o texto.
  const handleIndexRequest = useCallback(async () => {
    if (!fileId || !fullDocumentText || isIndexed) return;
    const textBlob = new Blob([fullDocumentText], { type: 'text/plain' });
    await indexDocumentForSearch(fileId, textBlob, fullDocumentText);
    setIsIndexed(true);
  }, [fileId, fullDocumentText, isIndexed]);

  // Auto-indexação: documentos grandes indexam ao abrir o sidebar, sem interação.
  // Só dispara uma vez por sessão (isIndexed guard).
  React.useEffect(() => {
    if (isLargeDocument && fileId && !isIndexed) {
      handleIndexRequest();
    }
  }, [isLargeDocument, fileId, isIndexed, handleIndexRequest]);

  return (
    <div className="absolute inset-y-0 right-0 z-[55] w-[90vw] sm:w-[60vw] md:w-[50vw] max-w-[800px] bg-[#1e1e1e] border-l border-[#444746] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between p-4 border-b border-[#444746] bg-surface">
        <h3 className="font-bold text-[#e3e3e3] flex items-center gap-2 text-sm uppercase tracking-widest">
          <Sparkles size={18} className="text-brand" />
          Kalaki (A Cidade)
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <AiChatPanel
          contextText={contextText}
          documentName={documentName}
          storageKey={`kalaki-chat-doc-${fileId || 'local'}`}
          fileId={fileId}
          numPages={estimatedPages}
          onIndexRequest={fileId ? handleIndexRequest : undefined}
        />
      </div>
    </div>
  );
};
