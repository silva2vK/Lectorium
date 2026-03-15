/**
 * FileItem — rev.3
 * Correções:
 * — overflow-hidden removido do wrapper do card de arquivo (estava cortando o ContextMenu).
 *   A preview interna já tem seu próprio overflow-hidden com border-radius correto.
 * — z-20 removido do container do menu em pastas. Criava stacking context que
 *   capturava o z-50 do ContextMenu, impedindo que ele aparecesse sobre outros cards.
 * — Novos itens de menu: Abrir no Drive, Baixar, Duplicar, Estrelar/Desestrelar.
 */

import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { MoreVertical, Pin, Trash2, Share2, FolderInput, Edit3, BookOpen, Map, FileText, ChevronRight, ExternalLink, Download, Copy, Star } from 'lucide-react';
import { DriveFile, MIME_TYPES } from '../../types';

interface FileItemProps {
  file: DriveFile;
  onSelect: (file: DriveFile) => void;
  onTogglePin: (file: DriveFile) => void;
  onDelete: (file: DriveFile) => void;
  onShare: (file: DriveFile) => void;
  onMove: (file: DriveFile) => void;
  onRename: (file: DriveFile) => void;
  onDownload?: (file: DriveFile) => void;
  onDuplicate?: (file: DriveFile) => void;
  onToggleStar?: (file: DriveFile) => void;
  isOffline?: boolean;
  isPinned?: boolean;
  isStarred?: boolean;
  isActiveMenu?: boolean;
  setActiveMenu: (id: string | null) => void;
  isLocalMode?: boolean;
  accessToken?: string;
  isExpanding?: boolean;
  childCount?: number;
}

function catalogLetter(name: string): string {
  const upper = name.toUpperCase().replace(/[^A-Z]/g, '');
  return upper.charAt(0) || '·';
}

function refCode(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const letters = 'ABCDEFGHJKLMNPQRSTVWXYZ';
  const a = letters[h % letters.length];
  const b = letters[(h >> 4) % letters.length];
  const n = String(h % 999 + 1).padStart(3, '0');
  return `${a}${b}·${n}`;
}

function getBrandColor(): string {
  if (typeof document === 'undefined') return '#4ade80';
  return getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#4ade80';
}

const OfflineCheck: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="11" fill="#22c55e" />
    <circle cx="11" cy="11" r="10" fill="#16a34a" opacity="0.4" />
    <path d="M6 11.5L9.5 15L16 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface CtxProps {
  file: DriveFile;
  isPinned?: boolean;
  isStarred?: boolean;
  brandColor: string;
  onTogglePin: (f: DriveFile) => void;
  onRename: (f: DriveFile) => void;
  onMove: (f: DriveFile) => void;
  onShare: (f: DriveFile) => void;
  onDelete: (f: DriveFile) => void;
  onDownload?: (f: DriveFile) => void;
  onDuplicate?: (f: DriveFile) => void;
  onToggleStar?: (f: DriveFile) => void;
  setActiveMenu: (id: string | null) => void;
  isFolder?: boolean;
  isLocalMode?: boolean;
}

const ContextMenu: React.FC<CtxProps> = ({
  file, isPinned, isStarred, brandColor,
  onTogglePin, onRename, onMove, onShare, onDelete,
  onDownload, onDuplicate, onToggleStar,
  setActiveMenu, isFolder, isLocalMode,
}) => {
  const isDriveFile = !file.id.startsWith('local-') && !file.id.startsWith('native-');

  const actions: { icon: React.ReactNode; label: string; action: () => void; danger?: boolean }[] = [
    { icon: <Pin size={12} />, label: isPinned ? 'Desafixar' : 'Fixar', action: () => onTogglePin(file) },

    ...(isDriveFile && !isFolder && onToggleStar ? [{
      icon: <Star size={12} fill={isStarred ? 'currentColor' : 'none'} />,
      label: isStarred ? 'Retirar Estrela' : 'Estrelar',
      action: () => onToggleStar(file),
    }] : []),

    { icon: <Edit3 size={12} />, label: 'Renomear', action: () => onRename(file) },

    ...(isDriveFile ? [{
      icon: <FolderInput size={12} />, label: 'Mover', action: () => onMove(file),
    }] : []),

    ...(isDriveFile && !isFolder && onDuplicate ? [{
      icon: <Copy size={12} />, label: 'Duplicar', action: () => onDuplicate(file),
    }] : []),

    ...(!isFolder && onDownload ? [{
      icon: <Download size={12} />, label: 'Baixar', action: () => onDownload(file),
    }] : []),

    { icon: <Share2 size={12} />, label: 'Compartilhar', action: () => onShare(file) },

    ...(isDriveFile ? [{
      icon: <ExternalLink size={12} />,
      label: 'Abrir no Drive',
      action: () => {
        window.open(
          isFolder
            ? `https://drive.google.com/drive/folders/${file.id}`
            : `https://drive.google.com/file/d/${file.id}/view`,
          '_blank'
        );
        setActiveMenu(null);
      },
    }] : []),

    { icon: <Trash2 size={12} />, label: 'Excluir', action: () => onDelete(file), danger: true },
  ];

  return (
    <div
      className="absolute right-0 top-6 w-48 z-[200] animate-in fade-in duration-150"
      style={{
        background: 'linear-gradient(160deg, #101014 0%, #0a0a0d 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderTop: `1px solid ${brandColor}50`,
        borderRadius: '2px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.04)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {actions.map(({ icon, label, action, danger }) => (
        <button
          key={label}
          onClick={(e) => { e.stopPropagation(); action(); setActiveMenu(null); }}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] transition-colors"
          style={{ color: danger ? '#cc3333' : 'rgba(255,255,255,0.7)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = danger ? 'rgba(204,0,0,0.1)' : 'rgba(255,255,255,0.05)';
            if (!danger) e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = danger ? '#cc3333' : 'rgba(255,255,255,0.7)';
          }}
        >
          {icon}{label}
        </button>
      ))}
    </div>
  );
};

export const FileItem: React.FC<FileItemProps> = ({
  file, onSelect, onTogglePin, onDelete, onShare, onMove, onRename,
  onDownload, onDuplicate, onToggleStar,
  isOffline, isPinned, isStarred, isActiveMenu, setActiveMenu,
  isLocalMode, isExpanding,
}) => {
  const isFolder = file.mimeType === MIME_TYPES.FOLDER;
  const isMindmap = file.name.endsWith('.mindmap') || file.mimeType === MIME_TYPES.MINDMAP;
  const menuRef = useRef<HTMLDivElement>(null);
  const [brandColor, setBrandColor] = useState('#4ade80');

  useLayoutEffect(() => {
    setBrandColor(getBrandColor());
    const observer = new MutationObserver(() => setBrandColor(getBrandColor()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isActiveMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isActiveMenu, setActiveMenu]);

  const letter = catalogLetter(file.name);
  const ref = refCode(file.id);
  const displayName = file.name.length > 34 ? file.name.slice(0, 32) + '…' : file.name;
  const formattedDate = file.modifiedTime
    ? new Date(file.modifiedTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const sharedStyles = `
    .silver-letter {
      background: linear-gradient(150deg, #c8c8c8 0%, #ffffff 28%, #a8a8a8 52%, #d8d8d8 72%, #efefef 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9));
    }
  `;

  const fileTypeLabel = isMindmap ? 'MINDMAP'
    : file.mimeType?.includes('document') || file.name.endsWith('.docx') ? 'DOCUMENT'
    : file.name.toLowerCase().endsWith('.pdf') || file.mimeType?.includes('pdf') ? 'PDF'
    : file.mimeType?.split('/')[1]?.toUpperCase().slice(0, 8) || 'FILE';

  // ── ARQUIVO ────────────────────────────────────────────────────────────────
  if (!isFolder) {
    return (
      <div className="relative group">
        <style>{`
          .file-card-classic {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .file-card-classic:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 32px rgba(0,0,0,0.85) !important;
          }
        `}</style>

        <div
          className="file-card-classic"
          style={{
            background: '#111',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '6px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
            position: 'relative',
            // SEM overflow: hidden aqui. A preview interna já tem o seu próprio.
            // overflow: hidden no wrapper cortava o ContextMenu.
          }}
        >
          <button
            onClick={() => onSelect(file)}
            className="w-full text-left block"
            style={{ padding: 0 }}
          >
            {/* overflow-hidden aqui, com border-radius, cuida do clipping da imagem */}
            <div
              className="relative overflow-hidden"
              style={{ height: '240px', background: '#1a1a1a', borderRadius: '5px 5px 0 0' }}
            >
              {file.thumbnailLink ? (
                <img
                  src={file.thumbnailLink}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.95 }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: '#1c1c1c' }}>
                  <div style={{ opacity: 0.15 }}>
                    {isMindmap
                      ? <Map size={40} strokeWidth={0.8} style={{ color: '#fff' }} />
                      : <FileText size={40} strokeWidth={0.8} style={{ color: '#fff' }} />}
                  </div>
                </div>
              )}
              {isOffline && (
                <div className="absolute top-2 left-2 z-20" title="Disponível offline"
                  style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))' }}>
                  <OfflineCheck size={22} />
                </div>
              )}
              {isPinned && (
                <div className="absolute top-2 right-2 z-20 w-2 h-2 rounded-full"
                  style={{ background: brandColor, boxShadow: `0 0 6px ${brandColor}` }} />
              )}
            </div>
          </button>

          <div className="flex items-start justify-between px-2.5 pt-2 pb-2.5 gap-1" style={{ background: '#111' }}>
            <button onClick={() => onSelect(file)} className="flex-1 min-w-0 text-left">
              <p className="truncate text-[13px] font-medium leading-snug"
                style={{ color: 'rgba(255,255,255,0.90)', fontFamily: "'Inter', system-ui, sans-serif" }}>
                {displayName}
              </p>
              <p className="text-[10px] mt-0.5 tracking-wider font-medium"
                style={{ color: 'rgba(255,255,255,0.30)', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '0.08em' }}>
                {fileTypeLabel}
              </p>
            </button>

            <div ref={menuRef} className="flex-shrink-0 relative mt-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }}
                className="p-1 rounded transition-colors"
                style={{ color: 'rgba(255,255,255,0.45)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
                <MoreVertical size={15} />
              </button>
              {isActiveMenu && (
                <ContextMenu
                  file={file} isPinned={isPinned} isStarred={isStarred} brandColor={brandColor}
                  onTogglePin={onTogglePin} onRename={onRename} onMove={onMove}
                  onShare={onShare} onDelete={onDelete}
                  onDownload={onDownload} onDuplicate={onDuplicate} onToggleStar={onToggleStar}
                  setActiveMenu={setActiveMenu} isFolder={false} isLocalMode={isLocalMode}
                />
              )}
            </div>
          </div>

          {isExpanding && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-[6px]">
              <div className="w-5 h-5 border border-white/25 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PASTA ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full group">
      <style>{sharedStyles + `
        .cabinet-drawer-noir {
          transition: transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.22s ease;
        }
        .cabinet-drawer-noir:hover {
          transform: translateX(7px);
          box-shadow: -8px 3px 28px rgba(0,0,0,0.88),
                      inset 0 1px 0 rgba(255,255,255,0.06) !important;
        }
        .drawer-brand-handle {
          transition: background 0.22s ease, box-shadow 0.22s ease;
        }
      `}</style>

      <button
        onClick={() => onSelect(file)}
        className="cabinet-drawer-noir w-full text-left relative overflow-hidden"
        style={{
          background: 'linear-gradient(90deg, #111115 0%, #0d0d11 40%, #0a0a0e 70%, #0f0f13 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderLeft: '3px solid #CC0000',
          borderRadius: '2px',
          boxShadow: '0 2px 14px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)',
          padding: '0',
          display: 'flex',
          alignItems: 'stretch',
          minHeight: '64px',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.07) 50%, transparent 95%)' }}
        />
        <div className="flex-shrink-0 w-11 flex flex-col items-center justify-center gap-0.5"
          style={{ background: 'rgba(0,0,0,0.45)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="silver-letter"
            style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '20px', fontWeight: 700, lineHeight: 1 }}>
            {letter}
          </span>
          <div className="w-4 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <span style={{
            color: 'rgba(255,255,255,0.16)', fontSize: '6.5px', letterSpacing: '0.06em',
            transform: 'rotate(-90deg)', whiteSpace: 'nowrap', marginTop: '3px', fontFamily: 'monospace',
          }}>
            {ref}
          </span>
        </div>
        <div className="drawer-brand-handle flex-shrink-0 w-[6px] self-stretch"
          style={{
            background: `linear-gradient(180deg, ${brandColor}25 0%, ${brandColor}55 50%, ${brandColor}25 100%)`,
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        />
        <div className="flex-1 flex items-center px-3 py-2 gap-3">
          <BookOpen size={17} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="truncate leading-tight"
              style={{ color: 'rgba(255,255,255,0.93)', fontWeight: 500, fontFamily: "'Inter', system-ui, sans-serif", fontSize: '16px', letterSpacing: '-0.01em' }}>
              {file.name}
            </p>
            {formattedDate && (
              <p className="text-[10px] mt-0.5 tracking-wider"
                style={{ color: 'rgba(200,160,60,0.75)', fontFamily: "'Inter', system-ui, sans-serif" }}>
                {formattedDate}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
            {isPinned && <div className="w-1.5 h-1.5 rounded-full" style={{ background: brandColor, boxShadow: `0 0 5px ${brandColor}80` }} />}
            {isOffline && <OfflineCheck size={18} />}
            <ChevronRight size={13} style={{ color: 'rgba(200,160,60,0.85)' }} />
          </div>
        </div>
        {isExpanding && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-5 h-5 border border-white/25 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {/* SEM z-20 aqui — remover o z-index explícito elimina o stacking context
          que impedia o z-[200] do ContextMenu de aparecer corretamente */}
      <div ref={menuRef} className="absolute right-2 top-1/2 -translate-y-1/2">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }}
          className="p-1 rounded opacity-40 group-hover:opacity-100 transition-opacity"
          style={{ color: 'rgba(200,160,60,0.9)', background: 'rgba(0,0,0,0.55)' }}>
          <MoreVertical size={13} />
        </button>
        {isActiveMenu && (
          <ContextMenu
            file={file} isPinned={isPinned} isStarred={isStarred} brandColor={brandColor}
            onTogglePin={onTogglePin} onRename={onRename} onMove={onMove}
            onShare={onShare} onDelete={onDelete}
            onDownload={onDownload} onDuplicate={onDuplicate} onToggleStar={onToggleStar}
            setActiveMenu={setActiveMenu} isFolder={true} isLocalMode={isLocalMode}
          />
        )}
      </div>
    </div>
  );
};
