
import React, { useEffect, useState } from 'react';
import { Icon } from '../src/components/shared/Icon';

const themes = [
  { id: 'forest', name: 'Verde (Padrão)', cn: '森', color: '#4ade80' },
  { id: 'maker', name: 'The Maker', cn: '造', color: '#2563eb' }, // Novo Tema
  { id: 'azul', name: 'Azul', cn: '蓝', color: '#4169E1' },
  { id: 'roxo', name: 'Roxo', cn: '紫', color: '#a855f7' },
  { id: 'rosa', name: 'Rosa', cn: '粉', color: '#FF00FF' },
  { id: 'vermelho', name: 'Vermelho', cn: '红', color: '#E32636' },
  { id: 'laranja', name: 'Laranja', cn: '橙', color: '#f97316' },
  { id: 'amarelo', name: 'Amarelo', cn: '黄', color: '#eab308' },
  { id: 'lima', name: 'Lima', cn: '青', color: '#84cc16' },
  { id: 'prata', name: 'Prata', cn: '银', color: '#94a3b8' },
  { id: 'custom', name: 'Personalizado', cn: '创', color: null },
];

interface Props {
  className?: string;
  onThemeSelect?: () => void;
}

export const ThemeSwitcher: React.FC<Props> = ({ className = '', onThemeSelect }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('app-theme') || 'forest';
    }
    return 'forest';
  });

  const [customColor, setCustomColor] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('custom-theme-brand') || '#ffffff';
    }
    return '#ffffff';
  });

  const applyTheme = (themeId: string, color?: string) => {
    const root = document.documentElement;
    
    // Remove todas as classes de temas conhecidos e legados
    const allThemeIds = themes.map(t => t.id);
    const legacyThemes = ['nordic', 'gruvbox', 'dracula', 'high-contrast', 'muryokusho', 'synthwave', 'parchment', 'ciano', 'vinho', 'dourado', 'magenta'];
    
    [...allThemeIds, ...legacyThemes].forEach(t => root.classList.remove(t));
    
    // Limpa o God Mode visual se estiver mudando para um tema comum
    if (themeId !== 'god_mode') {
        root.style.removeProperty('--brand');
        root.style.removeProperty('--brand-to');
        root.style.removeProperty('--bg-main');
        root.style.removeProperty('--bg-surface');
        root.style.removeProperty('--bg-sidebar');
        root.style.removeProperty('--text-main');
        root.style.removeProperty('--text-sec');
        root.style.removeProperty('--border-color');
    }

    if (themeId === 'custom') {
      root.classList.add('custom');
      const brandColor = color || customColor;
      root.style.setProperty('--custom-brand', brandColor);
      if (color) {
        setCustomColor(color);
        localStorage.setItem('custom-theme-brand', color);
      }
    } else {
      root.style.removeProperty('--custom-brand');
      if (themeId !== 'forest') {
        root.classList.add(themeId);
      }
    }
    
    setCurrentTheme(themeId);
    localStorage.setItem('app-theme', themeId);
    
    if (onThemeSelect) onThemeSelect();
  };

  useEffect(() => {
    // Garantia de aplicação na montagem do componente
    applyTheme(currentTheme);
  }, []);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {themes.map(t => (
        <div key={t.id} className="flex flex-col">
          <button 
            onClick={() => applyTheme(t.id)}
            className={`
              text-left px-3 py-2.5 rounded-xl text-base flex items-center justify-between transition-all active:scale-95 border
              ${currentTheme === t.id 
                ? 'bg-white/10 border-white/35 shadow-lg' 
                : 'bg-black/20 border-transparent hover:bg-white/5 hover:border-white/10'}
            `}
          >
            <div className="flex items-center gap-4">
              {/* Ideograma Chinês com a cor do próprio tema */}
              <span 
                className="font-bold text-xl w-8 h-8 flex items-center justify-center rounded-lg bg-black/40"
                style={{ 
                    color: t.id === 'custom' ? customColor : (t.color || 'var(--brand)'),
                    textShadow: `0 0 10px ${t.id === 'custom' ? customColor : (t.color || '#ffffff')}40`
                }}
              >
                {t.cn}
              </span>
              
              <span className={`font-bold ${currentTheme === t.id ? 'text-white' : 'text-white/90'}`}>
                {t.name}
              </span>
            </div>

            {currentTheme === t.id && (
                <div className="bg-brand text-bg p-1 rounded-full">
                    <Check size={14} strokeWidth={3}/>
                </div>
            )}
          </button>
          
          {t.id === 'custom' && currentTheme === 'custom' && (
            <div className="mx-3 mt-2 mb-3 p-4 bg-black/60 border border-white/20 rounded-2xl animate-in slide-in-from-top-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-white uppercase font-black tracking-widest">Cor de Destaque</span>
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <input 
                    type="color" 
                    value={customColor}
                    onChange={(e) => applyTheme('custom', e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                  />
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                    style={{ backgroundColor: customColor }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
