
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../src/components/shared/Icon';
import { User } from 'firebase/auth';
import { ThemeSwitcher } from './ThemeSwitcher';
import { DriveFile } from '../types';
import { cacheAppResources, getOfflineCacheSize, ResourceCategory, deleteOfflineResources } from '../services/offlineService';
import { OfflineDownloadModal } from './OfflineDownloadModal';
import { VersionDebugModal } from './VersionDebugModal';
import { ApiKeyModal } from './ApiKeyModal';
import { getStoredApiKey } from '../utils/apiKeyUtils';
import { BaseModal } from './shared/BaseModal';
import { getWallpaper, saveWallpaper, removeWallpaper } from '../services/storageService';
import { useGlobalContext } from '../context/GlobalContext';

interface SidebarProps {
  activeTab: string;
  onSwitchTab: (tabId: string) => void;
  openFiles: DriveFile[];
  onCloseFile: (fileId: string) => void;
  user: User | null;
  onLogout: () => void;
  onLogin?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onToggle?: () => void;
  docked?: boolean;
  driveActive?: boolean;
  onOpenLegal?: () => void;
  isImmersive?: boolean;
  onToggleImmersive?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, onSwitchTab, openFiles, onCloseFile, user, onLogout, onLogin, isOpen, onClose, driveActive = false, onOpenLegal,
  isImmersive, onToggleImmersive
}) => {
  const [isThemesOpen, setIsThemesOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  
  const [wallpapers, setWallpapers] = useState<{ landscape: string | null, portrait: string | null }>({ landscape: null, portrait: null });
  const [cachingStatus, setCachingStatus] = useState<'idle' | 'caching' | 'done'>('idle');
  const [cacheProgress, setCacheProgress] = useState(0);
  const [downloadSize, setDownloadSize] = useState<string | null>(null);
  const [hasUserKey, setHasUserKey] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  
  const [highContrast, setHighContrast] = useState(() => {
      return localStorage.getItem('high-contrast-text') === 'true';
  });

  const loadWallpapers = async () => {
    const lBlob = await getWallpaper('landscape');
    const pBlob = await getWallpaper('portrait');
    setWallpapers({
        landscape: lBlob ? URL.createObjectURL(lBlob) : null,
        portrait: pBlob ? URL.createObjectURL(pBlob) : null
    });
  };

  useEffect(() => {
    getOfflineCacheSize().then(size => { if (size) { setDownloadSize(size); setCachingStatus('done'); }});
    const checkKey = () => setHasUserKey(!!getStoredApiKey());
    checkKey();
    window.addEventListener('apikey-changed', checkKey);
    loadWallpapers();
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => { 
        window.removeEventListener('apikey-changed', checkKey);
        document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    if (highContrast) {
        document.documentElement.classList.add('high-contrast-text');
    } else {
        document.documentElement.classList.remove('high-contrast-text');
    }
    localStorage.setItem('high-contrast-text', highContrast.toString());
  }, [highContrast]);

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>, orientation: 'landscape' | 'portrait') => {
      const file = e.target.files?.[0];
      if (!file) return;
      await saveWallpaper(orientation, file);
      loadWallpapers();
      window.dispatchEvent(new Event('wallpaper-changed'));
  };

  const handleRemoveWallpaper = async (orientation: 'landscape' | 'portrait') => {
      await removeWallpaper(orientation);
      loadWallpapers();
      window.dispatchEvent(new Event('wallpaper-changed'));
  };

  const handleStartDownload = async (selectedCategories: ResourceCategory[]) => {
    setCachingStatus('caching');
    setCacheProgress(0);
    try {
        const size = await cacheAppResources(selectedCategories, (progress) => setCacheProgress(progress));
        setDownloadSize(size);
        setCachingStatus('done');
    } catch (e) {
        setCachingStatus('idle'); 
        alert("Erro ao baixar recursos.");
    }
  };

  const handleClearCache = async () => {
    try {
      await deleteOfflineResources();
      setDownloadSize(null);
      setCachingStatus('idle');
      setCacheProgress(0);
    } catch (e) {
      alert("Erro ao limpar cache.");
    }
  };

  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(console.error);
          localStorage.setItem('fullscreen_pref', 'true');
      } else {
          document.exitFullscreen().catch(console.error);
          localStorage.setItem('fullscreen_pref', 'false');
      }
  };

  const handleNavigation = (tab: string) => { onSwitchTab(tab); onClose(); };

  return (
    <>
      {/* Backdrop Moderno com Blur Progressivo */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-500 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
      
      {/* Sidebar Flutuante */}
      <div className={`
          fixed z-50 flex flex-col overflow-hidden
          /* Mobile: Full height, attached to left */
          inset-y-0 left-0 w-[85vw] max-w-[300px] rounded-r-3xl
          /* Desktop: Floating Panel */
          md:top-4 md:bottom-4 md:left-4 md:w-72 md:rounded-3xl md:inset-y-auto
          
          /* Visual */
          bg-[#09090b]/95 backdrop-blur-2xl border border-white/10
          shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)]
          
          /* Animation: Exponential Ease Out (Snappy & Smooth) */
          transform-gpu transition-all duration-500 cubic-bezier(0.19, 1, 0.22, 1)
          
          ${isOpen ? 'translate-x-0 opacity-100 scale-100' : '-translate-x-[120%] opacity-0 scale-95 pointer-events-none'}
      `}>
        {/* Metal Texture Overlay */}
        <div className="absolute inset-0 z-[-1] opacity-[0.03] pointer-events-none mix-blend-overlay" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
        </div>

        {/* Liquid Highlight (Top Edge) */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"></div>

        <div className="h-24 flex items-center justify-between px-6 shrink-0 relative border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shadow-inner backdrop-blur-sm">
                <LayoutGrid className="text-brand drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" size={22} />
            </div>
            <div className="flex flex-col">
                <span className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Lectorium</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition-colors"><X size={20} /></button>
        </div>

        <nav className="flex-1 py-4 space-y-2 overflow-y-auto custom-scrollbar px-3 relative z-10">
          
          {openFiles.length > 0 && (
            <div className="mb-6 pb-4 border-b border-white/5 mx-2">
              <div className="px-2 mb-2 text-xs font-bold text-brand uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand"></div> Workspaces Ativos
              </div>
              <div className="space-y-1">
                {openFiles.map(file => (
                    <div key={file.id} className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${activeTab === file.id ? 'bg-white/10 text-white shadow-lg shadow-black/20 border border-white/5' : 'text-white/90 hover:bg-white/5 hover:text-white'}`} onClick={() => handleNavigation(file.id)}>
                      {file.name.endsWith('.mindmap') ? <Workflow size={16} className="text-purple-400" /> : <FileText size={16} className={activeTab === file.id ? "text-brand" : "text-white/50"} />}
                      <span className="truncate text-[15px] flex-1 font-medium">{file.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); onCloseFile(file.id); }} className="p-1 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><X size={14} /></button>
                    </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <button onClick={() => handleNavigation('dashboard')} className={`w-full p-3 rounded-xl flex items-center px-4 transition-all duration-200 ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-brand/20 to-brand/5 text-brand font-bold border border-brand/20 shadow-[0_0_15px_-5px_rgba(74,222,128,0.1)]' : 'text-white/90 hover:bg-white/5 hover:text-white'}`}>
              <Home size={20} /><span className="ml-3 text-[17px]">Início</span>
            </button>
            <button onClick={() => handleNavigation('browser')} className={`w-full p-3 rounded-xl flex items-center px-4 transition-all duration-200 ${activeTab === 'browser' ? 'bg-gradient-to-r from-brand/20 to-brand/5 text-brand font-bold border border-brand/20 shadow-[0_0_15px_-5px_rgba(74,222,128,0.1)]' : 'text-white/90 hover:bg-white/5 hover:text-white'}`}>
              <FolderOpen size={20} /><span className="ml-3 text-[17px]">Meu Drive</span>
            </button>
            <button onClick={() => handleNavigation('shared')} className={`w-full p-3 rounded-xl flex items-center px-4 transition-all duration-200 ${activeTab === 'shared' ? 'bg-gradient-to-r from-brand/20 to-brand/5 text-brand font-bold border border-brand/20 shadow-[0_0_15px_-5px_rgba(74,222,128,0.1)]' : 'text-white/90 hover:bg-white/5 hover:text-white'}`}>
              <Users size={20} /><span className="ml-3 text-[17px]">Compartilhados</span>
            </button>
            <button onClick={() => handleNavigation('mindmaps')} className={`w-full p-3 rounded-xl flex items-center px-4 transition-all duration-200 ${activeTab === 'mindmaps' ? 'bg-gradient-to-r from-brand/20 to-brand/5 text-brand font-bold border border-brand/20 shadow-[0_0_15px_-5px_rgba(74,222,128,0.1)]' : 'text-white/90 hover:bg-white/5 hover:text-white'}`}>
              <Workflow size={20} /><span className="ml-3 text-[17px]">Mapas Mentais</span>
            </button>
            <button onClick={() => handleNavigation('operational-archive')} className={`w-full p-3 rounded-xl flex items-center px-4 transition-all duration-200 ${activeTab === 'operational-archive' ? 'bg-gradient-to-r from-brand/20 to-brand/5 text-brand font-bold border border-brand/20 shadow-[0_0_15px_-5px_rgba(74,222,128,0.1)]' : 'text-white/90 hover:bg-white/5 hover:text-white'}`}>
              <Database size={20} /><span className="ml-3 text-[17px]">Sintetizador Lexicográfico</span>
            </button>
          </div>

          <div className="pt-6 mt-2 space-y-1">
            <div className="px-4 pb-2 text-xs font-bold text-white/40 uppercase tracking-widest">Sistema</div>
            
            <button 
              onClick={() => setHighContrast(!highContrast)} 
              className={`w-full p-3 rounded-xl flex items-center px-4 transition-colors ${highContrast ? 'bg-yellow-400 text-black font-bold border border-white' : 'text-white/90 hover:bg-white/5 hover:text-white'}`}
            >
              <Contrast size={20} />
              <span className="ml-3 text-[16px]">Alto Contraste</span>
              {highContrast && <CheckCircle size={16} className="ml-auto" />}
            </button>

            <button onClick={() => setIsThemesOpen(!isThemesOpen)} className="w-full p-3 rounded-xl flex items-center px-4 text-white/90 hover:bg-white/5 hover:text-white transition-colors">
              <Palette size={20} />
              <div className="flex items-center justify-between flex-1 ml-3"><span className="text-[16px]">Temas</span>{isThemesOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</div>
            </button>
            {isThemesOpen && <div className="pl-4 pr-2 py-2 mb-2 bg-black/20 inset-shadow-sm rounded-xl mx-2"><ThemeSwitcher /></div>}

            <button onClick={() => setIsCustomizeOpen(!isCustomizeOpen)} className="w-full p-3 rounded-xl flex items-center px-4 text-white/90 hover:bg-white/5 hover:text-white transition-colors">
              <ImageIcon size={20} />
              <div className="flex items-center justify-between flex-1 ml-3"><span className="text-[16px]">Papel de Parede</span>{isCustomizeOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</div>
            </button>
            {isCustomizeOpen && (
              <div className="pl-12 pr-4 py-4 space-y-4 bg-black/20 inset-shadow-sm rounded-xl mx-2 mb-2">
                 <div className="space-y-2">
                    <label className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Horizontal</label>
                    <div className="flex items-center gap-2">
                       <label className="flex-1 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 text-[10px] flex items-center justify-center gap-2 transition-all text-white">
                          <Upload size={12} /> {wallpapers.landscape ? 'Trocar' : 'Enviar'}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleWallpaperUpload(e, 'landscape')} />
                       </label>
                       {wallpapers.landscape && <button onClick={() => handleRemoveWallpaper('landscape')} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg border border-red-400/20"><Trash2 size={12} /></button>}
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Vertical</label>
                    <div className="flex items-center gap-2">
                       <label className="flex-1 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 text-[10px] flex items-center justify-center gap-2 transition-all text-white">
                          <Upload size={12} /> {wallpapers.portrait ? 'Trocar' : 'Enviar'}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleWallpaperUpload(e, 'portrait')} />
                       </label>
                       {wallpapers.portrait && <button onClick={() => handleRemoveWallpaper('portrait')} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg border border-red-400/20"><Trash2 size={12} /></button>}
                    </div>
                 </div>
              </div>
            )}
          </div>

          <div className="pt-2 px-3">
             <button onClick={() => setShowOfflineModal(true)} className="w-full p-3 rounded-xl flex items-center px-4 text-white/90 hover:bg-white/5 hover:text-white transition-colors group">
                <div className="relative text-white/50 group-hover:text-brand transition-colors">
                  {cachingStatus === 'caching' ? <Loader2 size={20} className="animate-spin text-brand" /> : <DownloadCloud size={20} className={cachingStatus === 'done' ? 'text-brand' : ''} />}
                </div>
                <div className="flex flex-col items-start ml-3">
                  <span className="text-[16px]">Modo Offline</span>
                  {downloadSize && <span className="text-[9px] text-brand font-mono">{downloadSize}</span>}
                </div>
             </button>
             <button onClick={() => setShowKeyModal(true)} className="w-full p-3 rounded-xl flex items-center px-4 text-white/90 hover:bg-white/5 hover:text-white transition-colors">
                <Key size={20} className={hasUserKey ? "text-brand" : "text-white/50"} /><span className="ml-3 text-[16px]">Chave Gemini AI</span>
             </button>
          </div>
        </nav>

        <div className="p-4 border-t border-white/5 mt-auto flex flex-col gap-2 bg-black/20 backdrop-blur-md relative z-10 rounded-br-2xl md:rounded-b-2xl">
          <div className="flex gap-2">
              {onOpenLegal && (
                <button 
                    onClick={onOpenLegal}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 py-2.5 rounded-xl transition-colors border border-transparent hover:border-white/10"
                    title="Legal"
                >
                    <Scale size={14} /> Legal
                </button>
              )}
              <button 
                  onClick={toggleFullscreen}
                  className={`flex-1 flex items-center justify-center gap-2 text-xs font-medium py-2.5 rounded-xl transition-colors border border-transparent ${isFullscreen ? 'text-brand bg-brand/10 border-brand/20' : 'text-white/50 hover:text-white hover:bg-white/5 hover:border-white/10'}`}
                  title="Tela Cheia"
              >
                  {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />} 
                  {isFullscreen ? 'Sair' : 'Expandir'}
              </button>
          </div>

          {user ? (
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                {user.photoURL ? <img src={user.photoURL} alt="U" className="w-9 h-9 rounded-lg border border-white/10 shadow-sm" /> : <div className="w-9 h-9 rounded-lg bg-brand/20 flex items-center justify-center text-brand font-bold text-xs">{user.displayName?.[0]}</div>}
                <div className="flex flex-col min-w-0 flex-1"><span className="text-xs font-bold text-white truncate">{user.displayName}</span><span className="text-[10px] text-white/50 truncate font-mono">{user.email}</span></div>
                <button onClick={onLogout} className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><LogOut size={16} /></button>
            </div>
          ) : <button onClick={onLogin} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-brand transition-colors shadow-lg"><LogIn size={18} /> Entrar com Google</button>}
        </div>
      </div>

      <OfflineDownloadModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} onConfirm={handleStartDownload} onClear={handleClearCache} currentSize={downloadSize} isDownloading={cachingStatus === 'caching'} progress={cacheProgress} />
      <ApiKeyModal isOpen={showKeyModal} onClose={() => setShowKeyModal(false)} />
    </>
  );
};
