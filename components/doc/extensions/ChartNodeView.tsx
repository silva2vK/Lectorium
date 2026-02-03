
import React, { useState, useEffect, useMemo } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ComposedChart, ReferenceLine, Label
} from 'recharts';
import { 
  Settings2, Activity, X, Table, Plus, Trash2, Sparkles, Layout, Palette, Grid3X3, Layers, Wand2, HelpCircle,
  AlignLeft, ActivitySquare, Eraser, Baseline, FileText
} from 'lucide-react';
import { generateChartData, analyzeChartData } from '../../../services/aiService';

// --- PALETAS TEMÁTICAS VIBRANTES ---
const PALETTES: Record<string, { label: string, colors: string[] }> = {
  default: { label: 'Vibrant', colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'] },
  maker: { label: 'The Maker', colors: ['#2563eb', '#DC143C', '#f8fafc', '#64748b', '#0f172a'] },
  academic: { label: 'Sóbrio', colors: ['#334155', '#94a3b8', '#cbd5e1', '#475569', '#1e293b'] },
  neon: { label: 'Cyberpunk', colors: ['#00f0ff', '#ff00aa', '#bc13fe', '#f9f871', '#00ff9f'] },
  forest: { label: 'Bioluminescente', colors: ['#4ade80', '#2dd4bf', '#a3e635', '#0ea5e9', '#10b981'] },
  warm: { label: 'Solar', colors: ['#ff5722', '#ffc107', '#ff9800', '#f44336', '#e91e63'] }
};

const DEFAULT_DATA = [
  { nome: 'Grupo A', valor: 85, desc: 'Meta Atingida' },
  { nome: 'Grupo B', valor: 62, desc: 'Em Andamento' },
];

// Ícones SVG para os tipos de gráfico
const ChartIcons = {
  bar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-6" />
    </svg>
  ),
  line: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  area: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3V20h11.7V8z" fill="currentColor" fillOpacity="0.2"/>
      <polyline points="7 14.3 10.8 10.5 13.6 13.2 18.7 8" />
    </svg>
  ),
  pie: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  ),
  radar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l7 4v6l-7 10-7-10V6l7-4z" />
      <path d="M12 12l4.9 3.5" /><path d="M12 12l-4.9 3.5" /><path d="M12 12V6.5" />
    </svg>
  ),
  composed: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20v-6" /><path d="M6 20v-4" /><path d="M18 20v-8" />
      <polyline points="2 8 8 4 16 10 22 6" className="text-brand"/>
    </svg>
  )
};

const CHART_TYPES = [
    { id: 'bar', label: 'Colunas', icon: ChartIcons.bar },
    { id: 'line', label: 'Linhas', icon: ChartIcons.line },
    { id: 'area', label: 'Área', icon: ChartIcons.area },
    { id: 'pie', label: 'Pizza', icon: ChartIcons.pie },
    { id: 'radar', label: 'Radar', icon: ChartIcons.radar },
    { id: 'composed', label: 'Misto', icon: ChartIcons.composed },
];

export const ChartNodeView = (props: any) => {
  const { node, updateAttributes } = props;
  const [isEditing, setIsEditing] = useState(false);
  
  // Attributes
  const type = node.attrs.type || 'bar';
  const data = node.attrs.data || DEFAULT_DATA;
  const title = node.attrs.title || 'Gráfico';
  const paletteKey = node.attrs.palette || 'default';
  const customColors = node.attrs.customColors || {}; // Cores manuais
  const showGrid = node.attrs.showGrid !== false;
  const showLegend = node.attrs.showLegend !== false;
  const showAverage = node.attrs.showAverage !== false;
  const isStacked = node.attrs.isStacked || false;
  const insight = node.attrs.insight || '';
  const xAxisLabel = node.attrs.xAxisLabel || '';
  const yAxisLabel = node.attrs.yAxisLabel || '';
  const yAxisRightLabel = node.attrs.yAxisRightLabel || '';

  // -- Editor State --
  const [editTab, setEditTab] = useState<'data' | 'ai' | 'style'>('data');
  const [visualData, setVisualData] = useState<any[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [tempCustomColors, setTempCustomColors] = useState<Record<string, string>>({});

  // Sync state on open
  useEffect(() => {
    if (isEditing) {
        setVisualData(JSON.parse(JSON.stringify(data)));
        setTempTitle(title);
        setTempCustomColors({ ...customColors });
        if (data.length > 0) {
            setSeriesKeys(Object.keys(data[0]).filter(k => k !== 'nome' && k !== 'desc'));
        } else {
            setSeriesKeys(['valor']); // Fallback se vazio
        }
    }
  }, [isEditing, data, title, customColors]);

  // Derived Values
  const paletteColors = PALETTES[paletteKey]?.colors || PALETTES['default'].colors;
  const dataKeys = Object.keys(data[0] || {}).filter(k => k !== 'nome' && k !== 'desc');
  
  // MODO DISTRIBUIÇÃO: Ativado se houver apenas 1 série de dados (ex: "valor")
  const isSingleSeries = dataKeys.length === 1;

  // Resolve color for a series index/key OR item name
  const getSeriesColor = (key: string, index: number) => {
      // Prioridade: Cor customizada da série (usada em multi-série)
      if (customColors[key]) return customColors[key];
      return paletteColors[index % paletteColors.length];
  };
  
  // Resolve color for a specific ITEM (row) based on its name or index
  const getItemColor = (item: any, index: number) => {
      // Prioridade 1: Cor customizada específica para este item (nome)
      if (customColors[item.nome]) return customColors[item.nome];
      // Prioridade 2: Paleta rotativa
      return paletteColors[index % paletteColors.length];
  };

  const averageValue = useMemo(() => {
      if (!data || data.length === 0) return 0;
      let sum = 0;
      let count = 0;
      data.forEach((item: any) => {
          dataKeys.forEach(k => {
              const val = parseFloat(item[k]);
              if (!isNaN(val)) {
                  sum += val;
                  count++;
              }
          });
      });
      return count > 0 ? sum / count : 0;
  }, [data, dataKeys]);

  // Calcula o total geral de TODOS os valores numéricos no dataset
  const grandTotal = useMemo(() => {
      let total = 0;
      data.forEach((item: any) => {
          dataKeys.forEach(k => {
              const val = parseFloat(item[k]);
              if (!isNaN(val)) total += val;
          });
      });
      return total;
  }, [data, dataKeys]);

  const handleSave = () => {
    try {
      updateAttributes({ 
          data: visualData, 
          title: tempTitle,
          customColors: tempCustomColors 
      });
      setIsEditing(false);
    } catch (e) {
      alert("Erro ao salvar dados.");
    }
  };

  // --- HANDLERS ---
  const updateVisualCell = (rowIndex: number, key: string, value: string) => {
      const newData = [...visualData];
      if (key !== 'nome' && key !== 'desc') {
          const normalized = value.replace(',', '.');
          const num = parseFloat(normalized);
          if (value.endsWith('.') || value.endsWith(',')) {
             // @ts-ignore
             newData[rowIndex][key] = value;
          } else {
             newData[rowIndex][key] = isNaN(num) ? 0 : num;
          }
      } else {
          // Se mudou o nome, precisamos atualizar a chave da cor customizada se existir
          const oldName = newData[rowIndex]['nome'];
          if (key === 'nome' && oldName && tempCustomColors[oldName]) {
             const color = tempCustomColors[oldName];
             const newColors = { ...tempCustomColors };
             delete newColors[oldName];
             newColors[value] = color;
             setTempCustomColors(newColors);
          }
          newData[rowIndex][key] = value;
      }
      setVisualData(newData);
  };

  const addRow = () => {
      const newRow: any = { nome: `Item ${visualData.length + 1}`, desc: '' };
      seriesKeys.forEach(k => newRow[k] = 0);
      setVisualData([...visualData, newRow]);
  };
  const removeRow = (index: number) => {
      if (visualData.length <= 1) { alert("O gráfico precisa de pelo menos um item."); return; }
      const item = visualData[index];
      setVisualData(prev => prev.filter((_, i) => i !== index));
      // Remove cor customizada associada ao item
      if (item.nome && tempCustomColors[item.nome]) {
          const newColors = { ...tempCustomColors };
          delete newColors[item.nome];
          setTempCustomColors(newColors);
      }
  };
  const addSeries = () => {
      const name = prompt("Nome da nova série (ex: Meta, Ano Passado):");
      if (name && !seriesKeys.includes(name) && name !== 'nome' && name !== 'desc') {
          setSeriesKeys([...seriesKeys, name]);
          setVisualData(prev => prev.map(row => ({ ...row, [name]: 0 })));
      }
  };
  const removeSeries = (key: string) => {
      if (seriesKeys.length <= 1) { alert("O gráfico precisa de pelo menos uma série de dados."); return; }
      if (confirm(`Excluir a série "${key}"?`)) {
          setSeriesKeys(prev => prev.filter(k => k !== key));
          setVisualData(prev => prev.map(row => { const { [key]: _, ...rest } = row; return rest; }));
          const newColors = { ...tempCustomColors }; delete newColors[key]; setTempCustomColors(newColors);
      }
  };
  const clearTable = () => {
      if (window.confirm("Deseja apagar todos os dados e começar do zero?")) {
          const keys = seriesKeys.length > 0 ? seriesKeys : ['valor'];
          const emptyRow: any = { nome: 'Item A', desc: '' };
          keys.forEach(k => emptyRow[k] = 0);
          setVisualData([emptyRow]);
          setTempCustomColors({});
      }
  };
  
  // Atualiza cor de SÉRIE ou de ITEM dependendo do contexto
  const updateColor = (key: string, color: string) => {
      setTempCustomColors(prev => ({ ...prev, [key]: color }));
  };
  
  // Helper para obter cor atual no editor (com fallback)
  const getEditorColor = (item: any, index: number) => {
      if (tempCustomColors[item.nome]) return tempCustomColors[item.nome];
      return paletteColors[index % paletteColors.length];
  };
  
  const getEditorSeriesColor = (key: string, index: number) => {
      if (tempCustomColors[key]) return tempCustomColors[key];
      return paletteColors[index % paletteColors.length];
  };

  // --- RENDER ---
  const renderDefs = () => (
      <defs>
          {dataKeys.map((key, index) => {
              const color = getSeriesColor(key, index);
              return (
                <linearGradient key={`grad-${key}`} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                    <stop offset="50%" stopColor={color} stopOpacity={0.4}/>
                    <stop offset="100%" stopColor={color} stopOpacity={0.05}/>
                </linearGradient>
              );
          })}
      </defs>
  );

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-[#020617]/95 border border-[#334155] p-2 rounded shadow-xl text-xs font-mono">
          <p className="font-bold text-white mb-1">{label}</p>
          {item.desc && <p className="text-[10px] text-brand mb-1 italic max-w-[150px] whitespace-normal">{item.desc}</p>}
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex gap-2 items-center" style={{ color: p.color || '#fff' }}>
              <span>{p.name}:</span>
              <span className="font-bold">{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    // Aumentamos o bottom margin para acomodar a barra de legenda sem sobrepor o eixo X
    const commonProps = { data, margin: { top: 20, right: 30, left: 10, bottom: 35 } };
    const grid = showGrid ? <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} /> : null;
    const fontStyle = { fontFamily: 'monospace', fontSize: 10 };
    const whiteColor = '#ffffff';
    
    // Se for Single Series OU PIZZA, usamos nossa legenda customizada e ESCONDEMOS a nativa do Recharts
    // A lógica customizada (barra inferior) é muito melhor que a padrão
    const useCustomLegend = isSingleSeries || type === 'pie';
    const legend = !useCustomLegend && showLegend ? <Legend wrapperStyle={{ paddingTop: '15px' }} /> : null;

    const tooltip = <Tooltip content={<CustomTooltip />} />;

    const standardLine = (showAverage && averageValue > 0) ? (
        <ReferenceLine y={averageValue} stroke="#DC143C" strokeDasharray="4 4" strokeWidth={1} isFront={true}>
            <Label value={`MÉD: ${averageValue.toFixed(1)}`} position="right" fill="#DC143C" style={{ fontSize: 10, fontWeight: 'bold' }} />
        </ReferenceLine>
    ) : null;

    if (type === 'pie') {
        return (
            <PieChart>
                {renderDefs()}
                <Pie 
                    data={data} 
                    cx="50%" cy="50%" 
                    innerRadius={60} outerRadius={80} 
                    paddingAngle={5} 
                    dataKey={dataKeys[0]} 
                    nameKey="nome"
                    stroke="none"
                    label={({ nome }) => `${nome}`}
                >
                    {data.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={getItemColor(entry, index)} />
                    ))}
                </Pie>
                {tooltip} {legend}
            </PieChart>
        );
    }

    if (type === 'radar') {
        return (
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
                {renderDefs()}
                <PolarGrid stroke="#334155" /> 
                <PolarAngleAxis dataKey="nome" stroke={whiteColor} tick={{ fill: whiteColor, ...fontStyle }} />
                <PolarRadiusAxis angle={30} stroke="#475569" />
                {dataKeys.map((key, i) => (
                    <Radar 
                        key={key} name={key} dataKey={key} 
                        stroke={getSeriesColor(key, i)} 
                        fill={getSeriesColor(key, i)} 
                        fillOpacity={0.3} 
                    />
                ))}
                {tooltip} {legend}
            </RadarChart>
        );
    }

    // Cartesian
    const axes = (
        <>
            <XAxis dataKey="nome" stroke={whiteColor} tick={{ fill: whiteColor, ...fontStyle }} tickLine={false} axisLine={{ stroke: '#334155' }}>
                {xAxisLabel && <Label value={xAxisLabel} offset={0} position="insideBottom" fill={whiteColor} style={fontStyle} fontSize={12} />}
            </XAxis>
            <YAxis stroke={whiteColor} tick={{ fill: whiteColor, ...fontStyle }} tickLine={false} axisLine={{ stroke: '#334155' }}>
                {yAxisLabel && <Label value={yAxisLabel} angle={-90} position="insideLeft" style={{ textAnchor: 'middle', ...fontStyle }} fill={whiteColor} fontSize={12} />}
            </YAxis>
            {yAxisRightLabel && <YAxis yAxisId="right" orientation="right" stroke={whiteColor} tick={{ fill: whiteColor, ...fontStyle }} tickLine={false} axisLine={false}><Label value={yAxisRightLabel} angle={90} position="insideRight" style={{ textAnchor: 'middle', ...fontStyle }} fill={whiteColor} fontSize={12} /></YAxis>}
            {tooltip} {legend} {grid} {standardLine}
        </>
    );

    if (type === 'composed') {
        return (
            <ComposedChart {...commonProps}>
                {renderDefs()}
                {axes}
                {dataKeys.map((key, i) => {
                    const color = getSeriesColor(key, i);
                    if (i === 0) return <Bar key={key} dataKey={key} fill={`url(#grad-${key})`} stroke={color} stackId={isStacked ? 'a' : undefined} radius={[2, 2, 0, 0]} />;
                    return <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={3} dot={{r:4, fill:'#000', stroke:color, strokeWidth:2}} />;
                })}
            </ComposedChart>
        );
    }

    const ChartComp = type === 'line' ? LineChart : type === 'area' ? AreaChart : BarChart;
    const SeriesComp: any = type === 'line' ? Line : type === 'area' ? Area : Bar;

    return (
        <ChartComp {...commonProps}>
            {renderDefs()}
            {axes}
            {dataKeys.map((key, i) => {
                const color = getSeriesColor(key, i);
                return (
                    <SeriesComp 
                        key={key} 
                        dataKey={key} 
                        stroke={color} 
                        fill={type !== 'line' ? `url(#grad-${key})` : undefined}
                        stackId={isStacked ? 'a' : undefined}
                        radius={type === 'bar' ? [2,2,0,0] : undefined}
                        strokeWidth={type === 'line' ? 3 : undefined}
                        fillOpacity={type === 'area' ? 1 : undefined}
                        type="monotone"
                    >
                         {/* Se for Barra de Série Única, pintamos cada barra individualmente para bater com a legenda customizada */}
                         {type === 'bar' && isSingleSeries && data.map((entry: any, index: number) => (
                             <Cell key={`cell-${index}`} fill={getItemColor(entry, index)} stroke={getItemColor(entry, index)} />
                         ))}
                    </SeriesComp>
                );
            })}
        </ChartComp>
    );
  };

  return (
    <NodeViewWrapper className="react-renderer my-8 select-none w-full flex justify-center">
      <div className="relative group p-6 border border-[#1e3a8a]/40 bg-[#020617] rounded-sm transition-all w-full max-w-4xl shadow-[0_0_40px_-10px_rgba(30,58,138,0.2)] overflow-hidden">
        
        {/* Background Grid */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-20" style={{ backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.15) 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />

        <div className="flex flex-col items-center mb-4 relative z-10">
           <h3 className="text-xl font-bold text-white tracking-tight uppercase font-mono">{title}</h3>
           <div className="w-16 h-0.5 bg-brand/50 mt-1"></div>
        </div>

        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-20">
            <button onClick={() => setIsEditing(true)} className="p-2 bg-brand/10 text-brand border border-brand/50 rounded-sm shadow-lg hover:bg-brand/20" title="Editar Gráfico">
                <Settings2 size={18}/>
            </button>
        </div>

        <div className="w-full h-[350px] text-xs relative z-10">
           <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
           </ResponsiveContainer>

           {/* OVERLAY DE LEGENDA CUSTOMIZADA - BARRA DE RODAPÉ FULL WIDTH */}
           {/* Agora aplicado também para PIZZA */}
           {(isSingleSeries || type === 'pie') && showLegend && (
               <div className="absolute bottom-0 left-0 w-full z-20 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 p-2 pb-3 bg-[#020617]/90 backdrop-blur-md border-t border-white/10 transition-all">
                   {/* Rótulo da Série (Sutil) */}
                   <span className="text-[10px] font-bold text-white uppercase tracking-wider mr-2 border-r border-white/20 pr-3 hidden md:block">
                       {dataKeys[0] || 'Dados'}
                   </span>

                   {/* Itens */}
                   {data.map((item: any, idx: number) => {
                       const valKey = dataKeys[0];
                       const val = parseFloat(item[valKey]) || 0;
                       const percent = grandTotal > 0 ? (val / grandTotal * 100).toFixed(1) : '0';
                       const color = getItemColor(item, idx);
                       
                       return (
                           <div key={idx} className="flex items-center gap-2 text-[11px] whitespace-nowrap">
                               <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_5px_rgba(0,0,0,0.5)]" style={{ backgroundColor: color }} />
                               
                               <span className="text-white font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                                   {item.nome}
                               </span>
                               
                               <div className="flex items-center gap-1 font-mono text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                                  <span className="font-bold">{val}</span>
                                  <span className="opacity-80 text-[10px]">({percent}%)</span>
                               </div>
                           </div>
                       );
                   })}
                   
                   {/* TOTAL - Separador e Valor */}
                   <div className="w-px h-4 bg-white/20 mx-2 hidden sm:block"></div>
                   <div className="flex items-center gap-2 text-[11px] whitespace-nowrap border border-white/10 px-3 py-0.5 rounded-full bg-white/5">
                       <span className="text-[9px] font-bold text-brand uppercase tracking-wider">TOTAL</span>
                       <span className="text-white font-mono font-bold">{grandTotal}</span>
                   </div>
               </div>
           )}
        </div>

        {insight && (
            <div className="mt-4 p-3 bg-brand/5 border-l-2 border-brand text-xs text-blue-200 italic flex gap-2 relative z-10">
                <Sparkles size={14} className="text-brand shrink-0 mt-0.5" />
                {insight}
            </div>
        )}

        {isEditing && (
            <div className="absolute inset-0 bg-[#020617] z-50 p-0 rounded-sm flex flex-col animate-in fade-in zoom-in-95 border border-brand/30 overflow-hidden font-sans">
                {/* Header Tabs */}
                <div className="flex border-b border-white/10 bg-[#0f172a]">
                    <button onClick={() => setEditTab('data')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${editTab === 'data' ? 'text-brand border-b-2 border-brand' : 'text-gray-500'}`}><Table size={14} className="inline mr-1"/> Dados</button>
                    <button onClick={() => setEditTab('style')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${editTab === 'style' ? 'text-brand border-b-2 border-brand' : 'text-gray-500'}`}><Palette size={14} className="inline mr-1"/> Estilo</button>
                    <button onClick={() => setEditTab('ai')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${editTab === 'ai' ? 'text-brand border-b-2 border-brand' : 'text-gray-500'}`}><Sparkles size={14} className="inline mr-1"/> IA</button>
                    <button onClick={() => setIsEditing(false)} className="w-10 flex items-center justify-center text-gray-500 hover:text-white"><X size={16}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {editTab === 'data' && (
                        <div className="space-y-4">
                            {/* Toolbar de Tabela */}
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2 p-2 bg-blue-900/10 border border-blue-500/20 rounded text-xs text-blue-300">
                                    <HelpCircle size={14}/> <span>Use <strong className="text-white">Ctrl+V</strong> para colar do Excel.</span>
                                </div>
                                <button onClick={clearTable} className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded flex items-center gap-2 text-xs transition-colors">
                                    <Eraser size={14} /> Limpar
                                </button>
                            </div>
                            
                            {/* Tabela de Dados */}
                            <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0f172a]">
                                <table className="w-full text-xs text-left table-fixed">
                                    <thead className="bg-[#1e293b] text-gray-300">
                                        <tr>
                                            <th className="p-3 border-b border-r border-[#333] w-1/4">Rótulo</th>
                                            <th className="p-3 border-b border-r border-[#333] w-1/3 flex items-center gap-1 text-text-sec"><FileText size={10}/> Detalhes (Opcional)</th>
                                            {seriesKeys.map((key, i) => (
                                                <th key={key} className="p-2 border-b border-[#333]">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex justify-between items-center">
                                                            <span className="truncate font-bold text-white">{key}</span>
                                                            <button onClick={() => removeSeries(key)} className="text-gray-500 hover:text-red-400"><X size={12}/></button>
                                                        </div>
                                                        {/* Cor da Série (Visível apenas se NÃO for série única) */}
                                                        {!isSingleSeries && (
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <div className="relative w-full h-1 bg-gray-700 rounded overflow-hidden">
                                                                    <div className="absolute inset-0" style={{ backgroundColor: getEditorSeriesColor(key, i) }}></div>
                                                                </div>
                                                                <input 
                                                                    type="color" 
                                                                    className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer opacity-50 hover:opacity-100"
                                                                    value={getEditorSeriesColor(key, i)}
                                                                    onChange={(e) => updateColor(key, e.target.value)}
                                                                    title="Alterar cor da série"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="p-2 border-b border-[#333] w-8 text-center bg-[#1a2333] hover:bg-[#253045] cursor-pointer transition-colors" onClick={addSeries} title="Adicionar Série">
                                                <Plus size={14} className="text-brand mx-auto"/>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#333]">
                                        {visualData.map((row, i) => (
                                            <tr key={i} className="group hover:bg-white/5">
                                                <td className="p-2 border-r border-[#333] flex items-center gap-2">
                                                    {/* Color Picker por Item (Apenas Série Única) */}
                                                    {isSingleSeries && (
                                                        <div className="shrink-0 relative w-4 h-4 rounded overflow-hidden border border-gray-600 group-hover:border-white">
                                                            <div className="absolute inset-0" style={{ backgroundColor: getEditorColor(row, i) }}></div>
                                                            <input 
                                                                type="color" 
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                value={getEditorColor(row, i)}
                                                                onChange={(e) => updateColor(row.nome, e.target.value)}
                                                                title="Cor deste item"
                                                            />
                                                        </div>
                                                    )}
                                                    <input 
                                                        className="bg-transparent w-full outline-none text-white font-medium placeholder-gray-600" 
                                                        value={row['nome']} 
                                                        onChange={e => updateVisualCell(i, 'nome', e.target.value)}
                                                        placeholder="Nome do item"
                                                    />
                                                </td>
                                                {/* NOVA COLUNA DE DESCRIÇÃO/DETALHES */}
                                                <td className="p-2 border-r border-[#333]">
                                                    <input 
                                                        className="bg-transparent w-full outline-none text-gray-400 placeholder-gray-700 italic text-xs" 
                                                        value={row['desc'] || ''} 
                                                        onChange={e => updateVisualCell(i, 'desc', e.target.value)}
                                                        placeholder="Ex: Meta Atingida"
                                                    />
                                                </td>
                                                {seriesKeys.map(k => (
                                                    <td key={k} className="p-2 border-r border-[#333]">
                                                        <input 
                                                            className="bg-transparent w-full outline-none text-brand text-right font-mono focus:bg-white/5 rounded px-1" 
                                                            value={row[k]} 
                                                            onChange={e => updateVisualCell(i, k, e.target.value)}
                                                            type="text"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="p-2 text-center">
                                                    <button onClick={() => removeRow(i)} className="text-gray-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 size={12}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={seriesKeys.length + 3} className="p-2">
                                                <button onClick={addRow} className="w-full py-2 bg-[#1e293b] hover:bg-[#283548] text-gray-400 hover:text-white rounded border border-dashed border-[#444] text-xs flex items-center justify-center gap-2 transition-all">
                                                    <Plus size={12} /> Adicionar Item
                                                </button>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500 font-bold uppercase">Título do Gráfico</label>
                                <input value={tempTitle} onChange={e => setTempTitle(e.target.value)} className="w-full bg-[#1e293b] border border-[#333] rounded-sm p-2 text-sm text-white focus:border-brand outline-none" />
                            </div>
                        </div>
                    )}

                    {editTab === 'style' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 font-bold uppercase">Tipo de Visualização</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {CHART_TYPES.map(t => (
                                        <button 
                                            key={t.id} 
                                            onClick={() => updateAttributes({ type: t.id })} 
                                            className={`p-2 rounded-sm border text-xs flex flex-col items-center gap-1 transition-colors ${type === t.id ? 'bg-brand/10 text-brand border-brand font-bold' : 'bg-[#1e293b] border-[#333] text-gray-400 hover:text-white'}`}
                                        >
                                            <div className={type === t.id ? "text-brand" : "text-gray-400"}>
                                                {t.icon}
                                            </div>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 font-bold uppercase">Paleta Base</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(PALETTES).map(([pk, pData]) => (
                                        <button key={pk} onClick={() => updateAttributes({ palette: pk })} className={`p-2 rounded-sm border text-xs capitalize flex items-center gap-2 ${paletteKey === pk ? 'border-brand bg-brand/10 text-white' : 'border-[#333] text-gray-400'}`}>
                                            <div className="flex gap-0.5">
                                                {pData.colors.slice(0,3).map(c => <div key={c} className="w-2 h-2 rounded-full" style={{backgroundColor: c}}/>)}
                                            </div>
                                            {pData.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1">* As cores personalizadas na aba "Dados" têm prioridade sobre a paleta.</p>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-[#333]">
                                <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-2">
                                    <AlignLeft size={14}/> Rótulos dos Eixos
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-gray-400">Eixo Y (Esq)</span>
                                        <input value={yAxisLabel} onChange={e => updateAttributes({ yAxisLabel: e.target.value })} className="w-full bg-[#1e293b] border border-[#333] rounded-sm p-1.5 text-xs text-white focus:border-brand outline-none" placeholder="Ex: Valores" />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-gray-400">Eixo X</span>
                                        <input value={xAxisLabel} onChange={e => updateAttributes({ xAxisLabel: e.target.value })} className="w-full bg-[#1e293b] border border-[#333] rounded-sm p-1.5 text-xs text-white focus:border-brand outline-none" placeholder="Ex: Meses" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-2 border-t border-[#333] flex-wrap">
                                <label className="flex items-center gap-2 text-sm text-white cursor-pointer"><input type="checkbox" checked={showGrid} onChange={e => updateAttributes({ showGrid: e.target.checked })} className="accent-brand" /> <Grid3X3 size={14}/> Grid</label>
                                <label className="flex items-center gap-2 text-sm text-white cursor-pointer"><input type="checkbox" checked={showLegend} onChange={e => updateAttributes({ showLegend: e.target.checked })} className="accent-brand" /> <Layout size={14}/> Legenda</label>
                                <label className="flex items-center gap-2 text-sm text-white cursor-pointer"><input type="checkbox" checked={showAverage} onChange={e => updateAttributes({ showAverage: e.target.checked })} className="accent-brand" /> <ActivitySquare size={14}/> Média</label>
                                {['bar', 'area', 'composed'].includes(type) && (
                                    <label className="flex items-center gap-2 text-sm text-white cursor-pointer"><input type="checkbox" checked={isStacked} onChange={e => updateAttributes({ isStacked: e.target.checked })} className="accent-brand" /> <Layers size={14}/> Empilhado</label>
                                )}
                            </div>
                        </div>
                    )}

                    {editTab === 'ai' && (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="bg-purple-900/10 border border-purple-500/30 p-4 rounded-sm">
                                <h4 className="text-sm font-bold text-purple-300 mb-2 flex items-center gap-2"><Wand2 size={16}/> Inteligência de Dados</h4>
                                <p className="text-xs text-purple-200/70">Descreva os dados que precisa. A IA gerará a estrutura e os valores.</p>
                            </div>
                            <textarea 
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                                placeholder="Ex: Crie um gráfico de barras comparando a população das 5 maiores capitais do Brasil..."
                                className="flex-1 bg-[#1e293b] border border-[#333] rounded-sm p-4 text-sm text-white focus:border-purple-500 outline-none resize-none"
                            />
                            <button 
                                onClick={async () => {
                                    if (!aiPrompt.trim()) return;
                                    setIsAiLoading(true);
                                    try {
                                        const response = await generateChartData(aiPrompt);
                                        if (response && Array.isArray(response.data) && response.data.length > 0) {
                                            // Normalizar chaves para o padrão 'nome'
                                            const normalizedData = response.data.map((d: any) => {
                                                const { name, ...rest } = d;
                                                return { nome: name || d.nome || 'Item', desc: '', ...rest };
                                            });
                                            
                                            setVisualData(normalizedData);
                                            const keys = Object.keys(normalizedData[0]).filter(k => k !== 'nome' && k !== 'desc');
                                            setSeriesKeys(keys);
                                            
                                            if (response.type && CHART_TYPES.some(t => t.id === response.type)) {
                                                updateAttributes({ type: response.type });
                                            }
                                            setEditTab('data'); 
                                        }
                                    } catch (e: any) {
                                        alert(e.message);
                                    } finally {
                                        setIsAiLoading(false);
                                    }
                                }} 
                                disabled={isAiLoading || !aiPrompt.trim()}
                                className="w-full bg-purple-600 text-white py-3 rounded-sm font-bold hover:brightness-110 disabled:opacity-50 flex justify-center gap-2 items-center shadow-lg"
                            >
                                {isAiLoading ? <Activity className="animate-spin"/> : <Sparkles/>} Gerar com IA
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[#333] bg-[#0f172a]">
                    <button onClick={handleSave} className="w-full bg-brand text-[#0b141a] py-3 rounded-sm font-bold hover:brightness-110 shadow-[0_0_15px_-5px_var(--brand)] transition-shadow">Aplicar Alterações</button>
                </div>
            </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};
