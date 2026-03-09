
import React from 'react';
import { ChevronRight } from 'lucide-react';

interface Props {
  content: string;
  onOptionSelect?: (option: string) => void;
}

// Extrai blocos :::options{...}::: do conteúdo, retornando segmentos de texto e opções
interface TextSegment { type: 'text'; value: string }
interface OptionsSegment { type: 'options'; items: string[] }
type Segment = TextSegment | OptionsSegment;

function parseSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  // Regex: captura tudo antes, o bloco :::options\n{json}\n:::, e o restante
  const BLOCK_RE = /:::options\s*\n([\s\S]*?)\n:::/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BLOCK_RE.exec(content)) !== null) {
    // Texto antes do bloco
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index).trimEnd() });
    }
    // Parse do JSON do bloco
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed.items) && parsed.items.length >= 2) {
        segments.push({ type: 'options', items: parsed.items.slice(0, 4) });
      }
    } catch {
      // JSON inválido — trata como texto puro para não quebrar a UI
      segments.push({ type: 'text', value: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  // Texto restante após o último bloco
  if (lastIndex < content.length) {
    const tail = content.slice(lastIndex).trimStart();
    if (tail) segments.push({ type: 'text', value: tail });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: content }];
}

// ---- Renderizador de inline markdown (inalterado) ----
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    const italicParts = part.split(/(\*.*?\*)/g);
    return italicParts.map((iPart, j) => {
      if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length > 2) {
        return <em key={`${i}-${j}`} className="italic text-white/90">{iPart.slice(1, -1)}</em>;
      }
      const codeParts = iPart.split(/(`.*?`)/g);
      return codeParts.map((cPart, k) => {
        if (cPart.startsWith('`') && cPart.endsWith('`') && cPart.length > 2) {
          return <code key={`${i}-${j}-${k}`} className="bg-white/10 text-brand px-1 py-0.5 rounded text-xs font-mono">{cPart.slice(1, -1)}</code>;
        }
        return cPart;
      });
    });
  });
}

// ---- Renderizador de bloco de texto markdown ----
function renderTextBlock(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushTable = (key: string) => {
    if (inTable) {
      elements.push(
        <div key={key} className="overflow-x-auto my-4 border border-white/10 rounded-lg">
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

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.split('|').slice(1, -1);
      if (!inTable) {
        if (i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\s-:]+\|/)) {
          inTable = true;
          tableHeaders = cells;
          i++;
          continue;
        }
      } else {
        tableRows.push(cells);
        continue;
      }
    } else {
      flushTable(`table-${i}`);
    }

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-lg font-bold text-white mt-4 mb-2">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-bold text-white mt-5 mb-3">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold text-white mt-6 mb-4">{renderInline(line.slice(2))}</h1>);
    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(<li key={i} className="ml-4 list-disc my-1 text-white/90">{renderInline(line.trim().slice(2))}</li>);
    } else if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^\d+\.\s/);
      elements.push(<li key={i} className="ml-4 list-decimal my-1 text-white/90">{renderInline(line.slice(match![0].length))}</li>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="my-1 text-white/90 leading-relaxed">{renderInline(line)}</p>);
    }
  }

  flushTable('table-end');
  return elements;
}

// ---- Componente de opções clicáveis ----
interface OptionsBlockProps {
  items: string[];
  onOptionSelect?: (option: string) => void;
}

const OptionsBlock: React.FC<OptionsBlockProps> = ({ items, onOptionSelect }) => {
  const [selected, setSelected] = React.useState<string | null>(null);

  if (selected) return null; // Some após seleção

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
        Explorar
      </p>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            setSelected(item);
            onOptionSelect?.(item);
          }}
          className="flex items-center justify-between gap-2 w-full text-left px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-brand/10 hover:border-brand/40 hover:text-brand transition-all text-sm text-white/80 group active:scale-[0.98]"
        >
          <span className="leading-snug">{item}</span>
          <ChevronRight size={14} className="shrink-0 text-white/20 group-hover:text-brand transition-colors" />
        </button>
      ))}
    </div>
  );
};

// ---- Componente principal ----
export const CustomMarkdown: React.FC<Props> = ({ content, onOptionSelect }) => {
  const segments = parseSegments(content);

  return (
    <div className="markdown-body custom-markdown space-y-1">
      {segments.map((seg, i) => {
        if (seg.type === 'options') {
          return (
            <OptionsBlock
              key={`options-${i}`}
              items={seg.items}
              onOptionSelect={onOptionSelect}
            />
          );
        }
        return (
          <React.Fragment key={`text-${i}`}>
            {renderTextBlock(seg.value)}
          </React.Fragment>
        );
      })}
    </div>
  );
};
