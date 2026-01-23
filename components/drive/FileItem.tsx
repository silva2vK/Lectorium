
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FolderOpen, MoreVertical, Pin, PinOff, Edit2, FolderInput, Share2, Trash2, 
  FilePlus, CheckCircle, Workflow, BookOpen, FileText, Package, Image as ImageIcon, ChevronRight 
} from 'lucide-react';
import { DriveFile, MIME_TYPES } from '../../types';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import JSZip from 'jszip';

// Configuração do Worker do PDF.js
if (!GlobalWorkerOptions.workerSrc) {
   GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`;
}

// --- Thumbnail Generator Helper ---
async function generateLocalThumbnail(file: DriveFile): Promise<string | null> {
    if (!file.blob) return null;
    try {
        if (file.mimeType === MIME_TYPES.PDF) {
            const arrayBuffer = await file.blob.arrayBuffer();
            const loadingTask = getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 }); 
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: ctx, viewport }).promise;
                return canvas.toDataURL('image/jpeg', 0.8);
            }
        }
        if (file.mimeType === MIME_TYPES.DOCX) {
            const zip = await JSZip.loadAsync(file.blob);
            const thumbFile = zip.file("docProps/thumbnail.jpeg") || zip.file("docProps/thumbnail.emf");
            if (thumbFile) {
                const blob = await thumbFile.async("blob");
                return URL.createObjectURL(blob);
            }
        }
    } catch (e) { console.warn("Falha ao gerar thumbnail local para", file.name, e); }
    return null;
}

export interface FileItemProps {
    file: DriveFile;
    onSelect: (file: DriveFile, background?: boolean) => void;
    onTogglePin: (file: DriveFile) => void;
    onDelete: (file: DriveFile) => void;
    onShare: (file: DriveFile) => void;
    onMove: (file: DriveFile) => void;
    onRename: (file: DriveFile) => void;
    isOffline: boolean;
    isPinned: boolean;
    isActiveMenu: boolean;
    setActiveMenu: (id: string | null) => void;
    isLocalMode: boolean;
    accessToken?: string;
    isExpanding?: boolean;
}

export const FileItem = React.memo(({ file, onSelect, onTogglePin, onDelete, onShare, onMove, onRename, isOffline, isPinned, isActiveMenu, setActiveMenu, isLocalMode, accessToken, isExpanding }: FileItemProps) => {
    const isFolder = file.mimeType === MIME_TYPES.FOLDER;
    const [imgError, setImgError] = useState(false);
    const [localThumbnail, setLocalThumbnail] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        let generatedUrl: string | null = null;
        setImgError(false);
        const loadThumbnail = async () => {
            if (file.blob && file.mimeType.startsWith('image/')) {
                generatedUrl = URL.createObjectURL(file.blob);
                if (active) { setLocalThumbnail(generatedUrl); setImgError(false); }
                return;
            }
            if (file.blob && (file.mimeType === MIME_TYPES.PDF || file.mimeType === MIME_TYPES.DOCX)) {
                const url = await generateLocalThumbnail(file);
                if (active && url) { generatedUrl = url; setLocalThumbnail(url); setImgError(false); }
            }
        };
        if (file.blob || !file.thumbnailLink) loadThumbnail(); else setLocalThumbnail(null);
        return () => { active = false; if (generatedUrl && !generatedUrl.startsWith('data:')) URL.revokeObjectURL(generatedUrl); };
    }, [file.id, file.blob, file.mimeType, file.thumbnailLink]);

    const thumbnailSrc = useMemo(() => {
        if (localThumbnail) return localThumbnail;
        if (!file.thumbnailLink) return null;
        let url = file.thumbnailLink;
        if (url.includes('googleusercontent.com') || url.includes('=s')) url = url.replace(/=s\d+/, '=s400');
        if (accessToken && !isLocalMode) {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}access_token=${accessToken}`;
        }
        return url;
    }, [file.thumbnailLink, localThumbnail, accessToken, isLocalMode]);
    
    const getIcon = (f: DriveFile, size: number = 40) => {
      if (f.name.endsWith('.mindmap')) return <Workflow size={size} className="text-purple-400" />;
      if (f.mimeType === MIME_TYPES.PDF) return <BookOpen size={size} className="text-red-400" />;
      if (f.mimeType === MIME_TYPES.DOCX || f.mimeType === MIME_TYPES.GOOGLE_DOC) return <FileText size={size} className="text-blue-400" />;
      if (f.name.endsWith('.lect')) return <Package size={size} className="text-orange-400" />;
      if (f.name.endsWith('.cbz') || f.name.endsWith('.cbr')) return <ImageIcon size={size} className="text-pink-400" />;
      if (f.mimeType.startsWith('image/')) return <ImageIcon size={size} className="text-green-400" />;
      return <FileText size={size} className="text-text-sec" />;
    };

    // --- RENDERIZADOR DE PASTA (ESTÉTICA XBOX/GITHUB) ---
    if (isFolder) {
        return (
            <div 
                onClick={() => onSelect(file)} 
                className="group relative h-32 md:h-40 w-full bg-[#0d1117] border border-[#30363d] rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:border-brand/50 hover:-translate-y-1 active:scale-95 overflow-hidden"
                style={isExpanding ? { viewTransitionName: 'hero-expand', zIndex: 50 } : undefined}
            >
                {/* Background Grid Pattern */}
                <div 
                    className="absolute inset-0 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity" 
                    style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                />
                
                {/* Top Bar (Tab) */}
                <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-[#161b22] border border-[#30363d] rounded-lg text-brand">
                            <FolderOpen size={16} />
                        </div>
                        {isPinned ? (
                            <div className="text-brand bg-[#161b22] p-1 rounded border border-brand/30" title="Pasta Fixada">
                                <Pin size={10} fill="currentColor" />
                            </div>
                        ) : (
                            <span className="text-[10px] font-mono font-bold text-[#8b949e] uppercase tracking-wider bg-[#161b22] px-1.5 py-0.5 rounded border border-[#30363d]">DIR</span>
                        )}
                    </div>
                    {!isLocalMode && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }} 
                            className="text-[#8b949e] hover:text-white p-1 hover:bg-[#21262d] rounded transition-colors"
                        >
                            <MoreVertical size={16} />
                        </button>
                    )}
                </div>

                {/* Big Icon Watermark */}
                <div className="absolute right-[-10px] bottom-[-10px] text-[#21262d] group-hover:text-brand/10 transition-colors duration-300 rotate-[-10deg] pointer-events-none">
                    <FolderOpen size={100} strokeWidth={1} />
                </div>

                {/* Label Area */}
                <div className="relative z-10 mt-auto">
                    <h3 className="font-bold text-[#e6edf3] text-sm md:text-base leading-tight line-clamp-2 mb-1 group-hover:text-brand transition-colors">
                        {file.name}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] text-[#8b949e]">
                       <span>Acessar</span> <ChevronRight size={10} />
                    </div>
                </div>

                {/* Menu Dropdown */}
                {isActiveMenu && !isLocalMode && (
                    <div className="absolute top-10 right-2 w-48 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden z-30 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <button onClick={() => onTogglePin(file)} className="w-full text-left px-4 py-3 hover:bg-[#21262d] text-xs flex items-center gap-2 text-[#c9d1d9]">
                            {isPinned ? <><PinOff size={14} /> Desafixar</> : <><Pin size={14} /> Fixar no Topo</>}
                        </button>
                        <button onClick={() => onRename(file)} className="w-full text-left px-4 py-3 hover:bg-[#21262d] text-xs flex items-center gap-2 text-[#c9d1d9]"><Edit2 size={14} /> Renomear</button>
                        <button onClick={() => onMove(file)} className="w-full text-left px-4 py-3 hover:bg-[#21262d] text-xs flex items-center gap-2 text-[#c9d1d9]"><FolderInput size={14} /> Mover para...</button>
                        <button onClick={() => onShare(file)} className="w-full text-left px-4 py-3 hover:bg-[#21262d] text-xs flex items-center gap-2 text-[#c9d1d9]"><Share2 size={14} /> Compartilhar</button>
                        <button onClick={() => onDelete(file)} className="w-full text-left px-4 py-3 hover:bg-red-900/20 text-red-400 text-xs flex items-center gap-2 border-t border-[#30363d]"><Trash2 size={14} /> Excluir</button>
                    </div>
                )}
            </div>
        );
    }

    // --- RENDERIZADOR DE ARQUIVO ---
    return (
        <div 
            onClick={() => onSelect(file)} 
            className="group relative bg-surface p-3 rounded-2xl border border-border hover:border-brand/50 transition-all cursor-pointer flex flex-col h-full active:scale-95"
            style={isExpanding ? { viewTransitionName: 'hero-expand', zIndex: 50, contain: 'layout' } : undefined}
        >
            <div className="w-full aspect-[3/4] bg-black/20 rounded-xl mb-3 relative flex items-center justify-center overflow-hidden border border-white/5">
                {isPinned && <div className="absolute top-2 left-2 text-brand bg-bg/80 p-1.5 rounded-full z-10 border border-brand/20"><Pin size={10} fill="currentColor"/></div>}
                {isOffline && !isPinned && !isLocalMode && <div className="absolute top-2 right-2 text-green-500 z-10 bg-black/50 rounded-full p-1"><CheckCircle size={12}/></div>}
                
                {thumbnailSrc && !imgError ? (
                    <img 
                        src={thumbnailSrc} 
                        alt={file.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100" 
                        onError={() => setImgError(true)} 
                        loading="lazy" 
                        referrerPolicy="no-referrer" 
                        crossOrigin="anonymous" 
                    />
                ) : (
                    <div className="transition-transform duration-300 group-hover:scale-110 opacity-70 group-hover:opacity-100">
                        {getIcon(file, 48)}
                    </div>
                )}
            </div>
            
            <div className="flex items-start justify-between gap-2 mt-auto">
                <div className="min-w-0 flex-1">
                    <h3 className="font-medium truncate text-text text-xs mb-0.5 group-hover:text-brand transition-colors">{file.name}</h3>
                    <p className="text-[9px] text-text-sec uppercase font-bold opacity-60 flex items-center gap-1">
                        {file.mimeType.split('/').pop()?.split('.').pop() || 'Arquivo'}
                    </p>
                </div>
                {!isLocalMode && (
                    <button onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }} className="p-1 text-text-sec hover:text-text hover:bg-white/10 rounded transition-colors">
                        <MoreVertical size={14} />
                    </button>
                )}
            </div>

            {isActiveMenu && !isLocalMode && (
                <div className="absolute bottom-10 right-2 w-48 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden z-30 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { onSelect(file, true); setActiveMenu(null); }} className="w-full text-left px-4 py-3 hover:bg-[#21262d] text-xs flex items-center gap-2 text-[#c9d1d9]">
                        <FilePlus size={14} /> Abrir em 2º Plano
                    </button>
                    <button onClick={() => onTogglePin(file)} className="w-full text-left px-4 py-3 hover:bg-[#21262d] text-xs flex items-center gap-2 text-[#c9d1d9]">
                        {isPinned ? <><PinOff size={14} /> Soltar do disco</> : <><Pin size={14} /> Manter Offline</>}
                    </button>
                    <button onClick={() => onRename(file)} className="w-full text-left px-4 py-3 hover:bg-[#21262d] text-xs flex items-center gap-2 text-[#c9d1d9]"><Edit2 size={14} /> Renomear</button>
                    <button onClick={() => onMove(file)} className="w-full text-left px-4 py-3 hover:bg-[#21262d] text-xs flex items-center gap-2 text-[#c9d1d9]"><FolderInput size={14} /> Mover para...</button>
                    <button onClick={() => onShare(file)} className="w-full text-left px-4 py-3 hover:bg-[#21262d] text-xs flex items-center gap-2 text-[#c9d1d9]"><Share2 size={14} /> Compartilhar</button>
                    <button onClick={() => onDelete(file)} className="w-full text-left px-4 py-3 hover:bg-red-900/20 text-red-400 text-xs flex items-center gap-2 border-t border-[#30363d]"><Trash2 size={14} /> Excluir</button>
                </div>
            )}
        </div>
    );
});
