import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Icon, IconName } from '../../shared/Icon';
import { BaseModal } from '../../shared/BaseModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
}

const CELL_COLORS = [
  'transparent',
  '#ffffff', '#f2f2f2', '#d9d9d9', '#000000',
  '#f8d7da', '#f1aeb5', '#842029',
  '#d1e7dd', '#a3cfbb', '#0a3622',
  '#cfe2ff', '#9ec5fe', '#052c65',
  '#fff3cd', '#ffe69c', '#664d03',
];

const BORDER_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff',
  '#c00000', '#ff0000', '#ff9900', '#ffff00',
  '#00b050', '#00b0f0', '#0070c0', '#7030a0',
];

export const TablePropertiesModal: React.FC<Props> = ({ isOpen, onClose, editor }) => {
  const [activeTab, setActiveTab] = useState<'structure' | 'cells' | 'style'>('structure');
  const [borderColor, setBorderColor] = useState('#000000');

  if (!isOpen || !editor) return null;

  const setCellBackground = (color: string) => {
    if (color === 'transparent') {
      editor.chain().focus().setCellAttribute('backgroundColor', null).run();
    } else {
      editor.chain().focus().setCellAttribute('backgroundColor', color).run();
    }
  };

  const setCellBorderColor = (color: string) => {
    setBorderColor(color);
    editor.chain().focus().setCellAttribute('borderColor', color).run();
  };

  const setCellVerticalAlign = (align: 'top' | 'middle' | 'bottom') => {
    editor.chain().focus().setCellAttribute('verticalAlign', align).run();
  };

  const ActionButton = ({
    onClick, iconName, label, danger, active
  }: {
    onClick: () => void;
    iconName: IconName;
    label: string;
    danger?: boolean;
    active?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-colors border ${
        danger
          ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
          : active
          ? 'bg-brand/20 border-brand/40 text-brand'
          : 'bg-[#2c2c2c] border-transparent hover:bg-[#363636] text-gray-200'
      }`}
    >
      <Icon name={iconName} size={18} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  const Tab = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === id
          ? 'border-[#a8c7fa] text-[#a8c7fa]'
          : 'border-transparent text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Propriedades da Tabela"
      icon={<Icon name="Table" size={20} />}
      maxWidth="max-w-md"
    >
      <div className="flex border-b border-[#444746] mb-4">
        <Tab id="structure" label="Estrutura" />
        <Tab id="cells" label="Células" />
        <Tab id="style" label="Estilo" />
      </div>

      <div className="min-h-[280px]">

        {/* ── ESTRUTURA ── */}
        {activeTab === 'structure' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Linhas</span>
                <ActionButton onClick={() => editor.chain().focus().addRowBefore().run()} iconName="ArrowUp" label="Adicionar Acima" />
                <ActionButton onClick={() => editor.chain().focus().addRowAfter().run()} iconName="ArrowDown" label="Adicionar Abaixo" />
                <ActionButton onClick={() => editor.chain().focus().deleteRow().run()} iconName="Trash2" label="Excluir Linha" danger />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Colunas</span>
                <ActionButton onClick={() => editor.chain().focus().addColumnBefore().run()} iconName="ArrowLeft" label="Adicionar à Esq." />
                <ActionButton onClick={() => editor.chain().focus().addColumnAfter().run()} iconName="ArrowRight" label="Adicionar à Dir." />
                <ActionButton onClick={() => editor.chain().focus().deleteColumn().run()} iconName="Trash2" label="Excluir Coluna" danger />
              </div>
            </div>
            <div className="pt-2 border-t border-[#444746]">
              <ActionButton
                onClick={() => { editor.chain().focus().deleteTable().run(); onClose(); }}
                iconName="Trash2"
                label="Excluir Tabela Inteira"
                danger
              />
            </div>
          </div>
        )}

        {/* ── CÉLULAS ── */}
        {activeTab === 'cells' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <ActionButton onClick={() => editor.chain().focus().mergeCells().run()} iconName="Merge" label="Mesclar Células" />
              <ActionButton onClick={() => editor.chain().focus().splitCell().run()} iconName="Split" label="Dividir Célula" />
            </div>

            <div className="h-px bg-[#444746]" />

            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Cabeçalhos</span>
              <div className="grid grid-cols-2 gap-3">
                <ActionButton onClick={() => editor.chain().focus().toggleHeaderRow().run()} iconName="Layout" label="Linha de Cabeçalho" />
                <ActionButton onClick={() => editor.chain().focus().toggleHeaderColumn().run()} iconName="Grid3X3" label="Coluna de Cabeçalho" />
                <ActionButton onClick={() => editor.chain().focus().toggleHeaderCell().run()} iconName="Square" label="Célula de Cabeçalho" />
              </div>
            </div>

            <div className="h-px bg-[#444746]" />

            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Alinhamento Vertical</span>
              <div className="grid grid-cols-3 gap-2">
                <ActionButton onClick={() => setCellVerticalAlign('top')} iconName="AlignStartVertical" label="Topo" />
                <ActionButton onClick={() => setCellVerticalAlign('middle')} iconName="AlignCenterVertical" label="Centro" />
                <ActionButton onClick={() => setCellVerticalAlign('bottom')} iconName="AlignEndVertical" label="Base" />
              </div>
            </div>

            <div className="h-px bg-[#444746]" />

            <ActionButton onClick={() => editor.chain().focus().fixTables().run()} iconName="GripHorizontal" label="Normalizar Colunas" />
          </div>
        )}

        {/* ── ESTILO ── */}
        {activeTab === 'style' && (
          <div className="space-y-5">

            {/* Cor de fundo */}
            <div>
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-3">
                <Icon name="Palette" size={16} className="text-brand" />
                Cor de Fundo da Célula
              </label>
              <div className="grid grid-cols-6 gap-2">
                {CELL_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setCellBackground(color)}
                    title={color}
                    className="aspect-square rounded-lg border border-white/10 hover:scale-110 transition-transform relative"
                    style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
                  >
                    {color === 'transparent' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-px bg-red-400 rotate-45 scale-75" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-[#444746]" />

            {/* Cor da borda */}
            <div>
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-3">
                <Icon name="SquareDashed" size={16} className="text-brand" />
                Cor da Borda da Célula
                <span
                  className="ml-auto w-5 h-5 rounded border border-white/20 flex-shrink-0"
                  style={{ backgroundColor: borderColor }}
                />
              </label>
              <div className="grid grid-cols-7 gap-2">
                {BORDER_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setCellBorderColor(color)}
                    title={color}
                    className={`aspect-square rounded-lg border hover:scale-110 transition-transform ${
                      borderColor === color ? 'border-brand ring-1 ring-brand' : 'border-white/10'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 mt-4 border-t border-[#444746]">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-brand text-[#0b141a] font-bold rounded-full hover:brightness-110 flex items-center gap-2"
        >
          <Icon name="Check" size={16} /> Concluído
        </button>
      </div>
    </BaseModal>
  );
};
