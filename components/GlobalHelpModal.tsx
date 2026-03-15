import React, { useState, useEffect } from 'react';
import { Icon } from './shared/Icon';
import {
  Cloud, AlertTriangle, CheckSquare, Globe, Shield, Zap, Layers, CheckCircle2,
  AlertCircle, Wifi, HardDrive, RefreshCw, FileText, Wand2, BrainCircuit,
  FilePlus, FolderPlus, Download, ExternalLink, Lock, Key, Info, Menu, Workflow,
  Pin, Clock, Server, File, FolderOpen, Upload, Signal, Home, Folder,
  FolderInput, BarChart2, Square, Terminal, Cpu, LogOut, User, Palette,
  ChevronDown, ChevronRight, DownloadCloud, LayoutGrid, LogIn, Wrench, Scale,
  Minimize, Contrast, UploadCloud, FileType, Copy, Scissors, Bold, Italic,
  Link, MessageSquarePlus, Share2, ArrowDown, ArrowUp, Replace, ReplaceAll,
  AlignLeft, AlignCenter, AlignRight, Settings2, Crop, RotateCw, Type,
  RefreshCcw, Hash, ChevronLeft, PenTool, ClipboardPaste, EyeOff, Activity,
  Edit2, HelpCircle, Book, Columns, LayoutTemplate, PanelTop, PanelBottom,
  Keyboard, Command, Settings, ArrowUpFromLine, Code, Sigma, RotateCcw,
  Gavel, Hourglass, PanelLeft, Droplets, Binary, Pen, Highlighter, ScrollText,
  SplitSquareHorizontal, MousePointer2, StickyNote, Eraser, MoveHorizontal,
  Minus, ZoomIn, Paintbrush, Languages, ListRestart, FileDiff, XCircle,
  FileWarning, WifiOff, Send, Bot, Podcast, Pipette, Chrome, Safari, Firefox,
  Apple, Smartphone, X, Battery, BookOpen, ArrowRight, ArrowLeft, ShieldCheck,
  Touchpad, MousePointerClick, MessageSquare, Sparkles,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
}

// ─── Estilos compartilhados ────────────────────────────────────────────────────

const card = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '10px',
  padding: '14px 16px',
} as const;

const cardHighlight = (color: string) => ({
  background: `${color}08`,
  border: `1px solid ${color}25`,
  borderRadius: '10px',
  padding: '14px 16px',
});

const label = {
  color: 'rgba(255,255,255,0.25)',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  marginBottom: '10px',
  display: 'block',
};

const sectionTitle = {
  color: 'rgba(255,255,255,0.9)',
  fontSize: '16px',
  fontWeight: 700,
  marginBottom: '12px',
};

const bodyText = {
  color: 'rgba(255,255,255,0.55)',
  fontSize: '13px',
  lineHeight: 1.6,
};

const mono = {
  fontFamily: 'monospace',
  fontSize: '11px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '6px',
  padding: '2px 6px',
  color: 'rgba(255,255,255,0.7)',
};

// ─── Componente de tabela de flags ─────────────────────────────────────────────

interface FlagRow {
  flag: string;
  value: string;
  enabled: boolean;
  note: string;
  isNew?: boolean;
  deprecated?: boolean;
}

const FlagTable: React.FC<{ rows: FlagRow[]; accentColor: string }> = ({ rows, accentColor }) => (
  <div style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
      <thead>
        <tr style={{ background: 'rgba(0,0,0,0.4)' }}>
          <th style={{ padding: '8px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.08em', fontSize: '9px', textTransform: 'uppercase', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Flag</th>
          <th style={{ padding: '8px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.08em', fontSize: '9px', textTransform: 'uppercase', width: '72px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Definir como</th>
          <th style={{ padding: '8px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.08em', fontSize: '9px', textTransform: 'uppercase' }}>Efeito</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.flag}
            style={{
              borderTop: '1px solid rgba(255,255,255,0.05)',
              opacity: row.deprecated ? 0.45 : 1,
            }}
          >
            <td style={{ padding: '8px 10px', borderRight: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace', color: accentColor, verticalAlign: 'top' }}>
              {row.flag}
              {row.isNew && (
                <span style={{ marginLeft: '6px', fontSize: '8px', background: `${accentColor}20`, color: accentColor, borderRadius: '4px', padding: '1px 5px', fontFamily: 'sans-serif', fontWeight: 700 }}>NOVO</span>
              )}
              {row.deprecated && (
                <span style={{ marginLeft: '6px', fontSize: '8px', background: 'rgba(255,100,100,0.15)', color: '#f87171', borderRadius: '4px', padding: '1px 5px', fontFamily: 'sans-serif', fontWeight: 700 }}>OBSOLETO</span>
              )}
            </td>
            <td style={{ padding: '8px 10px', borderRight: '1px solid rgba(255,255,255,0.05)', fontWeight: 700, color: row.enabled ? '#4ade80' : '#f87171', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
              {row.value}
            </td>
            <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.5)', verticalAlign: 'top', lineHeight: 1.5 }}>
              {row.note}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Conteúdo das seções ───────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'intro',
    title: 'Acesso e Google Drive',
    icon: Cloud,
    content: (
      <div className="space-y-4">
        <div style={cardHighlight('#08fc72')}>
          <h3 style={{ ...sectionTitle, fontSize: '14px' }}>Por que pedimos permissão 2 vezes?</h3>
          <p style={bodyText}>
            O Lectorium não tem servidor próprio. Seus arquivos ficam salvos diretamente no{' '}
            <strong style={{ color: 'rgba(255,255,255,0.85)' }}>seu Google Drive</strong>.
            Para isso funcionar, precisamos de duas chaves separadas.
          </p>
        </div>

        <div className="space-y-3">
          <div style={card}>
            <div className="flex gap-3 items-start">
              <div style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '6px 10px', fontWeight: 700, color: '#60a5fa', fontSize: '13px', flexShrink: 0 }}>1</div>
              <div>
                <strong style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: '4px', fontSize: '13px' }}>Login (Identidade)</strong>
                <p style={{ ...bodyText, fontSize: '12px' }}>Para sabermos seu nome e foto.</p>
              </div>
            </div>
          </div>

          <div style={{ ...card, border: '1px solid rgba(234,179,8,0.25)', background: 'rgba(234,179,8,0.04)' }}>
            <div className="flex gap-3 items-start">
              <div style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '8px', padding: '6px 10px', fontWeight: 700, color: '#fbbf24', fontSize: '13px', flexShrink: 0 }}>2</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <strong style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>Acesso aos Arquivos</strong>
                  <AlertTriangle size={13} style={{ color: '#fbbf24' }} />
                </div>
                <p style={{ ...bodyText, fontSize: '12px', marginBottom: '10px' }}>
                  Uma tela do Google pedirá para "Ver, editar, criar e excluir arquivos".
                </p>
                <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: '#4ade80', fontSize: '11px', fontWeight: 700 }}>
                    <CheckSquare size={12} /> O QUE VOCÊ DEVE FAZER
                  </div>
                  <p style={{ ...bodyText, fontSize: '12px' }}>
                    Você <strong style={{ color: 'rgba(255,255,255,0.85)' }}>precisa marcar todas as caixas</strong>. Sem isso, o Lectorium não conseguirá salvar nada.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'browsers',
    title: 'Navegadores',
    icon: Globe,
    content: (
      <div className="space-y-4">
        <div>
          <h3 style={sectionTitle}>Tier List de Performance</h3>
          <p style={bodyText}>
            O Lectorium usa WebAssembly e File System Access API. Sua experiência depende do motor do navegador.
          </p>
        </div>

        {[
          {
            tier: 'S',
            label: 'Recomendado',
            sublabel: 'Chromium',
            color: '#4ade80',
            items: [
              { icon: <Chrome size={16} style={{ color: '#60a5fa' }} />, name: 'Google Chrome' },
              { icon: <Shield size={16} style={{ color: '#fb923c' }} />, name: 'Brave' },
              { icon: <Zap size={16} style={{ color: '#22d3ee' }} />, name: 'Microsoft Edge' },
              { icon: <Layers size={16} style={{ color: '#f87171' }} />, name: 'Vivaldi' },
            ],
            note: { icon: <CheckCircle2 size={10} style={{ color: '#4ade80' }} />, text: 'Edição de arquivos locais sem re-upload.' },
          },
          {
            tier: 'A',
            label: 'Excelente',
            sublabel: 'Mobile & Alternativos',
            color: '#60a5fa',
            items: [
              { icon: <Smartphone size={16} style={{ color: '#c084fc' }} />, name: 'Samsung Internet' },
              { icon: <Icon name="Disc" size={16} className="text-red-500" />, name: 'Opera' },
              { icon: <Smartphone size={16} style={{ color: '#fbbf24' }} />, name: 'Soul Browser' },
            ],
          },
          {
            tier: 'B',
            label: 'Compatível',
            sublabel: 'Sem Acesso Nativo',
            color: '#fbbf24',
            items: [
              { icon: <Icon name="Flame" size={16} className="text-orange-500" />, name: 'Firefox' },
              { icon: <Icon name="Compass" size={16} className="text-blue-300" />, name: 'Safari' },
            ],
            note: { icon: <AlertTriangle size={10} style={{ color: '#fbbf24' }} />, text: 'Arquivos locais requerem "Salvar como Cópia".' },
          },
        ].map(({ tier, label: tierLabel, sublabel, color, items, note }) => (
          <div key={tier} style={{ ...card, border: `1px solid ${color}22` }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ color, fontWeight: 700, fontSize: '13px' }}>TIER {tier} — {tierLabel}</span>
              <span style={{ color: `${color}99`, fontSize: '10px', background: `${color}15`, borderRadius: '4px', padding: '2px 8px', fontWeight: 600 }}>{sublabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map(({ icon, name }) => (
                <div key={name} className="flex items-center gap-2.5" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px' }}>
                  {icon}
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>{name}</span>
                </div>
              ))}
            </div>
            {note && (
              <div className="flex items-center gap-1.5 mt-2.5" style={{ paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {note.icon}
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>{note.text}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'tuning',
    title: 'Tuning & Performance',
    icon: Zap,
    content: (
      <div className="space-y-4">
        {/* Disclaimer */}
        <div style={{ ...cardHighlight('#ef4444'), padding: '12px 14px' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ color: '#fca5a5', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Aviso de risco</p>
              <p style={{ ...bodyText, fontSize: '12px' }}>
                Estas configurações alteram o motor do navegador. Podem causar instabilidade.{' '}
                <strong style={{ color: 'rgba(255,255,255,0.7)' }}>O usuário assume total responsabilidade.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Nota de versão */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 14px' }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', lineHeight: 1.5 }}>
            <strong style={{ color: 'rgba(255,255,255,0.45)' }}>Fonte:</strong> Chrome Developers, chromestatus.com, Android Authority — referência{' '}
            <strong style={{ color: 'rgba(255,255,255,0.45)' }}>Chrome 132–134 (jan–mar 2026)</strong>, motor Chromium compartilhado com Brave.
            Flags marcadas como OBSOLETO ainda existem mas não têm efeito prático nesta versão.
          </p>
        </div>

        {/* Chromium */}
        <div style={{ ...card, border: '1px solid rgba(96,165,250,0.2)' }}>
          <div className="flex items-center gap-2 mb-1" style={{ paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex -space-x-1">
              <Chrome size={16} style={{ color: '#60a5fa' }} />
              <Shield size={16} style={{ color: '#fb923c' }} />
              <Layers size={16} style={{ color: '#f87171' }} />
            </div>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: '13px' }}>Chromium — Chrome · Brave · Edge · Vivaldi</span>
          </div>

          <div className="space-y-3 mb-3">
            <p style={{ ...bodyText, fontSize: '12px' }}>
              Forçam o uso da GPU para renderização de PDF e interface, liberando CPU para IA.
            </p>
            <div className="flex gap-2">
              {[
                { browser: 'Chrome / Brave / Edge', addr: 'chrome://flags', color: '#60a5fa' },
                { browser: 'Vivaldi', addr: 'vivaldi://flags', color: '#f87171' },
              ].map(({ browser, addr, color }) => (
                <div key={browser} style={{ flex: 1, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginBottom: '4px' }}>{browser}</p>
                  <code style={{ ...mono, color }}>{addr}</code>
                </div>
              ))}
            </div>
          </div>

          <FlagTable
            accentColor="#93c5fd"
            rows={[
              { flag: 'gpu-rasterization', value: 'Enabled', enabled: true, note: 'Renderiza PDF com a GPU. Em hardware moderno pode já estar ativo — force para garantir consistência.' },
              { flag: 'enable-zero-copy', value: 'Enabled', enabled: true, note: 'Escreve direto na memória GPU (menos RAM). Risco: aumenta chance de crash em drivers instáveis.' },
              { flag: 'enable-parallel-downloading', value: 'Enabled', enabled: true, note: 'Divide downloads em 3 jobs simultâneos. Acelera PDFs grandes do Drive.' },
              { flag: 'override-software-rendering-list', value: 'Enabled', enabled: true, note: 'Ativa GPU mesmo em dispositivos na blocklist do Chrome. Útil em tablets mid-range.', isNew: true },
              { flag: 'back-forward-cache', value: 'Enabled', enabled: true, note: 'Preserva páginas em memória ao usar voltar/avançar. Elimina recarregamento entre abas.', isNew: true },
              { flag: '#enable-experimental-webassembly-features', value: 'Enabled', enabled: true, note: 'Habilita features Wasm experimentais. Pode acelerar o engine do pdfjs. Testar com cuidado.', isNew: true },
              { flag: 'smooth-scrolling', value: 'Enabled', enabled: true, note: 'Manter ativo em tablet touch. Desativar só se preferir resposta tátil completamente direta.' },
            ]}
          />
        </div>

        {/* Firefox */}
        <div style={{ ...card, border: '1px solid rgba(249,115,22,0.2)' }}>
          <div className="flex items-center gap-2 mb-3" style={{ paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Icon name="Flame" size={16} className="text-orange-500" />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: '13px' }}>Firefox Android</span>
          </div>

          <div className="space-y-3 mb-3">
            <p style={{ ...bodyText, fontSize: '12px' }}>
              Firefox padrão bloqueia configurações avançadas. Para melhor performance com PDF e OCR, use o{' '}
              <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Firefox Nightly</strong>.
            </p>
            <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Endereço de configuração</span>
              <code style={{ ...mono, color: '#86efac' }}>about:config</code>
            </div>
          </div>

          <FlagTable
            accentColor="#fdba74"
            rows={[
              { flag: 'gfx.webrender.all', value: 'true', enabled: true, note: 'Aceleração GPU total via WebRender. Fluidez máxima no scroll de PDF.' },
              { flag: 'layers.acceleration.force-enabled', value: 'true', enabled: true, note: 'Evita lag em PDFs grandes mesmo sem WebRender ativo.' },
              { flag: 'javascript.options.shared_memory', value: 'true', enabled: true, note: 'Multithreading eficiente para workers do pdfjs.' },
              { flag: 'apz.allow_zooming', value: 'false', enabled: false, note: 'Impede conflito de zoom duplo entre Firefox e o zoom do Lectorium.' },
              { flag: 'javascript.options.wasm_simd', value: '—', enabled: false, note: 'Não tem mais efeito. SIMD está ativo por padrão no Firefox 125+.', deprecated: true },
            ]}
          />

          <div className="flex gap-2 mt-3">
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
              <p style={{ color: '#c084fc', fontSize: '11px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={12} /> Extensões recomendadas
              </p>
              <p style={{ ...bodyText, fontSize: '11px' }}>uBlock Origin · LocalCDN</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
              <p style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={12} /> Sem File System Access
              </p>
              <p style={{ ...bodyText, fontSize: '11px' }}>Firefox não suporta a API de arquivos locais. Use "Salvar como Cópia".</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'troubleshoot',
    title: 'Solução de Problemas',
    icon: Wrench,
    content: (
      <div className="space-y-4">
        <h3 style={sectionTitle}>Diagnóstico e Correção Rápida</h3>

        {[
          {
            color: '#fbbf24',
            icon: <AlertCircle size={14} style={{ color: '#fbbf24' }} />,
            title: 'Erro "Não foi possível salvar" ou 403 Forbidden',
            body: 'O Lectorium perdeu permissão de escrita no Drive. Ocorre quando a sessão expirou ou as caixas de permissão não foram marcadas no login.',
            fix: 'Faça Logout e Login novamente, marcando TODAS as caixas do Google.',
            fixIcon: <RefreshCw size={11} />,
          },
          {
            color: '#60a5fa',
            icon: <FileText size={14} style={{ color: '#60a5fa' }} />,
            title: 'Arquivos locais não salvam no Drive',
            body: 'Por segurança, o navegador isola arquivos abertos do disco. Eles vivem apenas na memória da aba.',
            fix: 'Use "Salvar como Cópia" ou "Salvar no Drive" dentro do menu do editor.',
            fixIcon: <Upload size={11} />,
          },
          {
            color: '#c084fc',
            icon: <Workflow size={14} style={{ color: '#c084fc' }} />,
            title: 'A IA parou de responder (Erro 429)',
            body: 'O modelo Gemini possui limites por minuto na camada gratuita. Processamento intenso de páginas aciona o throttle.',
            fix: 'Aguarde 1–2 minutos. Para uso pesado, adicione sua API Key nas configurações.',
            fixIcon: <Key size={11} />,
          },
          {
            color: '#f87171',
            icon: <AlertTriangle size={14} style={{ color: '#f87171' }} />,
            title: 'Interface travada ou tela branca',
            body: 'Atualizações do app podem conflitar com dados antigos no cache.',
            fix: 'Menu Lateral → Configurações → Armazenamento → Redefinir Aplicação.',
            fixIcon: <RotateCcw size={11} />,
          },
        ].map(({ color, icon, title, body, fix, fixIcon }) => (
          <div key={title} style={card}>
            <div className="flex items-center gap-2 mb-2">
              {icon}
              <strong style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>{title}</strong>
            </div>
            <p style={{ ...bodyText, fontSize: '12px', marginBottom: '10px' }}>{body}</p>
            <div className="flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 12px' }}>
              <span style={{ color: color, flexShrink: 0 }}>{fixIcon}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}><strong style={{ color: 'rgba(255,255,255,0.85)' }}>Solução:</strong> {fix}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'pdf',
    title: 'Dominando o PDF',
    icon: FileText,
    content: (
      <div className="space-y-4">
        <h3 style={sectionTitle}>Ferramentas de Leitura</h3>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: <Highlighter size={16} style={{ color: 'var(--brand)' }} />, title: 'Marca-texto', desc: 'Selecione o texto e clique no ícone de destaque.' },
            { icon: <Pen size={16} style={{ color: '#c084fc' }} />, title: 'Caneta', desc: 'Use a barra inferior para desenhar livremente sobre o PDF.' },
            { icon: <StickyNote size={16} style={{ color: '#fbbf24' }} />, title: 'Nota', desc: 'Adiciona um marcador âncora com texto na posição clicada.' },
            { icon: <Eraser size={16} style={{ color: '#f87171' }} />, title: 'Borracha', desc: 'Remove anotações não burned diretamente no canvas.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={card}>
              <div className="flex items-center gap-2 mb-1.5">{icon}<strong style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>{title}</strong></div>
              <p style={{ ...bodyText, fontSize: '11px' }}>{desc}</p>
            </div>
          ))}
        </div>

        <div style={cardHighlight('var(--brand)')}>
          <h4 className="flex items-center gap-2 mb-3" style={{ color: 'var(--brand)', fontWeight: 700, fontSize: '13px' }}>
            <Touchpad size={16} /> Smart Tap — Seleção Rápida
          </h4>
          <p style={{ ...bodyText, fontSize: '12px', marginBottom: '12px' }}>
            Selecionar texto em PDFs no tablet pode ser difícil. O Lectorium resolve isso com{' '}
            <strong style={{ color: 'rgba(255,255,255,0.8)' }}>toque em dois pontos</strong>:
          </p>
          {[
            'Toque na primeira palavra que deseja selecionar.',
            'Toque na última palavra.',
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--brand)', color: '#0b141a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>{i + 1}</span>
              <p style={{ ...bodyText, fontSize: '12px' }}>{text}</p>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <CheckCircle2 size={14} style={{ color: '#4ade80' }} />
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 600 }}>Pronto — o sistema preenche tudo no meio.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'ai',
    title: 'Kalaki (IA)',
    icon: Sparkles,
    content: (
      <div className="space-y-4">
        <h3 style={sectionTitle}>Sua Assistente de Pesquisa</h3>
        <p style={bodyText}>Kalaki é a IA integrada. Ela lê o que você está vendo no documento.</p>

        <div className="space-y-2">
          {[
            { icon: <MousePointerClick size={16} style={{ color: '#c084fc' }} />, title: 'Selecione e Pergunte', desc: 'Selecione um trecho e clique no botão "IA" para explicação imediata.' },
            { icon: <FileText size={16} style={{ color: '#60a5fa' }} />, title: 'Resumo do Documento', desc: 'Abra a barra lateral da IA e peça um resumo ou faça perguntas sobre o arquivo completo.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3" style={card}>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', flexShrink: 0 }}>{icon}</div>
              <div>
                <strong style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: '3px', fontSize: '13px' }}>{title}</strong>
                <p style={{ ...bodyText, fontSize: '12px' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontStyle: 'italic' }}>
          A IA usa o modelo Gemini do Google. Respostas podem variar.
        </p>
      </div>
    ),
  },
  {
    id: 'offline',
    title: 'Modo Offline',
    icon: WifiOff,
    content: (
      <div className="space-y-4">
        <h3 style={sectionTitle}>Sem Internet? Sem Problema.</h3>
        <p style={bodyText}>O Lectorium salva automaticamente os arquivos abertos no seu dispositivo.</p>

        <div className="space-y-2">
          {[
            'Você pode fechar a aba e reabrir sem internet.',
            'Edições offline são salvas localmente.',
            'Ao voltar online, tudo é enviado automaticamente para o Drive.',
          ].map((text) => (
            <div key={text} className="flex items-center gap-3" style={card}>
              <CheckCircle2 size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
              <p style={{ ...bodyText, fontSize: '12px' }}>{text}</p>
            </div>
          ))}
        </div>

        <div style={cardHighlight('#4ade80')}>
          <p style={{ color: '#86efac', fontSize: '12px' }}>
            <strong>Dica:</strong> Instale o app (Adicionar à Tela de Início) para a melhor experiência offline.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'privacy',
    title: 'Privacidade',
    icon: ShieldCheck,
    content: (
      <div className="space-y-4">
        <h3 style={sectionTitle}>Seus Dados são Seus</h3>
        <p style={bodyText}>
          Diferente de outros serviços, o Lectorium{' '}
          <strong style={{ color: 'rgba(255,255,255,0.85)' }}>não copia seus arquivos</strong> para servidores próprios.
        </p>
        <p style={bodyText}>
          Funciona como um óculos: visualiza e edita o que já está no seu Google Drive ou no seu dispositivo.
        </p>

        <div className="space-y-2">
          {[
            { icon: <EyeOff size={14} style={{ color: '#4ade80' }} />, text: 'Não vemos seus PDFs nem seus mapas mentais.' },
            { icon: <Shield size={14} style={{ color: '#4ade80' }} />, text: 'Não vendemos suas informações.' },
            { icon: <Server size={14} style={{ color: '#4ade80' }} />, text: 'Zero servidores proprietários armazenando dados.' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3" style={card}>
              {icon}
              <p style={{ ...bodyText, fontSize: '12px' }}>{text}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

// ─── Componente principal ──────────────────────────────────────────────────────

export const GlobalHelpModal: React.FC<Props> = ({ isOpen, onClose, isMandatory = false }) => {
  const [activeSection, setActiveSection] = useState('intro');
  const [showMobileContent, setShowMobileContent] = useState(false);

  useEffect(() => {
    if (isOpen) setShowMobileContent(false);
  }, [isOpen]);

  const handleSectionClick = (id: string) => {
    setActiveSection(id);
    setShowMobileContent(true);
  };

  if (!isOpen) return null;

  const currentContent = SECTIONS.find((s) => s.id === activeSection)?.content;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-4xl animate-in zoom-in-95 duration-200 flex overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0e0e0e 0%, #0a0a0a 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)',
          height: '82vh',
        }}
      >
        {/* Sidebar */}
        <div
          className={`flex-col w-full md:w-60 ${showMobileContent ? 'hidden md:flex' : 'flex'}`}
          style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: '14px' }}>
              <BookOpen size={16} style={{ color: 'var(--brand)' }} />
              Guia Central
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
            {SECTIONS.map((section) => {
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionClick(section.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                  style={{
                    background: active ? 'var(--brand)' : 'transparent',
                    color: active ? '#0b141a' : 'rgba(255,255,255,0.45)',
                    fontWeight: active ? 700 : 400,
                    fontSize: '13px',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
                >
                  <section.icon size={15} style={{ flexShrink: 0 }} />
                  <span>{section.title}</span>
                  <ArrowRight size={12} className="ml-auto md:hidden" style={{ opacity: 0.4 }} />
                </button>
              );
            })}
          </div>

          {!isMandatory && (
            <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={onClose}
                className="w-full py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.07)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
              >
                Fechar Guia
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div
          className={`flex-1 flex-col relative ${!showMobileContent ? 'hidden md:flex' : 'flex'}`}
          style={{ minWidth: 0 }}
        >
          {/* Mobile back */}
          <div
            className="md:hidden flex items-center px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
          >
            <button
              onClick={() => setShowMobileContent(false)}
              className="flex items-center gap-2 text-sm font-bold"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          </div>

          {!isMandatory && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors hidden md:flex items-center justify-center"
              style={{ color: 'rgba(255,255,255,0.25)', zIndex: 10 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              <X size={16} />
            </button>
          )}

          <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
            <div className="max-w-2xl mx-auto">
              {currentContent}
            </div>
          </div>

          {isMandatory && (
            <div
              className="px-6 py-4 flex justify-end"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
            >
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
                style={{ background: 'var(--brand)', color: '#0b141a', boxShadow: '0 4px 16px rgba(8,252,114,0.25)' }}
              >
                Entendi, ir para o Workspace <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
