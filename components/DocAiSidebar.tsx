
import React, { useMemo } from 'react';
import { Icon } from './shared/Icon';
import { AiChatPanel } from './shared/AiChatPanel';
import { Editor } from '@tiptap/react';
import { Sparkles, X } from 'lucide-react';


interface Props {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
  fileId?: string;
}

export const DocAiSidebar: React.FC<Props> = ({ editor, isOpen, onClose, documentName, fileId }) => {
  if (!isOpen) return null;

  const documentText = useMemo(() => {
      if (!editor) return "";

      let context = "";
      const json = editor.getJSON();
      const nodes = json.content || [];

      nodes.forEach((node: any) => {
          if (node.type === 'heading') {
              const level = node.attrs?.level || 1;
              const text = node.content
                  ?.map((n: any) => n.text || '').join('') || '';
              context += `\n${'#'.repeat(level)} ${text}\n`;
          } else if (node.type === 'paragraph') {
              const text = node.content
                  ?.map((n: any) => n.text || '').join('') || '';
              if (text.trim()) context += `${text}\n`;
          } else if (node.type === 'blockquote') {
              const text = node.content?.flatMap((p: any) =>
                  p.content?.map((n: any) => n.text || '') || []
              ).join('') || '';
              if (text.trim()) context += `> ${text}\n`;
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

      return context.trim().slice(0, 60000);
  }, [editor]);

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
            contextText={documentText} 
            documentName={documentName}
            storageKey={`kalaki-chat-doc-${fileId || 'local'}`}
          />
      </div>
    </div>
  );
};
