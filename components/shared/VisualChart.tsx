import React, { useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ComposedChart, ReferenceLine, Label
} from 'recharts';
import { Sparkles } from 'lucide-react';

// --- PALETAS TEMÁTICAS VIBRANTES ---
export const PALETTES: Record<string, { label: string, colors: string[] }> = {
  default: { label: 'Vibrant', colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'] },
  maker: { label: 'The Maker', colors: ['#2563eb', '#DC143C', '#f8fafc', '#64748b', '#0f172a'] },
  academic: { label: 'Sóbrio', colors: ['#334155', '#94a3b8', '#cbd5e1', '#475569', '#1e293b'] },
  neon: { label: 'Cyberpunk', colors: ['#00f0ff', '#ff00aa', '#bc13fe', '#f9f871', '#00ff9f'] },
  forest: { label: 'Bioluminescente', colors: ['#4ade80', '#2dd4bf', '#a3e635', '#0ea5e9', '#10b981'] },
  warm: { label: 'Solar', colors: ['#ff5722', '#ffc107', '#ff9800', '#f44336', '#e91e63'] }
};

export interface VisualChartProps {
  type: string;
  data: any[];
  title: string;
  paletteKey?: string;
  customColors?: Record<string, string>;
  showGrid?: boolean;
  showLegend?: boolean;
  showAverage?: boolean;
  isStacked?: boolean;
  insight?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  yAxisRightLabel?: string;
  className?: string;
}

export const VisualChart: React.FC<VisualChartProps> = ({
  type = 'bar',
  data = [],
  title = 'Gráfico',
  paletteKey = 'default',
  customColors = {},
  showGrid = true,
  showLegend = true,
  showAverage = true,
  isStacked = false,
  insight = '',
  xAxisLabel = '',
  yAxisLabel = '',
  yAxisRightLabel = '',
  className = ''
}) => {
  // Derived Values
  const paletteColors = PALETTES[paletteKey]?.colors || PALETTES['default'].colors;
  const dataKeys = Object.keys(data[0] || {}).filter(k => k !== 'nome' && k !== 'desc');
  
  // MODO DISTRIBUIÇÃO: Ativado se houver apenas 1 série de dados (ex: "valor")
  const isSingleSeries = dataKeys.length === 1;

  // Resolve color for a series index/key OR item name
  const getSeriesColor = (key: string, index: number) => {
      if (customColors[key]) return customColors[key];
      return paletteColors[index % paletteColors.length];
  };
  
  // Resolve color for a specific ITEM (row) based on its name or index
  const getItemColor = (item: any, index: number) => {
      if (customColors[item.nome]) return customColors[item.nome];
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
    const commonProps = { data, margin: { top: 20, right: 30, left: 10, bottom: 5 } };
    const grid = showGrid ? <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} /> : null;
    const fontStyle = { fontFamily: 'monospace', fontSize: 10 };
    const whiteColor = '#ffffff';
    
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
    <div className={`relative group border border-[#1e3a8a]/40 bg-[#020617] rounded-sm transition-all w-full shadow-[0_0_40px_-10px_rgba(30,58,138,0.2)] overflow-hidden flex flex-col ${className}`}>
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20" style={{ backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.15) 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />

      <div className="flex flex-col items-center mb-4 pt-6 px-6 relative z-10">
         <h3 className="text-xl font-bold text-white tracking-tight uppercase font-mono">{title}</h3>
         <div className="w-16 h-0.5 bg-brand/50 mt-1"></div>
      </div>

      <div className="w-full h-[350px] text-xs relative z-10 px-4 min-h-[350px]">
         <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
         </ResponsiveContainer>
      </div>

      {(isSingleSeries || type === 'pie') && showLegend && (
          <div className="w-full z-20 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 p-3 bg-[#020617]/50 border-t border-white/10 transition-all relative">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider mr-2 border-r border-white/20 pr-3 hidden md:block">
                  {dataKeys[0] || 'Dados'}
              </span>

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
              
              <div className="w-px h-4 bg-white/20 mx-2 hidden sm:block"></div>
              <div className="flex items-center gap-2 text-[11px] whitespace-nowrap border border-white/10 px-3 py-0.5 rounded-full bg-white/5">
                  <span className="text-[9px] font-bold text-brand uppercase tracking-wider">TOTAL</span>
                  <span className="text-white font-mono font-bold">{grandTotal}</span>
              </div>
          </div>
      )}

      {insight && (
          <div className="p-4 bg-brand/5 border-t border-white/10 text-xs text-blue-200 italic flex gap-2 relative z-10">
              <Sparkles size={14} className="text-brand shrink-0 mt-0.5" />
              {insight}
          </div>
      )}
    </div>
  );
};
