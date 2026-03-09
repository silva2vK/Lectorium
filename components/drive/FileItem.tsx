/**
 * FileItem — Variante 6: CARTA MARINA
 * Estética: Portulanos e mapas náuticos do séc. XV-XVI. Papel de pergaminho
 * com linhas de rumo, rosa dos ventos e anotações cartográficas.
 * Cada pasta é uma região não-mapeada ("hic sunt leones").
 * Cada arquivo é um território documentado com coordenadas.
 * Refinamento geográfico: Waldseemüller, Mercator, Fra Mauro.
 * Fonte: Spectral + Philosopher
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pin, Trash2, Share2, FolderInput, Edit3 } from 'lucide-react';
import { DriveFile, MIME_TYPES } from '../../types';

interface FileItemProps {
  file: DriveFile;
  onSelect: (file: DriveFile) => void;
  onTogglePin: (file: DriveFile) => void;
  onDelete: (file: DriveFile) => void;
  onShare: (file: DriveFile) => void;
  onMove: (file: DriveFile) => void;
  onRename: (file: DriveFile) => void;
  isOffline?: boolean;
  isPinned?: boolean;
  isActiveMenu?: boolean;
  setActiveMenu: (id: string | null) => void;
  isLocalMode?: boolean;
  accessToken?: string;
  isExpanding?: boolean;
  childCount?: number;
}

// Coordenadas fictícias baseadas no id
function coordinates(id: string): { lat: string; lon: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  const lat = ((h & 0xff) % 90).toString().padStart(2, '0');
  const lon = (((h >> 8) & 0xff) % 180).toString().padStart(3, '0');
  const latDir = h & 0x10000 ? 'N' : 'S';
  const lonDir = h & 0x20000 ? 'E' : 'W';
  return { lat: `${lat}°${latDir}`, lon: `${lon}°${lonDir}` };
}

// Tom de pergaminho por id
const PARCHMENT_TONES = [
  { bg: '#f2e8d0', ink: '#2a1a08', aged: '#c8a870', rubriq: '#8B0000', lines: 'rgba(160,120,60,0.2)' },
  { bg: '#ede3c8', ink: '#200e04', aged: '#b89860', rubriq: '#722F37', lines: 'rgba(140,100,50,0.2)' },
  { bg: '#f0e8d5', ink: '#1a1208', aged: '#c4a060', rubriq: '#6B1A1A', lines: 'rgba(150,110,55,0.2)' },
];

function parchmentTone(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 7 + id.charCodeAt(i)) & 0xff;
  return PARCHMENT_TONES[h % PARCHMENT_TONES.length];
}

// Rosa dos ventos minimalista (SVG inline)
const WindRose = ({ color, size = 32 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    {/* N */}
    <polygon points="16,2 14,14 18,14" fill={color} opacity="0.9" />
    {/* S */}
    <polygon points="16,30 14,18 18,18" fill={color} opacity="0.5" />
    {/* E */}
    <polygon points="30,16 18,14 18,18" fill={color} opacity="0.5" />
    {/* W */}
    <polygon points="2,16 14,14 14,18" fill={color} opacity="0.5" />
    {/* Círculo central */}
    <circle cx="16" cy="16" r="2.5" fill={color} opacity="0.8" />
    <circle cx="16" cy="16" r="4" stroke={color} strokeWidth="0.5" fill="none" opacity="0.4" />
  </svg>
);

// Linhas de rumo (rhumb lines) radiando do centro
const RhumbLines = ({ color }: { color: string }) => (
  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none" preserveAspectRatio="xMidYMid slice">
    {[0, 30, 60, 90, 120, 150].map((angle, i) => (
      <line
        key={i}
        x1="100" y1="100"
        x2={100 + 120 * Math.cos((angle * Math.PI) / 180)}
        y2={100 + 120 * Math.sin((angle * Math.PI) / 180)}
        stroke={color} strokeWidth="0.4" opacity="0.3"
      />
    ))}
  </svg>
);

export const FileItem: React.FC<FileItemProps> = ({
  file, onSelect, onTogglePin, onDelete, onShare, onMove, onRename,
  isOffline, isPinned, isActiveMenu, setActiveMenu, isExpanding
}) => {
  const isFolder = file.mimeType === MIME_TYPES.FOLDER;
  const isMindmap = file.name.endsWith('.mindmap');
  const menuRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const tone = parchmentTone(file.id);
  const coords = coordinates(file.id);
  const displayName = file.name.length > 30 ? file.name.slice(0, 28) + '…' : file.name;

  useEffect(() => {
    if (!isActiveMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isActiveMenu, setActiveMenu]);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Philosopher:ital,wght@0,400;0,700;1,400&display=swap');
        .carta-card {
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, filter 0.3s ease;
        }
        .carta-card:hover {
          transform: translateY(-6px) rotate(-0.5deg);
          filter: sepia(0.1) contrast(1.02);
        }
        @keyframes carta-age {
          0%,100% { opacity: 0.04; }
          50% { opacity: 0.07; }
        }
        .carta-vignette { animation: carta-age 8s ease-in-out infinite; }
      `}</style>

      <button
        onClick={() => onSelect(file)}
        className="carta-card w-full text-left overflow-hidden"
        style={{
          background: tone.bg,
          border: `1px solid ${tone.aged}`,
          borderRadius: '1px',
          boxShadow: hovered
            ? `0 12px 40px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2), inset 0 0 40px rgba(0,0,0,0.06)`
            : `0 3px 12px rgba(0,0,0,0.25), inset 0 0 30px rgba(0,0,0,0.04)`,
          minHeight: '185px',
          position: 'relative',
        }}
      >
        {/* Linhas de rumo sutis */}
        <RhumbLines color={tone.aged} />

        {/* Textura de envelhecimento — vinheta nas bordas */}
        <div className="carta-vignette absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, transparent 50%, rgba(100,70,30,0.3) 100%)`,
          }}
        />

        {/* Bordas de mapa desgastadas */}
        <div className="absolute inset-[6px] pointer-events-none"
          style={{
            border: `1px solid ${tone.lines.replace('0.2)', '0.4)')}`,
            borderRadius: '1px',
          }}
        />

        <div className="relative z-10 p-4 flex flex-col gap-2">
          {/* Cabeçalho cartográfico */}
          <div className="flex items-start justify-between">
            {/* Rosa dos ventos */}
            <WindRose color={tone.aged} size={28} />

            {/* Coordenadas */}
            <div className="text-right">
              <p className="text-[8px] leading-tight"
                style={{ fontFamily: "'Spectral', serif", color: tone.aged, fontStyle: 'italic' }}>
                {coords.lat} / {coords.lon}
              </p>
              {isPinned && (
                <div className="inline-block w-2 h-2 rotate-45 mt-1"
                  style={{ background: tone.rubriq }} />
              )}
            </div>
          </div>

          {/* Linha decorativa de separação cartográfica */}
          <div className="flex items-center gap-1 my-1">
            <div className="h-px flex-1" style={{ background: tone.aged, opacity: 0.3 }} />
            <span style={{ color: tone.rubriq, fontSize: '10px', fontFamily: 'serif' }}>✦</span>
            <div className="h-px flex-1" style={{ background: tone.aged, opacity: 0.3 }} />
          </div>

          {/* Rubrica vermelha para tipo */}
          <p className="text-[8px] tracking-[0.2em] uppercase"
            style={{ fontFamily: "'Spectral', serif", color: tone.rubriq, fontStyle: 'italic' }}>
            {isFolder ? 'Terra Incognita' : isMindmap ? 'Carta Cognitiva' : 'Documentum'}
          </p>

          {/* Nome principal */}
          <p className="text-[14px] leading-snug"
            style={{
              fontFamily: "'Philosopher', 'Palatino Linotype', Georgia, serif",
              color: tone.ink,
              fontWeight: isFolder ? 700 : 400,
              fontStyle: isFolder ? 'normal' : 'italic',
            }}>
            {displayName}
          </p>

          {/* Footer: "hic sunt leones" para pastas, data para arquivos */}
          <div className="mt-auto pt-2 flex items-end justify-between">
            {isFolder ? (
              <p className="text-[9px] italic"
                style={{ fontFamily: "'Spectral', serif", color: `${tone.aged}`, opacity: 0.7 }}>
                hic sunt leones
              </p>
            ) : file.modifiedTime ? (
              <p className="text-[9px] italic"
                style={{ fontFamily: "'Spectral', serif", color: tone.aged, opacity: 0.7 }}>
                {new Date(file.modifiedTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            ) : <div />}

            {isOffline && (
              <div className="w-2 h-2 rounded-full"
                style={{ background: 'rgba(40,140,60,0.7)', boxShadow: '0 0 4px rgba(40,140,60,0.4)' }} />
            )}
          </div>
        </div>

        {isExpanding && (
          <div className="absolute inset-0 bg-[#f2e8d0]/70 flex items-center justify-center backdrop-blur-sm">
            <div className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: tone.rubriq, borderTopColor: 'transparent' }} />
          </div>
        )}
      </button>

      {/* Menu */}
      <div ref={menuRef} className="absolute top-2 right-2 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }}
          className="p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded"
          style={{ color: tone.aged, background: `${tone.bg}cc` }}
        >
          <MoreVertical size={13} />
        </button>

        {isActiveMenu && (
          <div className="absolute right-0 top-7 w-44 z-50 animate-in fade-in duration-150"
            style={{
              background: tone.bg,
              border: `1px solid ${tone.aged}`,
              borderRadius: '1px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              fontFamily: "'Spectral', serif",
            }}>
            {[
              { icon: <Pin size={12} />, label: isPinned ? 'Desafixar' : 'Fixar', action: () => onTogglePin(file) },
              { icon: <Edit3 size={12} />, label: 'Renomear', action: () => onRename(file) },
              { icon: <FolderInput size={12} />, label: 'Mover', action: () => onMove(file) },
              { icon: <Share2 size={12} />, label: 'Compartilhar', action: () => onShare(file) },
              { icon: <Trash2 size={12} />, label: 'Excluir', action: () => onDelete(file), danger: true },
            ].map(({ icon, label, action, danger }: any) => (
              <button key={label}
                onClick={(e) => { e.stopPropagation(); action(); setActiveMenu(null); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] italic transition-colors"
                style={{ color: danger ? tone.rubriq : tone.ink }}
                onMouseEnter={e => (e.currentTarget.style.background = `${tone.aged}22`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
