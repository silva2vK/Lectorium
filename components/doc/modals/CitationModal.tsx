import React, { useState, useEffect } from 'react';
import { BaseModal } from '../../shared/BaseModal';
import { Book, Search } from 'lucide-react';
import { searchPdfMetadata, PdfMetadata } from '../../../services/storageService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (id: string, label: string) => void;
}

export const CitationModal: React.FC<Props> = ({ isOpen, onClose, onInsert }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PdfMetadata[]>([]);

  useEffect(() => {
    if (isOpen) {
        searchPdfMetadata('').then(setResults);
    }
  }, [isOpen]);

  useEffect(() => {
      const timer = setTimeout(() => {
          searchPdfMetadata(query).then(setResults);
      }, 300);
      return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Inserir Citação"
      icon={<Book size={20} />}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                  className="w-full bg-[#2c2c2c] border border-gray-600 rounded pl-10 pr-3 py-2 text-sm text-white focus:border-brand outline-none"
                  placeholder="Buscar por autor ou título..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
              />
          </div>
          
          <div className="max-h-[300px] overflow-y-auto space-y-1">
              {results.length > 0 ? (
                  results.map(item => (
                      <button
                          key={item.fileId}
                          onClick={() => {
                              onInsert(item.fileId, `(${item.author.toUpperCase()}, ${item.year})`);
                              onClose();
                          }}
                          className="w-full text-left px-3 py-2 rounded hover:bg-white/5 flex flex-col gap-0.5 transition-colors"
                      >
                          <span className="font-bold text-white text-sm">{item.author.toUpperCase()}, {item.year}</span>
                          <span className="text-xs text-gray-400 truncate">{item.title}</span>
                      </button>
                  ))
              ) : (
                  <div className="text-center text-gray-500 py-4 text-sm">Nenhuma referência encontrada.</div>
              )}
          </div>
      </div>
    </BaseModal>
  );
};
