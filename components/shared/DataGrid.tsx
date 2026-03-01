import React from 'react';

export interface DataGridColumn {
  key: string;
  label: string;
  width?: string;
}

export interface DataGridProps {
  columns: DataGridColumn[];
  data: any[];
  title?: string;
  className?: string;
}

export const DataGrid: React.FC<DataGridProps> = ({
  columns,
  data,
  title,
  className = ''
}) => {
  return (
    <div className={`relative group border border-[#1e3a8a]/40 bg-[#020617] rounded-sm transition-all w-full shadow-[0_0_40px_-10px_rgba(30,58,138,0.2)] overflow-hidden flex flex-col ${className}`}>
      {title && (
        <div className="flex flex-col items-center mb-4 pt-6 px-6 relative z-10">
          <h3 className="text-xl font-bold text-white tracking-tight uppercase font-mono">{title}</h3>
          <div className="w-16 h-0.5 bg-brand/50 mt-1"></div>
        </div>
      )}
      
      <div className="overflow-x-auto p-4 custom-scrollbar">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-[#1e293b] text-gray-300">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="p-3 border border-[#333] font-bold" style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-white/5 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="p-3 border border-[#333] text-gray-300">
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-4 text-center text-gray-500 italic">
                  Nenhum dado disponível.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
