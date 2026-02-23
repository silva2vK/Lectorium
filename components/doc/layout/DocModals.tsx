
import React from 'react';
import { Editor } from '@tiptap/react';
import { PageSetupModal } from '../modals/PageSetupModal';
import { WordCountModal } from '../modals/WordCountModal';
import { CitationModal } from '../modals/CitationModal';
import { ShareModal } from '../modals/ShareModal';
import { ColumnsModal } from '../modals/ColumnsModal';
import { HeaderFooterModal } from '../modals/HeaderFooterModal';
import { VersionHistoryModal } from '../modals/VersionHistoryModal';
import { FootnoteModal } from '../modals/FootnoteModal';
import { TablePropertiesModal } from '../modals/TablePropertiesModal';
import { LanguageModal } from '../modals/LanguageModal';
import { PageNumberModal } from '../modals/PageNumberModal';
import { ExtractionModal } from '../modals/ExtractionModal';
import { Reference, EditorStats } from '../../../types';
import { usePdfStore } from '../../../stores/usePdfStore';
import { extractDataFromText } from '../../../services/aiService';

interface DocModalsProps {
  modals: any;
  toggleModal: (name: string, value?: boolean) => void;
  editor: Editor;
  pageLayout: any;
  stats: EditorStats;
  references: Reference[];
  setReferences: (fn: (prev: Reference[]) => Reference[]) => void;
  fileId: string;
  fileName: string;
  isLocalFile: boolean;
  activeHeaderFooterTab: 'header' | 'footer';
  handleHeaderFooterApply: (h: string, f: string) => void;
  handleVersionRestore: (content: any) => void;
  insertFootnote: (content: string) => void;
  handleApplyColumns: (count: number) => void;
  spellCheck: boolean;
  setSpellCheck: (v: boolean) => void;
}

export const DocModals: React.FC<DocModalsProps> = ({
  modals,
  toggleModal,
  editor,
  pageLayout,
  stats,
  references,
  setReferences,
  fileId,
  fileName,
  isLocalFile,
  activeHeaderFooterTab,
  handleHeaderFooterApply,
  handleVersionRestore,
  insertFootnote,
  handleApplyColumns,
  spellCheck,
  setSpellCheck
}) => {
  const currentPdfText = usePdfStore(s => s.currentText);

  const handleExtractTable = async (fields: string[]) => {
      if (!currentPdfText) {
          alert("Nenhum texto de PDF detectado. Abra um PDF em Split View e aguarde o OCR.");
          return;
      }

      const data = await extractDataFromText(currentPdfText, fields);
      
      if (data && data.length > 0) {
          // Re-doing with HTML insertion for reliability
          let html = `<table style="width: 100%; border-collapse: collapse;"><thead><tr>`;
          fields.forEach(f => html += `<th style="border: 1px solid #ccc; padding: 8px; background: #f0f0f0;">${f}</th>`);
          html += `</tr></thead><tbody>`;
          
          data.forEach(row => {
              html += `<tr>`;
              fields.forEach(f => {
                  html += `<td style="border: 1px solid #ccc; padding: 8px;">${row[f] || ''}</td>`;
              });
              html += `</tr>`;
          });
          html += `</tbody></table><p></p>`;
          
          editor.chain().focus().insertContent(html).run();
      } else {
          alert("Nenhum dado encontrado.");
      }
  };

  const handleInsertCitation = (id: string, label: string) => {
      editor.chain().focus().insertContent({ type: 'mention', attrs: { id, label } }).insertContent(' ').run();
  };

  return (
    <>
       <CitationModal 
          isOpen={modals.citation} 
          onClose={() => toggleModal('citation', false)} 
          onInsert={handleInsertCitation}
       />
       <ExtractionModal 
          isOpen={modals.extraction} 
          onClose={() => toggleModal('extraction', false)} 
          onExtract={handleExtractTable} 
       />
       <PageSetupModal 
         isOpen={modals.pageSetup} 
         initialSettings={pageLayout.pageSettings} 
         initialViewMode={pageLayout.viewMode} 
         onClose={() => toggleModal('pageSetup', false)} 
         onApply={(s, v) => { pageLayout.setPageSettings(s); pageLayout.setViewMode(v); toggleModal('pageSetup', false); }} 
       />
       <WordCountModal 
         isOpen={modals.wordCount} 
         onClose={() => toggleModal('wordCount', false)} 
         stats={stats} 
       />
       <ShareModal 
         isOpen={modals.share} 
         onClose={() => toggleModal('share', false)} 
         fileId={fileId} 
         fileName={fileName} 
         isLocal={isLocalFile} 
       />
       <ColumnsModal 
         isOpen={modals.columns} 
         onClose={() => toggleModal('columns', false)} 
         onApply={handleApplyColumns} 
       />
       <HeaderFooterModal 
          isOpen={modals.headerFooter} 
          onClose={() => toggleModal('headerFooter', false)} 
          initialHeader={pageLayout.pageSettings.headerText}
          initialFooter={pageLayout.pageSettings.footerText}
          activeTab={activeHeaderFooterTab}
          onApply={handleHeaderFooterApply}
       />
       <TablePropertiesModal 
          isOpen={modals.tableProperties} 
          onClose={() => toggleModal('tableProperties', false)} 
          editor={editor} 
       />
       <VersionHistoryModal 
          isOpen={modals.history} 
          onClose={() => toggleModal('history', false)} 
          fileId={fileId}
          onRestore={handleVersionRestore}
          currentContent={editor?.getJSON()}
       />
       <FootnoteModal 
          isOpen={modals.footnote} 
          onClose={() => toggleModal('footnote', false)} 
          onInsert={insertFootnote} 
       />
       <LanguageModal
          isOpen={modals.language}
          currentLanguage="pt-BR"
          onSelect={() => {}}
          onClose={() => toggleModal('language', false)}
       />
       <PageNumberModal 
          isOpen={modals.pageNumber}
          onClose={() => toggleModal('pageNumber', false)}
          onApply={(config) => {
              pageLayout.setPageSettings((prev: any) => ({ ...prev, pageNumber: config }));
              toggleModal('pageNumber', false);
          }}
       />
    </>
  );
};
