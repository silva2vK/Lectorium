import React, { useMemo } from 'react';
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

  // Resolve color for a specific ITEM (row) based on its name or index
  const getItemColor = (item: any, index: number) => {
      if (customColors[item.nome]) return customColors[item.nome];
      return paletteColors[index % paletteColors.length];
  };

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

  const renderChart = () => {
    if (!data || data.length === 0) return <div className="text-text-sec flex items-center justify-center h-full">Sem dados</div>;

    // Simple SVG Bar Chart Implementation for 'bar' type
    if (type === 'bar' && isSingleSeries) {
        const valKey = dataKeys[0];
        const maxVal = Math.max(...data.map(d => parseFloat(d[valKey]) || 0));
        
        return (
            <div className="w-full h-full flex items-end justify-around gap-2 pb-6 pt-4">
                {data.map((item, idx) => {
                    const val = parseFloat(item[valKey]) || 0;
                    const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                    const color = getItemColor(item, idx);
                    
                    return (
                        <div key={idx} className="flex flex-col items-center justify-end h-full w-full group relative">
                            {/* Tooltip */}
                            <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#020617] border border-[#334155] p-2 rounded text-xs font-mono z-50 pointer-events-none whitespace-nowrap shadow-xl">
                                <span className="font-bold text-white">{item.nome}</span>: <span style={{color}}>{val}</span>
                            </div>
                            
                            {/* Bar */}
                            <div 
                                className="w-full max-w-[40px] rounded-t-sm transition-all duration-500 ease-out"
                                style={{ 
                                    height: `${heightPct}%`, 
                                    backgroundColor: color,
                                    backgroundImage: `linear-gradient(to bottom, ${color}ee, ${color}33)`
                                }}
                            />
                            
                            {/* Label */}
                            <span className="text-[10px] text-text-sec mt-2 truncate w-full text-center font-mono" title={item.nome}>
                                {item.nome}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center justify-center border border-dashed border-border rounded-lg bg-surface/50">
            <div className="text-center">
                <p className="text-text-sec text-sm mb-2">Gráfico Autoral em Desenvolvimento</p>
                <p className="text-xs text-text-sec/50 font-mono">Tipo: {type}</p>
            </div>
        </div>
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
         {renderChart()}
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
