
import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { 
  Type, ArrowUpFromLine, Baseline, Highlighter, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Check, ChevronUp, ChevronDown,
  X, Indent as IndentIcon, Minus
} from 'lucide-react';

interface Props {
  editor: Editor | null;
  currentPage: number;
  totalPages: number;
  onJumpToPage: (page: number) => void;
  onAddFootnote: () => void;
  onInsertImage: () => void;
}

const FONTS = [
  { name: 'Times New Roman', value: 'Times New Roman' },
  { name: 'Arial', value: 'Arial' },
  { name: 'Inter', value: 'Inter' },
  { name: 'Roboto', value: 'Roboto' },
  { name: 'Fira Code', value: '"Fira Code"' },
];

const SIZES = ['10','11','12','14','16','18','24','36'];

export const MobileDocToolbar: React.FC<Props> = ({ 
  editor, currentPage, totalPages, onJumpToPage, onAddFootnote
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  if (!editor) return null;

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const closeMenu = () => setActiveMenu(null);

  // --- ACTIONS ---
  const setFont = (font: string) => {
    editor.chain().focus().setFontFamily(font).run();
    closeMenu();
  };

  const setFontSize = (size: string) => {
    (editor.chain().focus() as any).setFontSize(size).run();
    closeMenu();
  };

  const setLineHeight = (height: string) => {
    (editor.chain().focus() as any).setLineHeight(height).run();
    closeMenu();
  };

  const setAlign = (align: string) => {
    editor.chain().focus().setTextAlign(align).run();
    closeMenu();
  };

  // --- COMPONENTS ---
  
  const ToolbarBtn = ({ onClick, isActive, icon: Icon, hasIndicator, color }: any) => (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={`
        w-10 h-10 flex items-center justify-center rounded-xl transition-all my-1 relative shrink-0
        ${isActive 
          ? 'bg-brand text-black shadow-[0_0_15px_rgba(74,222,128,0.3)]' 
          : 'text-[#8b949e] hover:text-white hover:bg-[#21262d]'}
      `}
    >
      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} style={{ color: !isActive ? color : undefined }} />
      {hasIndicator && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-brand rounded-full border border-black" />}
    </button>
  );

  const SideMenu = ({ title, children }: any) => (
    <div 
        className="fixed right-[56px] top-1/2 -translate-y-1/2 w-56 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl z-[100] flex flex-col overflow-hidden animate-in slide-in-from-right-4 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '80vh' }}
    >
        <div className="flex items-center justify-between px-3 py-3 border-b border-[#333] bg-[#252525]">
            <span className="text-[10px] uppercase font-bold text-gray-400">{title}</span>
            <button onClick={closeMenu} className="p-1 hover:bg-white/10 rounded"><X size={14} className="text-gray-500 hover:text-white"/></button>
        </div>
        <div className="overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
            {children}
        </div>
    </div>
  );

  const MenuItem = ({ label, onClick, active, icon: Icon, value }: any) => (
      <button 
        onClick={(e) => { e.stopPropagation(); onClick(); }} 
        className={`w-full text-left px-3 py-3 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${active ? 'bg-brand/10 text-brand' : 'text-gray-300 hover:bg-[#2c2c2c] hover:text-white'}`}
      >
          <div className="flex items-center gap-3">
              {Icon && <Icon size={16} />}
              <span>{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {value && <span className="text-[10px] text-gray-500 font-mono">{value}</span>}
            {active && <Check size={14} />}
          </div>
      </button>
  );

  const currentFont = editor.getAttributes('textStyle').fontFamily || 'Times New Roman';
  const currentSize = editor.getAttributes('textStyle').fontSize || '12';
  const currentLineHeight = editor.getAttributes('paragraph').lineHeight || '1.5';

  return (
    <>
        {/* Backdrop (z-49) - Fica abaixo dos Menus (z-100) mas acima da UI base */}
        {activeMenu && <div className="fixed inset-0 z-[49] bg-black/50 backdrop-blur-[1px]" onClick={closeMenu} />}

        {/* MENUS FLUTUANTES (Renderizados na Raiz para evitar problemas de Z-Index/Stacking) */}
        
        {/* MENU FONTE */}
        {activeMenu === 'font' && (
            <SideMenu title="Fonte">
                {FONTS.map(f => (
                    <MenuItem 
                        key={f.name} 
                        label={f.name} 
                        onClick={() => setFont(f.value)} 
                        active={currentFont.replace(/['"]/g, '') === f.value} 
                    />
                ))}
                <div className="h-px bg-[#333] my-1" />
                <div className="px-2 py-1 text-[9px] text-gray-500 uppercase font-bold">Tamanho</div>
                <div className="grid grid-cols-4 gap-1 p-1">
                    {SIZES.map(s => (
                        <button 
                            key={s} 
                            onClick={() => setFontSize(s)}
                            className={`text-xs py-2 rounded ${currentSize === s ? 'bg-brand text-black font-bold' : 'bg-[#2c2c2c] text-gray-400'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </SideMenu>
        )}

        {/* MENU ALINHAMENTO */}
        {activeMenu === 'align' && (
            <SideMenu title="Alinhamento">
                <MenuItem icon={AlignLeft} label="Esquerda" onClick={() => setAlign('left')} active={editor.isActive({ textAlign: 'left' })} />
                <MenuItem icon={AlignCenter} label="Centro" onClick={() => setAlign('center')} active={editor.isActive({ textAlign: 'center' })} />
                <MenuItem icon={AlignRight} label="Direita" onClick={() => setAlign('right')} active={editor.isActive({ textAlign: 'right' })} />
                <MenuItem icon={AlignJustify} label="Justificado" onClick={() => setAlign('justify')} active={editor.isActive({ textAlign: 'justify' })} />
            </SideMenu>
        )}

        {/* MENU ESPAÇAMENTO */}
        {activeMenu === 'spacing' && (
            <SideMenu title="Espaçamento">
                <div className="px-2 py-2 text-[9px] text-gray-500 uppercase font-bold border-b border-[#333] mb-1">Entrelinhas</div>
                {['1.0', '1.15', '1.5', '2.0'].map(val => (
                    <MenuItem key={val} label={val} onClick={() => setLineHeight(val)} active={currentLineHeight === val} />
                ))}
                
                <div className="px-2 py-2 text-[9px] text-gray-500 uppercase font-bold border-b border-[#333] mb-1 mt-2">Recuo</div>
                <MenuItem 
                    icon={IndentIcon}
                    label="Recuo ABNT (1.25)" 
                    onClick={() => {
                        if (editor.isActive('paragraph')) {
                            editor.chain().focus().updateAttributes('paragraph', { textIndent: '1.25cm' }).run();
                        }
                        closeMenu();
                    }} 
                    active={editor.getAttributes('paragraph').textIndent === '1.25cm'} 
                />
                <MenuItem 
                    icon={Minus}
                    label="Remover Recuo" 
                    onClick={() => {
                        if (editor.isActive('paragraph')) {
                            editor.chain().focus().updateAttributes('paragraph', { textIndent: '0px' }).run();
                        }
                        closeMenu();
                    }} 
                />
            </SideMenu>
        )}

        {/* BARRA LATERAL FIXA (Controles) */}
        <div 
            className="fixed right-0 top-0 bottom-0 w-[56px] bg-black border-l border-[#222] flex flex-col items-center py-2 z-[50] overflow-y-auto no-scrollbar pb-safe"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            {/* NAVEGAÇÃO */}
            <div className="flex flex-col items-center gap-1 mb-2 border-b border-[#333] w-full pb-2 shrink-0">
                <button
                    onClick={() => onJumpToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="w-10 h-8 flex items-center justify-center hover:bg-[#21262d] rounded-lg transition-colors disabled:opacity-30 active:scale-95 group"
                >
                    <ChevronUp size={28} className="text-[#ff4444]" strokeWidth={2.5} />
                </button>
                
                <div className="flex flex-col items-center justify-center w-10 py-1 bg-[#161b22] rounded border border-[#30363d]">
                    <span className="text-sm font-mono font-bold text-white leading-none mb-0.5">{currentPage}</span>
                    <div className="w-6 h-px bg-[#30363d] my-0.5"></div>
                    <span className="text-xs font-mono text-[#8b949e] leading-none">{totalPages}</span>
                </div>

                <button
                    onClick={() => onJumpToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="w-10 h-8 flex items-center justify-center hover:bg-[#21262d] rounded-lg transition-colors disabled:opacity-30 active:scale-95 group"
                >
                    <ChevronDown size={28} className="text-[#00ffff]" strokeWidth={2.5} />
                </button>
            </div>

            {/* BOTÕES DE FERRAMENTAS */}
            <div className="flex flex-col gap-1 mb-2">
                <ToolbarBtn onClick={() => toggleMenu('font')} isActive={activeMenu === 'font'} icon={Type} />
            </div>

            <div className="w-6 h-px bg-[#333] my-1 shrink-0" />

            <div className="flex flex-col gap-1 mb-2">
                <ToolbarBtn onClick={() => toggleMenu('align')} isActive={activeMenu === 'align'} icon={AlignLeft} hasIndicator={true} />
                <ToolbarBtn onClick={() => toggleMenu('spacing')} isActive={activeMenu === 'spacing'} icon={ArrowUpFromLine} />
            </div>

            <div className="w-6 h-px bg-[#333] my-1 shrink-0" />

            {/* CORES */}
            <div className="relative w-10 h-10 flex items-center justify-center my-1">
                <input 
                    type="color" 
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    onInput={(e) => { editor.chain().focus().setColor((e.target as HTMLInputElement).value).run(); closeMenu(); }}
                    value={editor.getAttributes('textStyle').color || '#000000'}
                />
                <Baseline size={20} className="text-[#8b949e]" style={{ color: editor.getAttributes('textStyle').color }} />
            </div>
            <div className="relative w-10 h-10 flex items-center justify-center my-1">
                <input 
                    type="color" 
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    onInput={(e) => { editor.chain().focus().toggleHighlight({ color: (e.target as HTMLInputElement).value }).run(); closeMenu(); }}
                />
                <Highlighter size={20} className={`text-[#8b949e] ${editor.isActive('highlight') ? 'text-brand' : ''}`} />
            </div>
        </div>
    </>
  );
};
