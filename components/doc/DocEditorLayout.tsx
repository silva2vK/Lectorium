
import React, { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, FileText, Cloud, Sparkles, Users, Share2 } from 'lucide-react';
import { EditorContent } from '@tiptap/react';
import { useDocEditorContext } from '../../context/DocEditorContext';

import { TopMenuBar } from './TopMenuBar';
import { DocToolbar } from './DocToolbar';
import { MobileDocToolbar } from './MobileDocToolbar';
import { DocCanvas } from './layout/DocCanvas';
import { DocModals } from './layout/DocModals';
import { CommentsSidebar } from './CommentsSidebar';
import { DocAiSidebar } from '../DocAiSidebar';
import { ImageOptionsSidebar } from './ImageOptionsSidebar';
import { OutlineSidebar } from './OutlineSidebar';

const ViewLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center bg-bg">
    <Loader2 size={40} className="animate-spin text-brand mb-4" />
    <p className="text-sm text-text-sec">Preparando editor...</p>
  </div>
);

export const DocEditorLayout: React.FC = () => {
  const {
    editor,
    fileHandler,
    ui,
    layout,
    stats,
    comments,
    references,
    setReferences,
    activeCommentId,
    setActiveCommentId,
    activeHeaderFooterTab,
    setActiveHeaderFooterTab,
    isSharing,
    currentPage,
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
    onToggleMenu,
    onBack,
    spellCheck,
    setSpellCheck,
    fileId,
    fileName,
    isLocalFile,
    currentName,
    setCurrentName,
    userInfo
  } = useDocEditorContext();

  const [isMobileHeaderVisible, setIsMobileHeaderVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!editor) return <ViewLoader />;

  return (
    <div 
      className={`flex flex-col h-full bg-bg relative overflow-hidden text-text ${ui.modes.lineNumbers ? 'show-line-numbers' : ''}`}
      style={{ viewTransitionName: 'hero-expand' }}
    >
       {/* MOBILE PULLER (TACTICAL) - Z-Index 200 to stay on top of everything */}
       {isMobile && (
         <div 
            className={`fixed left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex justify-center cursor-pointer ${isMobileHeaderVisible ? 'top-[4.5rem]' : 'top-0'}`}
            onClick={() => setIsMobileHeaderVisible(!isMobileHeaderVisible)}
            title={isMobileHeaderVisible ? "Ocultar Menu" : "Mostrar Menu"}
         >
            <div className="tactical-puller bg-black border-b border-x border-brand/50 shadow-[0_5px_20px_-5px_rgba(0,0,0,0.8)] rounded-b-2xl px-6 py-1.5 transition-all duration-300 hover:pt-3 hover:pb-2 group flex items-center justify-center">
                <div className="puller-indicator w-8 h-1 bg-white/20 rounded-full group-hover:bg-brand group-hover:shadow-[0_0_10px_var(--brand)] transition-colors duration-300" />
            </div>
         </div>
       )}

       {/* HEADER CONTAINER - Z-Index aumentado para 60 para cobrir MobileDocToolbar (z-50) */}
       <div 
         className={`bg-surface border-b border-border z-[60] shrink-0 transition-all duration-500 ease-in-out ${isMobile ? (isMobileHeaderVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 absolute w-full') : 'translate-y-0 opacity-100'}`}
       >
             <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="flex items-start gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full text-text-sec mt-1"><ArrowLeft size={20} /></button>
                    <div className="pt-2 text-blue-400"><FileText size={28} /></div>
                    <div className="flex flex-col">
                        <input value={currentName} onChange={e => setCurrentName(e.target.value)} onBlur={fileHandler.handleRename} className="bg-transparent text-text font-medium text-lg outline-none px-2 rounded -ml-2 focus:border-brand transition-colors" />
                        <TopMenuBar 
                            editor={editor} fileName={currentName} onSave={() => fileHandler.handleSave(layout.pageSettings, comments, references)}
                            onShare={handleNativeShare} onNew={onToggleMenu} onWordCount={() => ui.toggleModal('wordCount', true)}
                            onRename={fileHandler.handleRename}
                            onDownload={() => fileHandler.handleDownload(layout.pageSettings, comments, references)} onDownloadLect={() => fileHandler.handleDownloadLect(layout.pageSettings, comments)} onExportPdf={() => window.print()}
                            onInsertImage={triggerImageUpload} onTrash={fileHandler.handleTrash} onPageSetup={() => ui.toggleModal('pageSetup', true)}
                            onPageNumber={() => ui.toggleModal('pageNumber', true)} 
                            currentPage={currentPage}
                            onHeader={() => { setActiveHeaderFooterTab('header'); ui.toggleModal('headerFooter', true); }} 
                            onFooter={() => { setActiveHeaderFooterTab('footer'); ui.toggleModal('headerFooter', true); }} 
                            onAddFootnote={() => ui.toggleModal('footnote', true)}
                            onAddCitation={() => ui.toggleModal('citation', true)} onPrint={() => window.print()} onLanguage={() => ui.toggleModal('language', true)}
                            onSpellCheck={() => setSpellCheck(!spellCheck)} onFindReplace={() => ui.toggleModal('findReplace', true)}
                            onColumns={() => ui.toggleModal('columns', true)}
                            showRuler={layout.showRuler} setShowRuler={layout.setShowRuler} zoom={layout.zoom} setZoom={layout.setZoom}
                            onFitWidth={layout.handleFitWidth} viewMode={layout.viewMode} setViewMode={layout.setViewMode}
                            showComments={ui.sidebars.comments} setShowComments={v => ui.toggleSidebar('comments', v)}
                            suggestionMode={ui.modes.suggestion} toggleSuggestionMode={() => ui.toggleMode('suggestion')} toggleOutline={() => ui.toggleSidebar('outline')} isOutlineOpen={ui.sidebars.outline}
                            toggleLineNumbers={() => ui.toggleMode('lineNumbers')} showLineNumbers={ui.modes.lineNumbers}
                            onExportHtml={() => {}}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                    <div className="text-text-sec">{fileHandler.isSaving ? <Loader2 size={20} className="animate-spin" /> : <Cloud size={20} />}</div>
                    <button onClick={() => ui.toggleSidebar('aiChat')} className={`p-2 rounded-full ${ui.sidebars.aiChat ? 'bg-brand/20 text-brand' : 'text-text-sec'}`}><Sparkles size={20} /></button>
                    <button onClick={() => ui.toggleSidebar('comments')} className={`p-2 rounded-full ${ui.sidebars.comments ? 'bg-brand/20 text-brand' : 'text-text-sec'}`}><Users size={20} /></button>
                    <button onClick={() => ui.toggleModal('share', true)} className="flex items-center gap-2 bg-[#c2e7ff] text-[#0b141a] px-4 py-2 rounded-full font-medium text-sm hover:brightness-110 transition-all disabled:opacity-50">
                        {isSharing ? <Loader2 size={16} className="animate-spin"/> : <Share2 size={16} />}
                        <span>Compartilhar</span>
                    </button>
                </div>
             </div>
       </div>

       {/* STANDARD DESKTOP TOOLBAR (Hidden on Mobile) */}
       {!ui.modes.focus && (
           <DocToolbar 
               editor={editor} 
               onInsertImage={triggerImageUpload} 
               onAddFootnote={() => ui.toggleModal('footnote', true)} 
               currentPage={currentPage} 
               totalPages={layout.totalPages} 
               onJumpToPage={handleJumpToPage} 
           />
       )}

       {/* NEW MOBILE VERTICAL TOOLBAR */}
       {isMobile && !ui.modes.focus && (
           <MobileDocToolbar 
               editor={editor}
               onInsertImage={triggerImageUpload}
               currentPage={currentPage}
               totalPages={layout.totalPages}
               onJumpToPage={handleJumpToPage}
               onAddFootnote={() => ui.toggleModal('footnote', true)}
           />
       )}
       
       <div className="flex-1 overflow-hidden relative flex bg-black">
          <OutlineSidebar editor={editor} isOpen={ui.sidebars.outline} onClose={() => ui.toggleSidebar('outline', false)} />
          
          <DocCanvas 
              editor={editor}
              fileHandler={fileHandler}
              pageLayout={layout}
              modes={ui.modes}
              modals={ui.modals}
              sidebars={ui.sidebars}
              toggleModal={ui.toggleModal}
              toggleSidebar={ui.toggleSidebar}
              currentPage={currentPage}
              docScrollerRef={docScrollerRef}
              contentRef={contentRef}
              nextPage={nextPage}
              prevPage={prevPage}
              handleJumpToPage={handleJumpToPage}
              comments={comments}
              handleAddComment={handleAddComment}
              onResolveComment={() => {}}
              onDeleteComment={() => {}}
              activeCommentId={activeCommentId}
              setActiveCommentId={setActiveCommentId}
              userInfo={userInfo}
           />

          <DocAiSidebar editor={editor} isOpen={ui.sidebars.aiChat} onClose={() => ui.toggleSidebar('aiChat', false)} documentName={currentName} />
          <CommentsSidebar editor={editor} isOpen={ui.sidebars.comments} onClose={() => ui.toggleSidebar('comments', false)} comments={comments} onAddComment={handleAddComment} onResolveComment={() => {}} onDeleteComment={() => {}} activeCommentId={activeCommentId} setActiveCommentId={setActiveCommentId} />
          <ImageOptionsSidebar editor={editor} isOpen={ui.sidebars.imageOptions} onClose={() => ui.toggleSidebar('imageOptions', false)} />
       </div>

       <DocModals 
          modals={ui.modals}
          toggleModal={ui.toggleModal}
          editor={editor}
          pageLayout={layout}
          stats={stats}
          references={references}
          setReferences={setReferences}
          fileId={fileId}
          fileName={fileName}
          isLocalFile={isLocalFile}
          activeHeaderFooterTab={activeHeaderFooterTab}
          handleHeaderFooterApply={handleHeaderFooterApply}
          handleVersionRestore={handleVersionRestore}
          insertFootnote={insertFootnote}
          handleApplyColumns={handleApplyColumns}
          spellCheck={spellCheck}
          setSpellCheck={setSpellCheck}
       />
       
       <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
    </div>
  );
};
