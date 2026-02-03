
import { Node, ReactNodeViewRenderer } from '@tiptap/react';
import { ChartNodeView } from './ChartNodeView';

export const ChartExtension = Node.create({
  name: 'chart',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      type: { default: 'bar' },
      data: { 
        default: [
          { nome: 'Grupo A', valor: 85 },
          { nome: 'Grupo B', valor: 62 },
        ] 
      },
      title: { default: 'Gráfico' },
      palette: { default: 'default' },
      customColors: { default: {} }, // Armazena cores personalizadas por série
      showGrid: { default: true },
      showLegend: { default: true },
      showAverage: { default: true },
      isStacked: { default: false },
      insight: { default: '' },
      xAxisLabel: { default: '' },
      yAxisLabel: { default: '' },
      yAxisRightLabel: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'chart-component' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['chart-component', HTMLAttributes];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeView);
  },

  addCommands() {
    return {
      insertChart: () => ({ chain }: any) => {
        return chain().insertContent({ type: 'chart' }).run();
      },
    } as any;
  },
});
