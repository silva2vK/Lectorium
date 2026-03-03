import React from 'react';

interface Props {
  content: string;
}

export const CustomMarkdown: React.FC<Props> = ({ content }) => {
  const renderInline = (text: string) => {
    // Bold: **text**
    let parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      // Italic: *text*
      let italicParts = part.split(/(\*.*?\*)/g);
      return italicParts.map((iPart, j) => {
        if (iPart.startsWith('*') && iPart.endsWith('*')) {
          return <em key={`${i}-${j}`} className="italic text-white/90">{iPart.slice(1, -1)}</em>;
        }
        // Inline code: `code`
        let codeParts = iPart.split(/(`.*?`)/g);
        return codeParts.map((cPart, k) => {
          if (cPart.startsWith('`') && cPart.endsWith('`')) {
            return <code key={`${i}-${j}-${k}`} className="bg-white/10 text-brand px-1 py-0.5 rounded text-xs font-mono">{cPart.slice(1, -1)}</code>;
          }
          return cPart;
        });
      });
    });
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (inTable) {
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-4 border border-white/10 rounded-lg">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                {tableHeaders.map((h, i) => (
                  <th key={i} className="p-2 font-bold text-white">{renderInline(h.trim())}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tableRows.map((row, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className="p-2 text-white/80">{renderInline(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.split('|').slice(1, -1);
      if (!inTable) {
        // Check if next line is separator
        if (i + 1 < lines.length && lines[i+1].trim().match(/^\|[\s-:]+\|/)) {
          inTable = true;
          tableHeaders = cells;
          i++; // skip separator
          continue;
        }
      } else {
        tableRows.push(cells);
        continue;
      }
    } else {
      flushTable();
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-lg font-bold text-white mt-4 mb-2">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-bold text-white mt-5 mb-3">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold text-white mt-6 mb-4">{renderInline(line.slice(2))}</h1>);
    } 
    // Lists
    else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(<li key={i} className="ml-4 list-disc my-1 text-white/90">{renderInline(line.trim().slice(2))}</li>);
    } else if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^\d+\.\s/);
      elements.push(<li key={i} className="ml-4 list-decimal my-1 text-white/90">{renderInline(line.slice(match![0].length))}</li>);
    }
    // Empty lines
    else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2"></div>);
    }
    // Paragraphs
    else {
      elements.push(<p key={i} className="my-1 text-white/90 leading-relaxed">{renderInline(line)}</p>);
    }
  }
  
  flushTable();

  return <div className="markdown-body custom-markdown space-y-1">{elements}</div>;
};
