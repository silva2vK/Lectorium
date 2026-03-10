import React, { useEffect, useState, useRef } from 'react';
import { BrainCircuit, FileText, File as FileIcon, Pin, Clock, Menu, Zap, Cloud, AlertCircle, CheckCircle, Database, Workflow, FolderOpen, Upload, FilePlus, LifeBuoy, ArrowRight, X, HardDrive, Server } from 'lucide-react';
import { DriveFile, StorageMode } from '../types';
import { getRecentFiles, getStorageEstimate, clearAppStorage, StorageBreakdown, runJanitor, getWallpaper } from '../services/storageService';
import { useSync } from '../hooks/useSync';
import { SyncStatusModal } from './SyncStatusModal';
import { Icon } from './shared/Icon';
import { GlobalHelpModal } from './GlobalHelpModal';
import { useGlobalContext } from '../context/GlobalContext';
import { createVirtualDirectoryHandle } from '../services/localFileService';

interface DashboardProps {
  userName?: string | null;
  onOpenFile: (file: DriveFile) => void;
  onUploadLocal: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCreateMindMap: () => void;
  onCreateDocument: () => void;
  onCreateFileFromBlob: (blob: Blob, name: string, mimeType: string) => void;
  onChangeView: (view: 'browser' | 'offline' | 'mindmaps') => void;
  onToggleMenu: () => void;
  storageMode?: StorageMode;
  onToggleStorageMode?: (mode: StorageMode) => void;
  onLogin?: () => void;
  onOpenLocalFolder?: (manualHandle?: any) => void;
  savedLocalDirHandle?: any;
  onReconnectLocalFolder?: () => void;
  syncStrategy?: 'smart' | 'online';
  onToggleSyncStrategy?: (strategy: 'smart' | 'online') => void;
}

// Configuração de Escala Responsiva (Mobile First) - Tamanhos aumentados (+3px aprox)
const getScaleStyles = (scale: number) => {
    const config: Record<number, any> = {
        1: { 
            gap: 'gap-3 md:gap-4',
            p: 'p-3 md:p-4',
            iconWrap: 'w-10 h-10', 
            iconClass: 'w-5 h-5', 
            title: 'text-sm md:text-base', 
            recentP: 'p-3',
            recentGap: 'gap-3',
            recentIconWrap: 'w-10 h-10',
            recentIconClass: 'w-5 h-5'
        },
        2: { 
            gap: 'gap-3 md:gap-4', 
            p: 'p-3 md:p-5', 
            iconWrap: 'w-10 h-10 md:w-12 md:h-12', 
            iconClass: 'w-5 h-5 md:w-6 md:h-6', 
            title: 'text-base', 
            recentP: 'p-3 md:p-3.5',
            recentGap: 'gap-3 md:gap-4', 
            recentIconWrap: 'w-10 h-10 md:w-12 md:h-12',
            recentIconClass: 'w-5 h-5 md:w-[22px] md:h-[22px]'
        },
        3: { // Default
            gap: 'gap-3 md:gap-4', 
            p: 'p-4 md:p-6', 
            iconWrap: 'w-10 h-10 md:w-14 md:h-14', 
            iconClass: 'w-5 h-5 md:w-7 md:h-7', 
            title: 'text-base md:text-lg', 
            recentP: 'p-3 md:p-4',
            recentGap: 'gap-3 md:gap-5',
            recentIconWrap: 'w-12 h-12 md:w-14 md:h-14',
            recentIconClass: 'w-6 h-6'
        },
        4: { 
            gap: 'gap-3 md:gap-4', 
            p: 'p-4 md:p-8', 
            iconWrap: 'w-12 h-12 md:w-16 md:h-16', 
            iconClass: 'w-6 h-6 md:w-8 md:h-8', 
            title: 'text-lg md:text-xl', 
            recentP: 'p-4 md:p-5',
            recentGap: 'gap-3 md:gap-5',
            recentIconWrap: 'w-12 h-12 md:w-16 md:h-16',
            recentIconClass: 'w-6 h-6 md:w-7 md:h-7'
        },
        5: { 
            gap: 'gap-3', 
            p: 'p-5 md:p-10', 
            iconWrap: 'w-14 h-14 md:w-20 md:h-20', 
            iconClass: 'w-7 h-7 md:w-10 md:h-10', 
            title: 'text-xl md:text-2xl', 
            recentP: 'p-4 md:p-6',
            recentGap: 'gap-4 md:gap-6',
            recentIconWrap: 'w-14 h-14 md:w-20 md:h-20',
            recentIconClass: 'w-7 h-7 md:w-8 md:h-8'
        },
    };
    return config[scale] || config[3];
};

interface RecentFileItemProps {
    file: DriveFile & { lastOpened: Date };
    styles: any;
    onClick: () => void;
}

const RecentFileItem: React.FC<RecentFileItemProps> = ({ file, styles, onClick }) => {
    return (
        <div 
            onClick={onClick} 
            className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer active:scale-95 border border-transparent hover:border-white/10"
        >
            {/* The Maker Aesthetic: Futuristic/Scientific Container */}
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                {/* Background: Deep Tech Blue with subtle gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-xl border border-blue-500/20 group-hover:border-blue-400/50 shadow-[0_0_15px_-5px_rgba(59,130,246,0.2)] group-hover:shadow-[0_0_20px_-5px_rgba(59,130,246,0.4)] transition-all duration-500"></div>
                
                {/* Icon with "Holographic" effect colors */}
                <div className="relative z-10 transition-colors duration-300">
                    {file.name.endsWith('.mindmap') ? (
                        <BrainCircuit size={22} className="text-purple-300 group-hover:text-purple-200 drop-shadow-[0_0_5px_rgba(168,85,247,0.4)]" />
                    ) : file.mimeType.includes('document') ? (
                        <FileText size={22} className="text-cyan-300 group-hover:text-cyan-200 drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]" />
                    ) : (
                        <FileIcon size={22} className="text-blue-300 group-hover:text-blue-200 drop-shadow-[0_0_5px_rgba(59,130,246,0.4)]" />
                    )}
                </div>

                {file.pinned && (
                    <div className="absolute -top-1 -right-1 z-20 text-cyan-400 bg-[#020617] rounded-full p-0.5 border border-cyan-500/50 shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                        <Pin size={9} fill="currentColor" />
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1 flex flex-col justify-center">
                <h3 className="font-sans font-bold text-[15px] text-gray-100 truncate tracking-tight leading-snug mb-0.5 group-hover:text-white transition-colors">
                    {file.name}
                </h3>
                <p className="text-[10px] text-blue-400/50 font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors group-hover:text-blue-400">
                    <Clock size={10} /> {new Date(file.lastOpened).toLocaleDateString()}
                </p>
            </div>
        </div>
    );
};

// ── Ícones SVG da cultura chinesa ─────────────────────────────────────────────

// Ba Gua / Trigramas — Meus Arquivos
const IconBaGua = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="32" cy="32" r="22" strokeWidth="1.2"/>
    <path d="M32 20 A12 12 0 0 1 32 44 A6 6 0 0 1 32 32 A6 6 0 0 0 32 20Z" strokeWidth="1.2"/>
    <circle cx="32" cy="26" r="2" fill="currentColor" stroke="none"/>
    <circle cx="32" cy="38" r="2" strokeWidth="1.2"/>
    <line x1="22" y1="10" x2="30" y2="10"/><line x1="34" y1="10" x2="42" y2="10"/>
    <line x1="22" y1="7" x2="42" y2="7"/>
    <line x1="22" y1="54" x2="42" y2="54"/>
    <line x1="22" y1="57" x2="30" y2="57"/><line x1="34" y1="57" x2="42" y2="57"/>
    <line x1="10" y1="22" x2="10" y2="42"/>
    <line x1="7" y1="22" x2="7" y2="30"/><line x1="7" y1="34" x2="7" y2="42"/>
    <line x1="54" y1="22" x2="54" y2="42"/>
    <line x1="57" y1="22" x2="57" y2="30"/><line x1="57" y1="34" x2="57" y2="42"/>
  </svg>
);

// Dragão — Abrir Arquivo
const IconDragon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 46 C14 38 22 36 28 40 C32 42 34 38 32 32 C30 26 34 18 40 20 C46 22 48 30 44 36 C48 40 54 38 56 30"/>
    <path d="M28 40 C24 46 24 54 30 56 C36 58 42 52 40 46"/>
    <path d="M10 46 C6 48 5 54 9 55 C13 56 15 50 12 46"/>
    <circle cx="42" cy="19" r="2.5" fill="currentColor" stroke="none"/>
    <path d="M47 15 L51 11 M51 15 L47 11" strokeWidth="1.4"/>
    <path d="M56 30 C58 24 56 16 50 14"/>
    <path d="M40 46 C40 50 36 54 32 52"/>
  </svg>
);

// 文 (Wén — cultura, escrita) — Novo Documento
const IconWen = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="20" y1="14" x2="44" y2="14"/>
    <line x1="32" y1="14" x2="32" y2="24"/>
    <line x1="22" y1="30" x2="42" y2="30"/>
    <path d="M32 24 L18 38"/>
    <path d="M32 24 L46 38"/>
    <path d="M18 38 C15 46 20 54 28 55"/>
    <path d="M46 38 C49 46 44 54 36 55"/>
    <path d="M28 55 C30 57 34 57 36 55"/>
  </svg>
);

// Fênix — Suporte
const IconPhoenix = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M32 48 C32 48 18 40 16 28 C14 16 22 10 32 14 C42 10 50 16 48 28 C46 40 32 48 32 48Z"/>
    <path d="M32 14 L32 8"/>
    <path d="M24 17 C18 10 8 12 6 20"/>
    <path d="M40 17 C46 10 56 12 58 20"/>
    <path d="M18 30 C12 32 8 40 12 47"/>
    <path d="M46 30 C52 32 56 40 52 47"/>
    <path d="M32 48 L28 58 M32 48 L36 58"/>
    <circle cx="32" cy="26" r="5" strokeWidth="1.2"/>
    <circle cx="32" cy="26" r="2" fill="currentColor" stroke="none"/>
  </svg>
);

const CHINESE_ICONS = [IconBaGua, IconDragon, IconWen, IconPhoenix];

const ActionTile = ({ onClick, title, subtitle, iconIndex = 0, gradientClass, iconColorClass, borderColorClass }: any) => {
    const ChineseIcon = CHINESE_ICONS[iconIndex % CHINESE_ICONS.length];
    return (
        <button
            onClick={onClick}
            className="group flex flex-col items-center gap-2 w-full"
        >
            <div className={`
                relative w-full aspect-[2/1] rounded-2xl bg-[#09090b] border border-white/35
                overflow-hidden transition-all duration-300
                group-hover:border-opacity-100 group-hover:shadow-2xl group-active:scale-95
                flex items-center justify-center
                ${borderColorClass}
            `}>
                <div className={`absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-20 ${gradientClass}`} />
                <div className={`
                    flex items-center justify-center
                    transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3
                    ${iconColorClass}
                `}>
                    <ChineseIcon className="w-12 h-12 md:w-16 md:h-16" />
                </div>
            </div>
            <div className="flex flex-col items-center text-center px-1">
                <span className="text-sm md:text-base font-bold text-white uppercase tracking-wider transition-colors line-clamp-1">
                    {title}
                </span>
                <span className="text-[13px] text-white font-medium mt-0.5 line-clamp-1 hidden md:block">
                    {subtitle}
                </span>
            </div>
        </button>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ 
    userName, onOpenFile, onUploadLocal, onCreateMindMap, onCreateDocument, 
    onCreateFileFromBlob, onChangeView, onToggleMenu, storageMode, onToggleStorageMode,
    onLogin, onOpenLocalFolder, savedLocalDirHandle, onReconnectLocalFolder,
    syncStrategy = 'smart', onToggleSyncStrategy
}) => {
  const [recents, setRecents] = useState<(DriveFile & { lastOpened: Date })[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false); 
  const [storageData, setStorageData] = useState<StorageBreakdown | null>(null);
  const [wallpapers, setWallpapers] = useState<{ landscape: string | null, portrait: string | null }>({ landscape: null, portrait: null });
  
  // Estado de Orientação (Landscape vs Portrait) para UI Responsiva
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
      typeof window !== 'undefined' ? (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait') : 'landscape'
  );
  
  // Referência para o input de arquivo (Upload Local)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detecção de Mobile/WebView
  // Se for mobile, assumimos que NÃO há suporte completo a Native File System (showDirectoryPicker falha em WebViews)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasNativeFS = 'showDirectoryPicker' in window && !isMobile;
  const isEmbedded = window.self !== window.top;

  const { dashboardScale } = useGlobalContext();
  const styles = getScaleStyles(dashboardScale);

  const { syncStatus, queue, triggerSync, removeItem, clearQueue } = useSync({ 
      accessToken: localStorage.getItem('drive_access_token'), 
      onAuthError: () => {},
      autoSync: false 
  });

  const loadWallpapers = async () => {
    const lBlob = await getWallpaper('landscape');
    const pBlob = await getWallpaper('portrait');
    setWallpapers(prev => {
        if (prev.landscape) URL.revokeObjectURL(prev.landscape);
        if (prev.portrait) URL.revokeObjectURL(prev.portrait);
        return {
            landscape: lBlob ? URL.createObjectURL(lBlob) : null,
            portrait: pBlob ? URL.createObjectURL(pBlob) : null
        };
    });
  };

  useEffect(() => {
    loadWallpapers();
    const handleUpdate = () => loadWallpapers();
    window.addEventListener('wallpaper-changed', handleUpdate);
    
    // Listener de Orientação e Redimensionamento
    const handleResize = () => {
        setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Check inicial
    handleResize();

    return () => {
        window.removeEventListener('wallpaper-changed', handleUpdate);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
        if (wallpapers.landscape) URL.revokeObjectURL(wallpapers.landscape);
        if (wallpapers.portrait) URL.revokeObjectURL(wallpapers.portrait);
    };
  }, []);

  useEffect(() => {
    getRecentFiles().then(setRecents);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const openStorageModal = async () => {
    setShowStorageModal(true);
    const estimate = await getStorageEstimate();
    if (estimate) setStorageData(estimate);
  };

  const handleManualJanitor = async () => {
      await runJanitor();
      const estimate = await getStorageEstimate();
      setStorageData(estimate);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      if (files.length === 1) {
          // SELECIONOU 1 ARQUIVO: Abre direto no Editor (Bypass na "Pasta Local")
          const file = files[0];
          onCreateFileFromBlob(file, file.name, file.type);
      } else if (onOpenLocalFolder) {
          // SELECIONOU VÁRIOS: Cria handle virtual e mostra lista
          const virtualHandle = createVirtualDirectoryHandle(files);
          onOpenLocalFolder(virtualHandle);
      }
      
      // Limpa input para permitir re-seleção
      e.target.value = '';
  };

  // Wrapper para abrir o seletor de arquivos
  const handleLocalUploadClick = () => {
      fileInputRef.current?.click();
  };

  const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isVisitor = !userName || userName === 'Visitante';

  return (
    <div className="flex-1 h-full overflow-hidden bg-bg text-text relative font-sans">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-transparent">
          {/* Wallpapers com Fallback Inteligente e Detecção de Orientação */}
          {(wallpapers.landscape || wallpapers.portrait) && (
              <img 
                src={
                    orientation === 'landscape' 
                    ? (wallpapers.landscape || wallpapers.portrait || '') 
                    : (wallpapers.portrait || wallpapers.landscape || '')
                } 
                className="absolute inset-0 w-full h-full object-cover opacity-50 scale-105 transition-all duration-700 ease-in-out" 
                alt="Background" 
                key={orientation} // Força transição suave ao trocar de modo
              />
          )}
          {/* Apenas um gradiente sutil para legibilidade, permitindo a cor de fundo do tema passar */}
          <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/20 to-bg/50 z-10" />
      </div>

      <div className="relative z-10 h-full flex flex-col px-4 md:px-12 py-4 md:py-6 overflow-hidden">
          <div className="shrink-0 flex flex-wrap justify-between items-center gap-4 mb-3 md:mb-4">
            <button 
                onClick={onToggleMenu} 
                className="maker-menu-btn p-3 -ml-3 text-white bg-black border-2 border-brand/40 rounded-2xl transition-all hover:bg-[#111] hover:border-brand hover:shadow-[0_0_15px_-5px_var(--brand)] active:scale-95 shadow-2xl"
                title="Abrir Menu"
            >
              <Menu size={28} className="text-brand" />
            </button>
            
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                {onToggleSyncStrategy && (
                    <div className="maker-target-group flex items-center bg-[#0a0a0a]/90 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg">
                        <button 
                            onClick={() => onToggleSyncStrategy('smart')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 ${syncStrategy === 'smart' ? 'bg-brand text-[#0b141a] shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <Zap size={12} fill={syncStrategy === 'smart' ? 'currentColor' : 'none'} /> Smart Sync
                        </button>
                        <div className="w-px h-3 bg-white/10 mx-1"></div>
                        <button 
                            onClick={() => onToggleSyncStrategy('online')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 ${syncStrategy === 'online' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <Cloud size={12} fill={syncStrategy === 'online' ? 'currentColor' : 'none'} /> Online Puro
                        </button>
                    </div>
                )}

                <button 
                    onClick={() => setShowSyncModal(true)}
                    className={`maker-target-btn h-9 flex items-center gap-2 px-3 bg-[#0a0a0a]/80 backdrop-blur-md border rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg ${
                        queue.length > 0 
                            ? 'border-yellow-500/50 text-yellow-500 animate-pulse hover:bg-yellow-500/10' 
                            : 'border-white/10 text-gray-300 hover:text-white hover:border-brand/30 hover:text-brand'
                    }`}
                >
                    {queue.length > 0 ? (
                        <><AlertCircle size={14} /> <span className="font-mono">{queue.length}</span> <span className="hidden sm:inline">PENDENTES</span></>
                    ) : (
                        <><CheckCircle size={14} className="text-green-500"/> <span className="hidden sm:inline tracking-wider">SINCRONIZADO</span></>
                    )}
                </button>

                <button 
                    onClick={openStorageModal} 
                    className="maker-target-btn h-9 flex items-center gap-2 px-3 bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 rounded-xl text-gray-300 hover:text-white hover:border-white/30 transition-all text-xs font-bold active:scale-95 shadow-lg uppercase tracking-wider"
                >
                    <Database size={14} /> <span className="hidden sm:inline">Armazenamento</span>
                </button>
            </div>
          </div>

          <header className="flex-1 min-h-0 flex flex-col justify-center animate-in fade-in slide-in-from-left-6 duration-700 pb-2">
            <h1 className="text-5xl md:text-7xl font-light text-white mb-4 tracking-tight leading-tight">
              {(new Date().getHours() >= 5 && new Date().getHours() < 12) ? 'Bom dia' : (new Date().getHours() >= 12 && new Date().getHours() < 18) ? 'Boa tarde' : 'Boa noite'}, <br/>
              <span className="text-brand font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand to-brand-to">
                  {userName?.split(' ')[0] || 'Visitante'}
              </span>
            </h1>
            <div className="flex flex-col md:flex-row md:items-center gap-6">
                <p className="hidden md:block text-base md:text-xl lg:text-2xl text-white drop-shadow-md max-w-xl font-light leading-relaxed">
                    {syncStrategy === 'smart' ? "Seus documentos estão seguros e prontos para consulta, com ou sem conexão." : "Conectado ao Drive em tempo real. Os data não serão salvos neste dispositivo."}
                </p>
                <div className="md:hidden h-4" /> 
                {isVisitor && onLogin && (
                    <button onClick={onLogin} className="flex items-center gap-3 bg-white text-black hover:bg-brand hover:text-[#0b141a] px-6 py-3 rounded-2xl transition-all group self-start font-bold text-base active:scale-95 shadow-lg">
                        <Cloud size={20} className="group-hover:scale-110 transition-transform" />
                        <span>Conectar ao Drive</span>
                    </button>
                )}
            </div>
          </header>

          <div className="shrink-0 flex flex-col lg:flex-row gap-4 lg:gap-10 lg:justify-between items-start pb-4">
            <div className="w-full lg:max-w-4xl">
              <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em] mb-6 px-1 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand"></div> Ações Rápidas
              </h2>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {isVisitor ? (
                    <ActionTile 
                        onClick={() => onChangeView('mindmaps')}
                        title="Mapas Mentais"
                        subtitle="Canvas Infinito"
                        iconIndex={0}
                        iconColorClass="text-purple-400"
                        gradientClass="from-purple-500/10 to-transparent"
                        borderColorClass="hover:border-purple-500/50"
                    />
                ) : (
                    <ActionTile 
                        onClick={() => onChangeView('browser')}
                        title="Meus Arquivos"
                        subtitle={isOnline ? "Nuvem + Local" : "Modo Offline"}
                        iconIndex={0}
                        iconColorClass="text-brand"
                        gradientClass="from-brand/10 to-transparent"
                        borderColorClass="hover:border-brand/50"
                    />
                )}

                {/* Bloco de Abertura Direta - Comportamento híbrido (1 arquivo = open, N = list) */}
                <ActionTile 
                    onClick={handleLocalUploadClick}
                    title="ABRIR ARQUIVO"
                    subtitle="Abrir do Dispositivo"
                    iconIndex={1}
                    iconColorClass="text-orange-500"
                    gradientClass="from-orange-500/10 to-transparent"
                    borderColorClass="hover:border-orange-500/50"
                />
                {/* Input Hidden para File Upload (Multiple Files) */}
                <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept=".pdf,.docx,.doc,.mindmap,.lect,.json,.txt,.md,.jpg,.jpeg,.png,.webp,.heic,.heif,.tiff,.tif,.dcm,.cbz,.cbr"
                    onChange={handleFileInputChange}
                />

                <ActionTile 
                    onClick={onCreateDocument}
                    title="Novo Documento"
                    subtitle="Editor ABNT"
                    iconIndex={2}
                    iconColorClass="text-blue-500"
                    gradientClass="from-blue-500/10 to-transparent"
                    borderColorClass="hover:border-blue-500/50"
                />

                <ActionTile 
                    onClick={() => setShowHelpModal(true)}
                    title="Suporte"
                    subtitle="Guias e Tutoriais"
                    iconIndex={3}
                    iconColorClass="text-purple-500"
                    gradientClass="from-purple-500/10 to-transparent"
                    borderColorClass="hover:border-purple-500/50"
                />
              </div>
            </div>

            <div className="w-full lg:w-[380px] shrink-0 lg:mt-0">
              <div className="flex items-center justify-between mb-6 md:mb-8 px-1">
                <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <Clock size={16}/> Recentes
                </h2>
                <button onClick={() => onChangeView('browser')} className="text-[14px] font-bold text-brand hover:brightness-125 flex items-center gap-1 transition-all active:scale-95">VER TODOS <ArrowRight size={14}/></button>
              </div>
              <div className="space-y-4">
                {recents.slice(0, 3).map((file) => (
                    <RecentFileItem 
                        key={file.id} 
                        file={file} 
                        styles={styles} 
                        onClick={() => onOpenFile(file)} 
                    />
                ))}
                {recents.length === 0 && (
                  <div className="text-center py-16 bg-white/5 rounded-[2rem] border border-dashed border-white/20">
                    <Clock size={32} className="mx-auto mb-3 text-white" />
                    <p className="text-base text-white">Sua jornada acadêmica começa aqui.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>

      <GlobalHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      <SyncStatusModal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} queue={queue} isSyncing={syncStatus.active} onForceSync={triggerSync} onRemoveItem={removeItem} onClearQueue={clearQueue} />

      {showStorageModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-[#1e1e1e] border border-white/10 rounded-[2.5rem] p-8 max-w-md w-full relative">
                  <button onClick={() => setShowStorageModal(false)} className="absolute top-6 right-6 text-white hover:text-white transition-colors active:scale-95"><X size={24}/></button>
                  <div className="flex items-center gap-4 mb-8">
                      <div className="bg-brand/10 p-3 rounded-2xl text-brand"><Database size={28} /></div>
                      <h3 className="text-2xl font-bold text-white">Armazenamento</h3>
                  </div>
                  <div className="bg-black p-6 rounded-3xl border border-white/5 mb-8">
                      <div className="flex justify-between items-end mb-4">
                          <span className="text-base text-white">Uso Total: <span className="text-white font-bold">{storageData ? formatBytes(storageData.usage) : '...'}</span></span>
                          <button onClick={handleManualJanitor} className="text-[12px] text-brand font-bold bg-brand/10 px-3 py-1 rounded-full hover:bg-brand hover:text-black transition-all active:scale-95">LIMPAR CACHE</button>
                      </div>
                      
                      <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden mb-4">
                          <div className="h-full bg-gradient-to-r from-brand to-brand-to transition-all duration-1000" style={{ width: storageData ? `${Math.min(100, (storageData.usage / (storageData.quota || 1)) * 100)}%` : '0%' }} />
                      </div>

                      {storageData?.details && (
                          <div className="grid grid-cols-3 gap-2 mt-4 text-[12px]">
                              <div className="bg-white/5 p-2 rounded-xl flex flex-col items-center gap-1 border border-white/5">
                                  <HardDrive size={16} className="text-white"/>
                                  <span className="block text-white font-bold text-sm">{formatBytes(storageData.details.offlineFiles)}</span>
                                  <span className="text-white text-center leading-tight">Arquivos Offline</span>
                              </div>
                              <div className="bg-white/5 p-2 rounded-xl flex flex-col items-center gap-1 border border-white/5">
                                  <Server size={16} className="text-white"/>
                                  <span className="block text-white font-bold text-sm">{formatBytes(storageData.details.cache)}</span>
                                  <span className="text-white text-center leading-tight">Cache App</span>
                              </div>
                              <div className="bg-white/5 p-2 rounded-xl flex flex-col items-center gap-1 border border-white/5">
                                  <FileIcon size={16} className="text-white"/>
                                  <span className="block text-white font-bold text-sm">{formatBytes(storageData.details.system)}</span>
                                  <span className="text-white text-center leading-tight">Sistema</span>
                              </div>
                          </div>
                      )}
                  </div>
                  <button onClick={clearAppStorage} className="w-full py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl text-sm font-bold hover:bg-red-500 hover:text-white transition-all active:scale-95">REDEFINIR APLICAÇÃO (APAGAR TUDO)</button>
              </div>
          </div>
      )}
    </div>
  );
};
