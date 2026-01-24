
import React, { useEffect, useState } from 'react';
import { DriveFile } from '../types';
import { getRecentFiles, getStorageEstimate, clearAppStorage, StorageBreakdown, runJanitor, getWallpaper } from '../services/storageService';
import { useSync } from '../hooks/useSync';
import { SyncStatusModal } from './SyncStatusModal';
import { FileText, Menu, Workflow, FilePlus, Database, X, Zap, Pin, Cloud, AlertCircle, CheckCircle, ArrowRight, Clock, HardDrive, Server, File, FolderOpen, LifeBuoy } from 'lucide-react';
import { GlobalHelpModal } from './GlobalHelpModal';
import { useGlobalContext } from '../context/GlobalContext';

interface DashboardProps {
  userName?: string | null;
  onOpenFile: (file: DriveFile) => void;
  onUploadLocal: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCreateMindMap: () => void;
  onCreateDocument: () => void;
  onCreateFileFromBlob: (blob: Blob, name: string, mimeType: string) => void;
  onChangeView: (view: 'browser' | 'offline' | 'mindmaps') => void;
  onToggleMenu: () => void;
  storageMode?: string;
  onToggleStorageMode?: (mode: string) => void;
  onLogin?: () => void;
  onOpenLocalFolder?: () => void;
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
            className="group flex items-center gap-5 p-3 rounded-lg hover:bg-white/5 transition-all cursor-pointer active:scale-95"
        >
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-red-900 to-black border-2 border-red-600 rotate-45 shadow-[0_0_15px_rgba(220,38,38,0.5)] group-hover:shadow-[0_0_25px_rgba(220,38,38,0.8)] group-hover:border-red-500 transition-all duration-300"></div>
                <div className="relative z-10 text-white group-hover:text-white transition-colors">
                    {file.name.endsWith('.mindmap') ? <Workflow size={20} className="text-red-200" /> : 
                     file.mimeType.includes('document') ? <FilePlus size={20} className="text-red-200" /> : 
                     <FileText size={20} className="text-red-200" />}
                </div>

                {file.pinned && (
                    <div className="absolute -top-1 -right-1 z-20 text-yellow-500 bg-black rounded-full p-0.5 border border-yellow-600 shadow-sm">
                        <Pin size={8} fill="currentColor" />
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1 flex flex-col justify-center">
                <h3 className="font-gothic text-[27px] text-white truncate tracking-wide leading-none mb-1 group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] transition-all">
                    {file.name}
                </h3>
                <p className="text-[13px] text-red-400 font-mono uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                    <Clock size={12} /> {new Date(file.lastOpened).toLocaleDateString()}
                </p>
            </div>
        </div>
    );
};

const ActionTile = ({ onClick, title, subtitle, icon: Icon, gradientClass, iconColorClass, borderColorClass }: any) => (
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
                <Icon className="w-12 h-12 md:w-16 md:h-16" strokeWidth={1.5} />
            </div>
        </div>

        <div className="flex flex-col items-center text-center px-1">
            <span className="text-sm md:text-base font-bold text-white group-hover:text-white uppercase tracking-wider transition-colors line-clamp-1">
                {title}
            </span>
            <span className="text-[13px] text-white group-hover:text-white font-medium mt-0.5 line-clamp-1 hidden md:block">
                {subtitle}
            </span>
        </div>
    </button>
);

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
    
    return () => {
        window.removeEventListener('wallpaper-changed', handleUpdate);
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
          {wallpapers.landscape && (
              <img src={wallpapers.landscape} className="hidden md:block absolute inset-0 w-full h-full object-cover opacity-50 scale-105" alt="" />
          )}
          {wallpapers.portrait && (
              <img src={wallpapers.portrait} className="md:hidden absolute inset-0 w-full h-full object-cover opacity-50 scale-105" alt="" />
          )}
          {/* Apenas um gradiente sutil para legibilidade, permitindo a cor de fundo do tema passar */}
          <div className="absolute inset-0 bg-gradient-to-br from-bg/20 via-bg/40 to-bg/90 z-10" />
      </div>

      <div className="relative z-10 h-full overflow-y-auto p-4 md:px-12 md:py-9 custom-scrollbar">
          <div className="mb-6 md:mb-10 flex flex-wrap justify-between items-center gap-4">
            <button 
                onClick={onToggleMenu} 
                className="maker-menu-btn p-3 -ml-3 text-white bg-black border-2 border-brand/40 rounded-2xl transition-all hover:bg-[#111] hover:border-brand hover:shadow-[0_0_15px_-5px_var(--brand)] active:scale-95 shadow-2xl"
                title="Abrir Menu"
            >
              <Menu size={28} className="text-brand" />
            </button>
            
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                {onToggleSyncStrategy && (
                    <div className="maker-target-group flex bg-black p-1.5 rounded-2xl border border-white/35">
                        <button 
                            onClick={() => onToggleSyncStrategy('smart')}
                            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${syncStrategy === 'smart' ? 'bg-brand text-[#0b141a]' : 'text-white hover:text-white'}`}
                        >
                            <Zap size={14} /> <span className="hidden sm:inline">Smart Sync</span>
                        </button>
                        <button 
                            onClick={() => onToggleSyncStrategy('online')}
                            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${syncStrategy === 'online' ? 'bg-blue-500 text-white' : 'text-white hover:text-white'}`}
                        >
                            <Cloud size={14} /> <span className="hidden sm:inline">Online Puro</span>
                        </button>
                    </div>
                )}

                <button 
                    onClick={() => setShowSyncModal(true)}
                    className={`maker-target-btn flex items-center gap-2 px-3 md:px-4 py-2.5 bg-black border rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                        queue.length > 0 ? 'border-yellow-500/50 text-yellow-500 animate-pulse' : 'border-white/35 text-white hover:text-white'
                    }`}
                >
                    {queue.length > 0 ? <><AlertCircle size={14} /> <span className="hidden sm:inline">{queue.length} Pendentes</span><span className="sm:hidden">{queue.length}</span></> : <><CheckCircle size={14} className="text-brand"/> <span className="hidden sm:inline">Sincronizado</span></>}
                </button>

                <button onClick={openStorageModal} className="maker-target-btn flex items-center gap-2 px-3 md:px-4 py-2.5 bg-black border border-white/35 rounded-2xl text-white hover:text-white transition-all text-sm font-bold active:scale-95">
                    <Database size={14} /> <span className="hidden sm:inline">Armazenamento</span>
                </button>
            </div>
          </div>

          <header className="mb-16 md:mb-28 animate-in fade-in slide-in-from-left-6 duration-700">
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

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 lg:justify-between items-start mb-20">
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
                        icon={Workflow}
                        iconColorClass="text-purple-400"
                        gradientClass="from-purple-500/10 to-transparent"
                        borderColorClass="hover:border-purple-500/50"
                    />
                ) : (
                    <ActionTile 
                        onClick={() => onChangeView('browser')}
                        title="Meus Arquivos"
                        subtitle={isOnline ? "Nuvem + Local" : "Modo Offline"}
                        icon={FolderOpen}
                        iconColorClass="text-brand"
                        gradientClass="from-brand/10 to-transparent"
                        borderColorClass="hover:border-brand/50"
                    />
                )}

                {/* Alternância Inteligente: Se for Mobile/Embedded, usa input simples. Se for Desktop, usa API de Pastas */}
                {(!hasNativeFS || isEmbedded) ? (
                    <label className="group flex flex-col items-center gap-2 w-full cursor-pointer">
                        <div className="relative w-full aspect-[2/1] rounded-2xl bg-[#09090b] border border-white/35 overflow-hidden transition-all duration-300 group-hover:border-orange-500/50 group-hover:shadow-2xl group-active:scale-95 flex items-center justify-center">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-20" />
                            <div className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 text-orange-500">
                                <HardDrive className="w-12 h-12 md:w-16 md:h-16" strokeWidth={1.5} />
                            </div>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <span className="text-sm md:text-base font-bold text-white group-hover:text-white uppercase tracking-wider transition-colors line-clamp-1">
                                Abrir Local
                            </span>
                            <span className="text-[13px] text-white group-hover:text-white font-medium mt-0.5 line-clamp-1 hidden md:block">
                                Upload do Dispositivo
                            </span>
                        </div>
                        <input type="file" className="hidden" onChange={onUploadLocal} />
                    </label>
                ) : (
                    <ActionTile 
                        onClick={savedLocalDirHandle ? onReconnectLocalFolder : onOpenLocalFolder}
                        title={savedLocalDirHandle ? 'Reconectar' : 'Pasta Local'}
                        subtitle="Acesso Nativo"
                        icon={HardDrive}
                        iconColorClass="text-orange-500"
                        gradientClass="from-orange-500/10 to-transparent"
                        borderColorClass="hover:border-orange-500/50"
                    />
                )}

                <ActionTile 
                    onClick={onCreateDocument}
                    title="Novo Documento"
                    subtitle="Editor ABNT"
                    icon={FilePlus}
                    iconColorClass="text-blue-500"
                    gradientClass="from-blue-500/10 to-transparent"
                    borderColorClass="hover:border-blue-500/50"
                />

                <ActionTile 
                    onClick={() => setShowHelpModal(true)}
                    title="Suporte"
                    subtitle="Guias e Tutoriais"
                    icon={LifeBuoy}
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
                {recents.slice(0, 5).map((file) => (
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
                                  <File size={16} className="text-white"/>
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
