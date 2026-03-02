
import React, { useState, useEffect } from 'react';
import { Icon } from '../../src/components/shared/Icon';
import { BaseModal } from './BaseModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (color: string) => void;
  currentColor: string;
  title: string;
}

// Paleta unificada (Caneta + Preto + Branco)
const PRESET_COLORS = [
  '#08fc72', // Forest (Brand - Updated)
  '#4169E1', // Azul
  '#a855f7', // Roxo
  '#FF00FF', // Rosa
  '#E32636', // Vermelho
  '#f97316', // Laranja
  '#eab308', // Amarelo
  '#84cc16', // Lima
  '#94a3b8', // Prata
  '#ffffff', // Branco
  '#000000', // Preto
  '#18181b', // Zinco (Surface)
];

export const ColorPickerModal: React.FC<Props> = ({ isOpen, onClose, onSelect, currentColor, title }) => {
  const [customColor, setCustomColor] = useState(currentColor);

  useEffect(() => {
    if (isOpen) setCustomColor(currentColor);
  }, [isOpen, currentColor]);

  const handleSelect = (color: string) => {
    onSelect(color);
    onClose();
  };

  const handleCustomSubmit = () => {
    if (/^#[0-9A-F]{6}$/i.test(customColor)) {
        onSelect(customColor);
        onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={<Palette size={20} />}
      maxWidth="max-w-sm"
    >
      <div className="space-y-6">
        
        {/* Presets Grid */}
        <div>
            <label className="text-[10px] text-text-sec uppercase font-bold tracking-wider mb-3 block">Cores Táticas</label>
            <div className="grid grid-cols-6 gap-3">
                {PRESET_COLORS.map((color) => (
                    <button
                        key={color}
                        onClick={() => handleSelect(color)}
                        className={`
                            w-10 h-10 rounded-full border-2 transition-all duration-200 flex items-center justify-center relative group
                            ${currentColor === color ? 'border-brand scale-110 shadow-[0_0_10px_var(--brand)]' : 'border-white/10 hover:border-white/50 hover:scale-105'}
                        `}
                        style={{ backgroundColor: color }}
                        title={color}
                    >
                        {currentColor === color && (
                            <Check size={16} className={color === '#ffffff' || color === '#08fc72' || color === '#eab308' || color === '#84cc16' ? 'text-black' : 'text-white'} strokeWidth={3} />
                        )}
                    </button>
                ))}
            </div>
        </div>

        {/* Custom Color Section */}
        <div className="pt-4 border-t border-white/10">
            <label className="text-[10px] text-text-sec uppercase font-bold tracking-wider mb-3 block">Cor Personalizada</label>
            
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <div 
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: customColor }}
                    />
                    <input 
                        type="text"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-white/20 rounded-xl py-3 pl-10 pr-3 text-sm text-white font-mono focus:border-brand focus:outline-none uppercase"
                        placeholder="#000000"
                        maxLength={7}
                    />
                </div>
                
                {/* Native Picker Trigger (Invisible but clickable via icon) */}
                <div className="relative">
                    <button className="w-12 h-full bg-[#2c2c2c] hover:bg-[#3c3c3c] border border-white/10 rounded-xl flex items-center justify-center text-text-sec hover:text-white transition-colors">
                        <Pipette size={18} />
                    </button>
                    <input 
                        type="color" 
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
            </div>

            <button 
                onClick={handleCustomSubmit}
                className="w-full mt-4 bg-brand text-[#0b141a] py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all active:scale-95 shadow-lg"
            >
                Aplicar Cor
            </button>
        </div>

      </div>
    </BaseModal>
  );
};
