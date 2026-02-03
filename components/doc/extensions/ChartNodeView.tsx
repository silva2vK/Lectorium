
import React, { useState, useEffect, useMemo } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ComposedChart, ReferenceLine
} from 'recharts';
import { 
  Settings2, Activity, X, Table, Plus, Trash2, Sparkles, Layout, Palette, Grid3X3, Layers, Wand2, HelpCircle,
  AlignLeft, ActivitySquare
} from 'lucide-react';
import { generateChartData, analyzeChartData } from '../../../services/aiService';

// --- PALETAS TEMÁTICAS VIBRANTES ---
const PALETTES: Record<string, { label: string, colors: string[] }> = {
  default: { label: 'Vibrant', colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'] }, // Indigo, Emerald, Amber, Pink, Violet
  maker: { label: 'The Maker', colors: ['#2563eb', '#DC143C', '#f8fafc', '#64748b', '#0f172a'] }, // Tech Blue, Crimson, White, Slate
  academic: { label: 'Sóbrio', colors: ['#334155', '#94a3b8', '#cbd5e1', '#475569', '#1e293b'] }, // Slates Monochrome
  neon: { label: 'Cyberpunk', colors: ['#00f0ff', '#ff00aa', '#bc13fe', '#f9f871', '#00ff9f'] }, // High Saturation Neon
  forest: { label: 'Bioluminescente', colors: ['#4ade80', '#2dd4bf', '#a3e635', '#0ea5e9', '#10b981'] }, // Greens & Teals
  warm: { label: 'Solar', colors: ['#ff5722', '#ffc107', '#ff9800', '#f44336', '#e91e63'] } // Warm Spectrum
};

// Dados padrão com 5 pontos para formar Pentágono no Radar
const DEFAULT_DATA = [
  { name: 'A', valor: 400, meta: 240 },
  { name: 'B', valor: 300, meta: 139 },
  { name: 'C', valor: 200, meta: 980 },
  { name: 'D', valor: 278, meta: 390 },
  { name: 'E', valor: 189, meta: 480 },
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

  // Sync state on open
  useEffect(() => {
    if (isEditing) {
        setVisualData(JSON.parse(JSON.stringify(data)));
        setTempTitle(title);
        if (data.length > 0) {
            setSeriesKeys(Object.keys(data[0]).filter(k => k !== 'name'));
        }
    }
  }, [isEditing, data, title]);

  // Derived Values
  const colors = PALETTES[paletteKey]?.colors || PALETTES['default'].colors;
  const dataKeys = Object.keys(data[0] || {}).filter(k => k !== 'name');

  // Protocol "The Standard": Calculate Average
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

  const handleSave = () => {
    try {
      updateAttributes({ data: visualData, title: tempTitle });
      setIsEditing(false);
    } catch (e) {
      alert("Erro ao salvar dados.");
    }
  };

  // --- AI HANDLERS ---
  const handleGenerateData = async () => {
      if (!aiPrompt.trim()) return;
      setIsAiLoading(true);
      try {
          const response = await generateChartData(aiPrompt);
          
          if (response && Array.isArray(response.data) && response.data.length > 0) {
              setVisualData(response.data);
              setSeriesKeys(Object.keys(response.data[0]).filter(k => k !== 'name'));
              
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
  };

  const handleGenerateInsight = async () => {
      setIsAiLoading(true);
      try {
          const text = await analyzeChartData(visualData);
          updateAttributes({ insight: text });
      } catch (e) {
          console.warn(e);
      } finally {
          setIsAiLoading(false);
      }
  };

  // --- DATA GRID HANDLERS ---
  const updateVisualCell = (rowIndex: number, key: string, value: string) => {
      const newData = [...visualData];
      if (key !== 'name') {
          const num = parseFloat(value);
          newData[rowIndex][key] = isNaN(num) ? 0 : num;
      } else {
          newData[rowIndex][key] = value;
      }
      setVisualData(newData);
  };

  const addSeries = () => {
      const name = prompt("Nome da série:");
      if (name && !seriesKeys.includes(name)) {
          setSeriesKeys([...seriesKeys, name]);
          setVisualData(prev => prev.map(row => ({ ...row, [name]: 0 })));
      }
  };

  const removeSeries = (key: string) => {
      if (seriesKeys.length > 1) {
          setSeriesKeys(prev => prev.filter(k => k !== key));
          setVisualData(prev => prev.map(row => {
              const { [key]: _, ...rest } = row;
              return rest;
          }));
      }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text');
      const rows = text.trim().split(/\r?\n/);
      
      if (rows.length < 2) return;

      try {
          const headers = rows[0].split('\t');
          const keys = headers.slice(1);
          
          const newData = rows.slice(1).map(rowStr => {
              const cols = rowStr.split('\t');
              const obj: any = { name: cols[0] };
              keys.forEach((k, i) => {
                  obj[k] = parseFloat(cols[i+1] || '0');
              });
              return obj;
          });

          setSeriesKeys(keys);
          setVisualData(newData);
          alert("Dados importados da área de transferência!");
      } catch (err) {
          alert("Formato inválido. Copie uma tabela do Excel/Sheets.");
      }
  };

  // --- RENDER ---
  const renderDefs = () => (
      <defs>
          {colors.map((color, index) => (
              <linearGradient key={`grad-${index}`} id={`color-${index}`} x1="0" y1="0" x2="0" y2="1">
                  {/* Neon Top */}
                  <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                  {/* Pastel Body */}
                  <stop offset="50%" stopColor={color} stopOpacity={0.4}/>
                  {/* Transparent Bottom */}
                  <stop offset="100%" stopColor={color} stopOpacity={0.05}/>
              </linearGradient>
          ))}
      </defs>
  );

  const renderChart = () => {
    const commonProps = { data, margin: { top: 20, right: 30, left: 10, bottom: 20 } };
    const grid = showGrid ? <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} /> : null;
    
    // Customização Visual: Fontes Monospace e Branco Puro
    const fontStyle = { fontFamily: 'monospace', fontSize: 10 };
    const whiteColor = '#ffffff';
    
    const legend = showLegend ? <Legend wrapperStyle={{ ...fontStyle, color: whiteColor, paddingTop: '10px' }} /> : null;
    const tooltip = <Tooltip contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.9)', borderColor: '#1e3a8a', color: whiteColor, ...fontStyle }} itemStyle={{ color: whiteColor }} />;

    // Protocol "The Standard" Line - No Label
    const standardLine = (showAverage && averageValue > 0) ? (
        <ReferenceLine 
            y={averageValue} 
            stroke="#DC143C" 
            strokeDasharray="4 4" 
            strokeWidth={1}
            isFront={true}
        />
    ) : null;

    if (type === 'pie') {
        return (
            <PieChart>
                {renderDefs()}
                <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey={dataKeys[0]} stroke="none">
                    {data.map((_, index) => (
                        <Cell 
                            key={`cell-${index}`} 
                            fill={colors[index % colors.length]} 
                            style={{ filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.5))' }}
                        />
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
                <PolarAngleAxis dataKey="name" stroke={whiteColor} tick={{ fill: whiteColor, ...fontStyle }} />
                <PolarRadiusAxis angle={30} stroke="#475569" />
                {dataKeys.map((key, i) => (
                    <Radar key={key} name={key} dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.4} />
                ))}
                {tooltip} {legend}
            </RadarChart>
        );
    }

    // Cartesian Charts
    const axes = (
        <>
            <XAxis dataKey="name" stroke={whiteColor} tick={{ fill: whiteColor, ...fontStyle }} tickLine={false} axisLine={{ stroke: '#334155' }}>
                {xAxisLabel && (
                    // @ts-ignore
                    <Label value={xAxisLabel} offset={0} position="insideBottom" fill={whiteColor} style={fontStyle} fontSize={12} />
                )}
            </XAxis>
            <YAxis stroke={whiteColor} tick={{ fill: whiteColor, ...fontStyle }} tickLine={false} axisLine={{ stroke: '#334155' }}>
                {yAxisLabel && (
                    // @ts-ignore
                    <Label value={yAxisLabel} angle={-90} position="insideLeft" style={{ textAnchor: 'middle', ...fontStyle }} fill={whiteColor} fontSize={12} />
                )}
            </YAxis>
            {yAxisRightLabel && (
                <YAxis yAxisId="right" orientation="right" stroke={whiteColor} tick={{ fill: whiteColor, ...fontStyle }} tickLine={false} axisLine={false}>
                    {/* @ts-ignore */}
                    <Label value={yAxisRightLabel} angle={90} position="insideRight" style={{ textAnchor: 'middle', ...fontStyle }} fill={whiteColor} fontSize={12} />
                </YAxis>
            )}
            {tooltip} {legend} {grid} {standardLine}
        </>
    );

    if (type === 'composed') {
        return (
            <ComposedChart {...commonProps}>
                {renderDefs()}
                {axes}
                {dataKeys.map((key, i) => {
                    if (i === 0) return <Bar key={key} dataKey={key} fill={`url(#color-${i % colors.length})`} stackId={isStacked ? 'a' : undefined} radius={[2, 2, 0, 0]} />;
                    return <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={3} dot={{r:4, fill:'#000', stroke:colors[i%colors.length], strokeWidth:2}} />;
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
            {dataKeys.map((key, i) => (
                <SeriesComp 
                    key={key} 
                    dataKey={key} 
                    stroke={colors[i % colors.length]} 
                    fill={`url(#color-${i % colors.length})`}
                    stackId={isStacked ? 'a' : undefined}
                    radius={type === 'bar' ? [2,2,0,0] : undefined}
                    strokeWidth={type === 'line' ? 3 : undefined}
                    fillOpacity={type === 'area' ? 1 : undefined}
                    type="monotone"
                    dot={type === 'line' ? {r:4, fill:'#000', stroke:colors[i%colors.length], strokeWidth:2} : undefined}
                />
            ))}
        </ChartComp>
    );
  };

  return (
    <NodeViewWrapper className="react-renderer my-8 select-none w-full flex justify-center">
      {/* Containment Field: Technical Container */}
      <div className="relative group p-6 border border-[#1e3a8a]/40 bg-[#020617] rounded-sm transition-all w-full max-w-4xl shadow-[0_0_40px_-10px_rgba(30,58,138,0.2)] overflow-hidden">
        
        {/* Containment Grid Background */}
        <div 
            className="absolute inset-0 pointer-events-none z-0 opacity-20"
            style={{
                backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.15) 1px, transparent 1px)`,
                backgroundSize: '20px 20px'
            }}
        />

        {/* Containment Markers (Corners) */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-brand z-10"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-brand z-10"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-brand z-10"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-brand z-10"></div>
        
        <div className="flex flex-col items-center mb-4 relative z-10">
           <h3 className="text-xl font-bold text-white tracking-tight uppercase font-mono">{title}</h3>
           <div className="w-16 h-0.5 bg-brand/50 mt-1"></div>
        </div>

        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-20">
            <button onClick={handleGenerateInsight} className="p-2 bg-purple-500/10 text-purple-400 border border-purple-500/50 rounded-sm shadow-lg hover:bg-purple-500/20" title="Gerar Insight IA">
                {isAiLoading ? <Activity className="animate-spin" size={18}/> : <Sparkles size={18}/>}
            </button>
            <button onClick={() => setIsEditing(true)} className="p-2 bg-brand/10 text-brand border border-brand/50 rounded-sm shadow-lg hover:bg-brand/20" title="Editar Gráfico">
                <Settings2 size={18}/>
            </button>
        </div>

        <div className="w-full h-[350px] text-xs relative z-10">
           <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
           </ResponsiveContainer>
        </div>

        {insight && (
            <div className="mt-4 p-3 bg-brand/5 border-l-2 border-brand text-xs text-blue-200 italic flex gap-2 relative z-10">
                <Sparkles size={14} className="text-brand shrink-0 mt-0.5" />
                {insight}
            </div>
        )}

        {isEditing && (
            <div className="absolute inset-0 bg-[#020617] z-50 p-0 rounded-sm flex flex-col animate-in fade-in zoom-in-95 border border-brand/30 overflow-hidden font-sans">
                <div className="flex border-b border-white/10 bg-[#0f172a]">
                    <button onClick={() => setEditTab('data')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${editTab === 'data' ? 'text-brand border-b-2 border-brand' : 'text-gray-500'}`}><Table size={14} className="inline mr-1"/> Dados</button>
                    <button onClick={() => setEditTab('style')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${editTab === 'style' ? 'text-brand border-b-2 border-brand' : 'text-gray-500'}`}><Palette size={14} className="inline mr-1"/> Estilo</button>
                    <button onClick={() => setEditTab('ai')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${editTab === 'ai' ? 'text-brand border-b-2 border-brand' : 'text-gray-500'}`}><Sparkles size={14} className="inline mr-1"/> Sexta-feira</button>
                    <button onClick={() => setIsEditing(false)} className="w-10 flex items-center justify-center text-gray-500 hover:text-white"><X size={16}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {editTab === 'data' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2 p-2 bg-blue-900/10 border border-blue-500/20 rounded text-xs text-blue-300">
                                <HelpCircle size={14}/> Dica: Cole (Ctrl+V) uma tabela do Excel aqui.
                            </div>
                            
                            <div className="overflow-auto max-h-[300px] border border-white/10 rounded-sm" onPaste={handlePaste}>
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-[#1e293b] text-gray-300 sticky top-0">
                                        <tr>
                                            {['name', ...seriesKeys].map(k => (
                                                <th key={k} className="p-2 border-b border-[#333]">
                                                    <div className="flex justify-between">{k} {k !== 'name' && <button onClick={() => removeSeries(k)}><Trash2 size={10} className="text-red-400"/></button>}</div>
                                                </th>
                                            ))}
                                            <th className="p-2 border-b border-[#333] w-8"><button onClick={addSeries}><Plus size={14} className="text-brand"/></button></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#333]">
                                        {visualData.map((row, i) => (
                                            <tr key={i} className="hover:bg-white/5">
                                                {['name', ...seriesKeys].map(k => (
                                                    <td key={k} className="p-1">
                                                        <input className="bg-transparent w-full outline-none text-white text-right px-1 focus:text-brand" value={row[k]} onChange={e => updateVisualCell(i, k, e.target.value)} />
                                                    </td>
                                                ))}
                                                <td></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500 font-bold uppercase">Título</label>
                                <input value={tempTitle} onChange={e => setTempTitle(e.target.value)} className="w-full bg-[#1e293b] border border-[#333] rounded-sm p-2 text-sm text-white focus:border-brand outline-none" />
                            </div>
                        </div>
                    )}

                    {editTab === 'style' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 font-bold uppercase">Tipo de Gráfico</label>
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
                                <label className="text-xs text-gray-500 font-bold uppercase">Paleta Temática</label>
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
                                        <span className="text-[10px] text-gray-400">Eixo Y (Dir)</span>
                                        <input value={yAxisRightLabel} onChange={e => updateAttributes({ yAxisRightLabel: e.target.value })} className="w-full bg-[#1e293b] border border-[#333] rounded-sm p-1.5 text-xs text-white focus:border-brand outline-none" placeholder="Opcional" />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <span className="text-[10px] text-gray-400">Eixo X</span>
                                        <input value={xAxisLabel} onChange={e => updateAttributes({ xAxisLabel: e.target.value })} className="w-full bg-[#1e293b] border border-[#333] rounded-sm p-1.5 text-xs text-white focus:border-brand outline-none" placeholder="Ex: Meses" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-2 border-t border-[#333] flex-wrap">
                                <label className="flex items-center gap-2 text-sm text-white cursor-pointer"><input type="checkbox" checked={showGrid} onChange={e => updateAttributes({ showGrid: e.target.checked })} className="accent-brand" /> <Grid3X3 size={14}/> Grid</label>
                                <label className="flex items-center gap-2 text-sm text-white cursor-pointer"><input type="checkbox" checked={showLegend} onChange={e => updateAttributes({ showLegend: e.target.checked })} className="accent-brand" /> <Layout size={14}/> Legenda</label>
                                <label className="flex items-center gap-2 text-sm text-white cursor-pointer"><input type="checkbox" checked={showAverage} onChange={e => updateAttributes({ showAverage: e.target.checked })} className="accent-brand" /> <ActivitySquare size={14}/> Linha de Média</label>
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
                                placeholder="Ex: Crie um gráfico de barras comparando a população das 5 maiores cidades do Brasil..."
                                className="flex-1 bg-[#1e293b] border border-[#333] rounded-sm p-4 text-sm text-white focus:border-purple-500 outline-none resize-none"
                            />
                            <button 
                                onClick={handleGenerateData} 
                                disabled={isAiLoading || !aiPrompt.trim()}
                                className="w-full bg-purple-600 text-white py-3 rounded-sm font-bold hover:brightness-110 disabled:opacity-50 flex justify-center gap-2 items-center shadow-lg"
                            >
                                {isAiLoading ? <Activity className="animate-spin"/> : <Sparkles/>} Gerar
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[#333] bg-[#0f172a]">
                    <button onClick={handleSave} className="w-full bg-brand text-[#0b141a] py-3 rounded-sm font-bold hover:brightness-110 shadow-[0_0_15px_-5px_var(--brand)] transition-shadow">Aplicar Configuração</button>
                </div>
            </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};
