
import React, { useState, useEffect, useMemo } from 'react';
import { Home, FolderOpen, LogOut, User as UserIcon, X, Palette, ChevronDown, ChevronRight, Workflow, DownloadCloud, CheckCircle, Loader2, LayoutGrid, Cloud, CloudOff, LogIn, Wrench, Key, Scale, Monitor, Smartphone, Upload, Trash2, RefreshCw, FileText, Maximize, Minimize, Zap, Database, Cpu, Image as ImageIcon, Contrast } from 'lucide-react';
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
      {isOpen && <div className="fixed inset-0 bg-black/80 z-40 animate-in fade-in duration-200" onClick={onClose} />}
      <div className={`fixed inset-y-0 left-0 z-50 bg-sidebar border-r-2 border-brand transition-transform duration-300 ease-in-out flex flex-col w-72 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-zinc-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center border border-brand/50 shadow-[0_0_15px_-5px_rgba(0,0,0,0.5)] shadow-brand/20">
                <LayoutGrid className="text-brand" size={22} />
            </div>
            <div className="flex flex-col"><span className="font-bold text-xl text-white">Lectorium</span></div>
          </div>
          <button onClick={onClose} className="p-2 text-white hover:text-white rounded-full hover:bg-white/5"><X size={24} /></button>
        </div>

        <nav className="flex-1 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          
          {openFiles.length > 0 && (
            <div className="px-3 mb-4 border-b border-zinc-500 pb-4">
              <div className="px-2 mb-2 text-sm font-bold text-white uppercase tracking-wider">Abertos</div>
              <div className="space-y-1">
                {openFiles.map(file => (
                    <div key={file.id} className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer ${activeTab === file.id ? 'bg-surface text-brand border border-zinc-500' : 'text-white hover:bg-white/5'}`} onClick={() => handleNavigation(file.id)}>
                      {file.name.endsWith('.mindmap') ? <Workflow size={18} className="text-purple-400" /> : <FileText size={18} className="text-brand" />}
                      <span className="truncate text-base flex-1">{file.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); onCloseFile(file.id); }} className="p-1 text-zinc-500 hover:text-red-500 transition-colors"><X size={16} /></button>
                    </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1 px-3">
            <button onClick={() => handleNavigation('dashboard')} className={`w-full p-3 rounded-xl flex items-center px-4 ${activeTab === 'dashboard' ? 'bg-brand/10 text-brand font-bold' : 'text-white hover:bg-white/5'}`}>
              <Home size={24} /><span className="ml-4 text-base">Início</span>
            </button>
            <button onClick={() => handleNavigation('browser')} className={`w-full p-3 rounded-xl flex items-center px-4 ${activeTab === 'browser' ? 'bg-brand/10 text-brand font-bold' : 'text-white hover:bg-white/5'}`}>
              <FolderOpen size={24} /><span className="ml-4 text-base">Arquivos</span>
            </button>
            <button onClick={() => handleNavigation('mindmaps')} className={`w-full p-3 rounded-xl flex items-center px-4 ${activeTab === 'mindmaps' ? 'bg-brand/10 text-brand font-bold' : 'text-white hover:bg-white/5'}`}>
              <Workflow size={24} /><span className="ml-4 text-base">Mapas Mentais</span>
            </button>
          </div>

          <div className="pt-4 px-3 border-t border-zinc-500">
            <button 
              onClick={() => setHighContrast(!highContrast)} 
              className={`w-full p-3 rounded-xl flex items-center px-4 transition-colors mb-2 ${highContrast ? 'bg-yellow-400 text-black font-bold border-2 border-white' : 'text-white hover:bg-white/5'}`}
              aria-label="Alternar Alto Contraste"
            >
              <Contrast size={24} className={highContrast ? "fill-current" : ""} />
              <span className="ml-4 text-base">Alto Contraste</span>
              {highContrast && <CheckCircle size={18} className="ml-auto" />}
            </button>

            <button onClick={() => setIsThemesOpen(!isThemesOpen)} className="w-full p-3 rounded-xl flex items-center px-4 text-white hover:bg-white/5">
              <Palette size={24} />
              <div className="flex items-center justify-between flex-1 ml-4"><span className="text-base">Temas</span>{isThemesOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</div>
            </button>
            {isThemesOpen && <div className="pl-12 py-2"><ThemeSwitcher /></div>}

            <button onClick={() => setIsCustomizeOpen(!isCustomizeOpen)} className="w-full p-3 rounded-xl flex items-center px-4 text-white hover:bg-white/5">
              <ImageIcon size={24} />
              <div className="flex items-center justify-between flex-1 ml-4"><span className="text-base">Personalizar</span>{isCustomizeOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</div>
            </button>
            {isCustomizeOpen && (
              <div className="pl-12 pr-4 py-4 space-y-4">
                 <div className="space-y-2">
                    <label className="text-[13px] text-white uppercase font-bold tracking-wider">Papel de Parede (PC)</label>
                    <div className="flex items-center gap-2">
                       <label className="flex-1 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 text-[12px] flex items-center justify-center gap-2 transition-all">
                          <Upload size={14} /> {wallpapers.landscape ? 'Alterar' : 'Upload'}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleWallpaperUpload(e, 'landscape')} />
                       </label>
                       {wallpapers.landscape && <button onClick={() => handleRemoveWallpaper('landscape')} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg border border-red-400/20"><Trash2 size={14} /></button>}
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[13px] text-white uppercase font-bold tracking-wider">Papel de Parede (Mobile)</label>
                    <div className="flex items-center gap-2">
                       <label className="flex-1 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 text-[12px] flex items-center justify-center gap-2 transition-all">
                          <Upload size={14} /> {wallpapers.portrait ? 'Alterar' : 'Upload'}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleWallpaperUpload(e, 'portrait')} />
                       </label>
                       {wallpapers.portrait && <button onClick={() => handleRemoveWallpaper('portrait')} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg border border-red-400/20"><Trash2 size={14} /></button>}
                    </div>
                 </div>
              </div>
            )}
          </div>

          <div className="pt-2 px-3 border-t border-zinc-500">
             <button onClick={() => setShowOfflineModal(true)} className="w-full p-3 rounded-xl flex items-center px-4 text-white hover:bg-white/5">
                <div className="relative">
                  {cachingStatus === 'caching' ? <Loader2 size={24} className="animate-spin text-brand" /> : <DownloadCloud size={24} className={cachingStatus === 'done' ? 'text-brand' : ''} />}
                </div>
                <div className="flex flex-col items-start ml-4">
                  <span className="text-base">Modo Offline</span>
                  {downloadSize && <span className="text-[12px] text-brand font-bold">{downloadSize}</span>}
                </div>
             </button>
             <button onClick={() => setShowKeyModal(true)} className="w-full p-3 rounded-xl flex items-center px-4 text-white hover:bg-white/5">
                <Key size={24} className={hasUserKey ? "text-brand" : ""} /><span className="ml-4 text-base">Chave Gemini AI</span>
             </button>
          </div>
        </nav>

        <div className="p-4 border-t border-zinc-500 mt-auto flex flex-col gap-2">
          <div className="flex gap-2">
              {onOpenLegal && (
                <button 
                    onClick={onOpenLegal}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-white hover:text-white hover:bg-white/5 py-2 rounded-xl transition-colors active:scale-95 border border-transparent hover:border-white/5"
                    title="Informações Legais"
                >
                    <Scale size={16} /> Informações Legais
                </button>
              )}
              <button 
                  onClick={toggleFullscreen}
                  className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-xl transition-colors active:scale-95 border border-transparent ${isFullscreen ? 'text-brand bg-brand/10 border-brand/20' : 'text-white hover:text-white hover:bg-white/5 hover:border-white/5'}`}
                  title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
              >
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />} 
                  {isFullscreen ? 'Sair' : 'Expandir'}
              </button>
          </div>

          {user ? (
            <div className="flex items-center gap-3 p-2 bg-surface/50 rounded-xl border border-zinc-500">
                {user.photoURL ? <img src={user.photoURL} alt="U" className="w-10 h-10 rounded-full border border-zinc-500" /> : <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-sm">{user.displayName?.[0]}</div>}
                <div className="flex flex-col min-w-0 flex-1"><span className="text-sm font-bold text-white truncate">{user.displayName}</span><span className="text-[12px] text-white truncate">{user.email}</span></div>
                <button onClick={onLogout} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"><LogOut size={18} /></button>
            </div>
          ) : <button onClick={onLogin} className="w-full flex items-center gap-3 px-4 py-2 rounded-xl bg-brand text-bg font-bold text-base"><LogIn size={20} /> Entrar</button>}
        </div>
      </div>

      <OfflineDownloadModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} onConfirm={handleStartDownload} onClear={handleClearCache} currentSize={downloadSize} isDownloading={cachingStatus === 'caching'} progress={cacheProgress} />
      <ApiKeyModal isOpen={showKeyModal} onClose={() => setShowKeyModal(false)} />
    </>
  );
};
