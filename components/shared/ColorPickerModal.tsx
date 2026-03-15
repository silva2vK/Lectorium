import React, { useState, useEffect } from 'react';
import { Palette, Check, Pipette, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (color: string) => void;
  currentColor: string;
  title: string;
}

const PRESET_COLORS = [
  { hex: '#08fc72', name: 'Verde' },
  { hex: '#4169E1', name: 'Azul' },
  { hex: '#a855f7', name: 'Roxo' },
  { hex: '#FF00FF', name: 'Rosa' },
  { hex: '#E32636', name: 'Vermelho' },
  { hex: '#f97316', name: 'Laranja' },
  { hex: '#eab308', name: 'Amarelo' },
  { hex: '#84cc16', name: 'Lima' },
  { hex: '#94a3b8', name: 'Prata' },
  { hex: '#ffffff', name: 'Branco' },
  { hex: '#000000', name: 'Preto' },
  { hex: '#18181b', name: 'Superfície' },
];

function isLight(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

export const ColorPickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelect,
  currentColor,
  title,
}) => {
  const [customColor, setCustomColor] = useState(currentColor);
  const [customInput, setCustomInput] = useState(currentColor);

  useEffect(() => {
    if (isOpen) {
      setCustomColor(currentColor);
      setCustomInput(currentColor);
    }
  }, [isOpen, currentColor]);

  const handleSelect = (color: string) => {
    onSelect(color);
    onClose();
  };

  const handleInputChange = (val: string) => {
    setCustomInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setCustomColor(val);
    }
  };

  const handleNativePicker = (val: string) => {
    setCustomColor(val);
    setCustomInput(val);
  };

  const handleApply = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
      onSelect(customColor);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs animate-in zoom-in-95 duration-200"
        style={{
          background: 'linear-gradient(160deg, #0e0e0e 0%, #0a0a0a 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2.5">
            <Palette size={16} style={{ color: 'var(--brand)' }} />
            <span
              className="text-sm font-bold tracking-wider uppercase"
              style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em' }}
            >
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">

          {/* Paleta de presets */}
          <div>
            <p
              className="text-[9px] font-bold uppercase tracking-widest mb-3"
              style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em' }}
            >
              Cores Táticas
            </p>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map(({ hex, name }) => {
                const active = currentColor.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    onClick={() => handleSelect(hex)}
                    title={name}
                    className="relative transition-all duration-150 active:scale-90"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: hex,
                      border: active
                        ? `2px solid var(--brand)`
                        : '2px solid rgba(255,255,255,0.08)',
                      boxShadow: active
                        ? `0 0 0 3px rgba(8,252,114,0.2), 0 4px 12px rgba(0,0,0,0.6)`
                        : '0 2px 8px rgba(0,0,0,0.4)',
                      transform: active ? 'scale(1.08)' : 'scale(1)',
                    }}
                  >
                    {active && (
                      <Check
                        size={14}
                        strokeWidth={3}
                        style={{ color: isLight(hex) ? '#000' : '#fff' }}
                        className="absolute inset-0 m-auto"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cor personalizada */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem' }}>
            <p
              className="text-[9px] font-bold uppercase tracking-widest mb-3"
              style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em' }}
            >
              Personalizado
            </p>

            {/* Preview + input + pipette */}
            <div className="flex gap-2 items-stretch mb-3">
              {/* Preview da cor */}
              <div
                className="flex-shrink-0 rounded-lg"
                style={{
                  width: '42px',
                  background: /^#[0-9A-Fa-f]{6}$/.test(customColor) ? customColor : '#18181b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                }}
              />

              {/* Input hex */}
              <input
                type="text"
                value={customInput}
                onChange={(e) => handleInputChange(e.target.value.trim())}
                maxLength={7}
                placeholder="#000000"
                className="flex-1 font-mono text-sm uppercase outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '0 12px',
                  color: 'rgba(255,255,255,0.85)',
                  caretColor: 'var(--brand)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(8,252,114,0.4)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              />

              {/* Native color picker */}
              <div className="relative flex-shrink-0">
                <button
                  className="h-full px-3 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                >
                  <Pipette size={16} />
                </button>
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(customColor) ? customColor : '#000000'}
                  onChange={(e) => handleNativePicker(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleApply}
              disabled={!/^#[0-9A-Fa-f]{6}$/.test(customColor)}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: 'var(--brand)',
                color: '#0b141a',
                boxShadow: '0 4px 16px rgba(8,252,114,0.25)',
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
