
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../src/components/shared/Icon';
import { updateDriveFile, downloadDriveFile, uploadFileToDrive } from '../services/driveService';
import { MindMapNode, MindMapEdge, MindMapViewport, MindMapData } from '../types';
import { AiChatPanel } from './shared/AiChatPanel';
import { MindMapSaveModal } from './modals/MindMapSaveModal';
import { MindMapRenameModal } from './modals/MindMapRenameModal';
import { DriveFolderPickerModal } from './pdf/modals/DriveFolderPickerModal';

// --- Constants ---
const ZOOM_LIMITS = { MIN: 0.2, MAX: 1.35 }; 
const AREA_LIMIT = 5000; 
const GRID_COLOR_NORMAL = 'rgba(255, 255, 255, 0.35)';
const GRID_COLOR_LIMIT = '#dc143c';
const NODE_COLORS = ['#4ade80', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#ef4444', '#ffffff'];

interface Props {
  fileId: string;
  fileName: string;
  fileBlob?: Blob;
  accessToken: string;
  onToggleMenu: () => void;
  onAuthError?: () => void;
  onRename?: (newName: string) => void; 
}

export const MindMapEditor: React.FC<Props> = ({ fileId, fileName, fileBlob, accessToken, onToggleMenu, onAuthError, onRename }) => {
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [edges, setEdges] = useState<MindMapEdge[]>([]);
  const [viewport, setViewport] = useState<MindMapViewport>({ x: 0, y: 0, zoom: 1 });
  
  const viewportRef = useRef<MindMapViewport>({ x: 0, y: 0, zoom: 1 });
  const isAtLimitRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);

  // Modal States
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const pointersRef = useRef<Map<number, { x: number, y: number }>>(new Map());
  const prevPinchDistRef = useRef<number | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const contentLayerRef = useRef<HTMLDivElement>(null); 
  const gridLayerRef = useRef<HTMLDivElement>(null);    
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLocalOnly = useMemo(() => fileId.startsWith('local-'), [fileId]);

  const clampViewport = useCallback((v: MindMapViewport): { viewport: MindMapViewport, atLimit: boolean } => {
    let atLimit = false;
    let newZoom = Math.max(ZOOM_LIMITS.MIN, Math.min(ZOOM_LIMITS.MAX, v.zoom));
    if (newZoom !== v.zoom) atLimit = true;
    let newX = Math.max(-AREA_LIMIT, Math.min(AREA_LIMIT, v.x));
    let newY = Math.max(-AREA_LIMIT, Math.min(AREA_LIMIT, v.y));
    if (newX !== v.x || newY !== v.y) atLimit = true;
    return { viewport: { x: newX, y: newY, zoom: newZoom }, atLimit };
  }, []);

  const applyVisualTransform = useCallback(() => {
      const { viewport: clamped, atLimit } = clampViewport(viewportRef.current);
      viewportRef.current = clamped;
      isAtLimitRef.current = atLimit;
      if (contentLayerRef.current) contentLayerRef.current.style.transform = `translate(${clamped.x}px, ${clamped.y}px) scale(${clamped.zoom})`;
      if (gridLayerRef.current) {
          gridLayerRef.current.style.backgroundSize = `${40 * clamped.zoom}px ${40 * clamped.zoom}px`;
          gridLayerRef.current.style.backgroundPosition = `${clamped.x}px ${clamped.y}px`;
          gridLayerRef.current.style.backgroundImage = `radial-gradient(${atLimit ? GRID_COLOR_LIMIT : GRID_COLOR_NORMAL} 1.5px, transparent 1.5px)`;
      }
  }, [clampViewport]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        let blob = fileBlob;
        if (!blob && accessToken && !fileId.startsWith('local-')) {
            blob = await downloadDriveFile(accessToken, fileId);
        }
        if (blob) {
            const data: MindMapData = JSON.parse(await blob.text());
            if (mounted) {
                const sanitized = clampViewport({ x: Number(data.viewport?.x) || window.innerWidth / 2, y: Number(data.viewport?.y) || window.innerHeight / 2, zoom: Number(data.viewport?.zoom) || 1 });
                setNodes(data.nodes || []);
                setEdges(data.edges || []);
                viewportRef.current = sanitized.viewport;
                setViewport(sanitized.viewport);
                applyVisualTransform();
            }
        } else { initDefault(); }
      } catch (e) { initDefault(); } finally { if (mounted) setIsLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [fileId, fileBlob]);

  const initDefault = () => {
      const vp = { x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 };
      setNodes([{ id: 'root', text: "Ideia Central", x: 0, y: 0, width: 200, height: 80, color: '#a855f7', isRoot: true, fontSize: 18 }]);
      viewportRef.current = vp;
      setViewport(vp);
      applyVisualTransform();
  };

  const handleDownloadJson = () => {
      const data = { nodes, edges, viewport };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.endsWith('.mindmap') ? fileName : `${fileName}.mindmap`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleSaveToDrive = async (folderId?: string) => {
      if (!accessToken) {
          onAuthError?.();
          return;
      }
      setIsSaving(true);
      try {
          const blob = new Blob([JSON.stringify({ nodes, edges, viewport })], { type: 'application/json' });
          const name = fileName.endsWith('.mindmap') ? fileName : `${fileName}.mindmap`;
          
          if (isLocalOnly && folderId) {
              // Primeiro upload para uma pasta específica
              await uploadFileToDrive(accessToken, blob, name, [folderId], 'application/json');
          } else {
              // Atualização de arquivo existente
              await updateDriveFile(accessToken, fileId, blob, 'application/json');
          }
          alert("Sincronizado com sucesso!");
      } catch (e) {
          console.error(e);
          alert("Erro ao salvar no Drive.");
      } finally {
          setIsSaving(false);
          setShowDrivePicker(false);
      }
  };

  const screenToWorld = (sx: number, sy: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const v = viewportRef.current;
    return { x: (sx - rect.left - v.x) / v.zoom, y: (sy - rect.top - v.y) / v.zoom };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const target = e.target as HTMLElement;
    const nodeId = target.closest('[data-node-id]')?.getAttribute('data-node-id');

    if (nodeId && pointersRef.current.size === 1) {
        if (linkingSourceId && linkingSourceId !== nodeId) {
            setEdges(prev => [...prev, { id: `edge-${Date.now()}`, from: linkingSourceId, to: nodeId }]);
            setLinkingSourceId(null);
            return;
        }
        setSelectedNodeId(nodeId);
        setDragNodeId(nodeId);
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            const pos = screenToWorld(e.clientX, e.clientY);
            setDragOffset({ x: pos.x - node.x, y: pos.y - node.y });
        }
        setIsDraggingCanvas(false);
    } else if (pointersRef.current.size === 1) {
        if (!target.closest('.mindmap-toolbar')) {
            setIsDraggingCanvas(true);
            setDragStart({ x: e.clientX, y: e.clientY });
            setSelectedNodeId(null);
            setLinkingSourceId(null);
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(pointersRef.current.values()) as { x: number, y: number }[];
    if (pts.length === 2) {
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (prevPinchDistRef.current) {
            const scaleDiff = dist / prevPinchDistRef.current;
            viewportRef.current.zoom *= scaleDiff;
            applyVisualTransform();
        }
        prevPinchDistRef.current = dist;
        return;
    }
    if (isDraggingCanvas && pts.length === 1) {
        viewportRef.current.x += e.clientX - dragStart.x;
        viewportRef.current.y += e.clientY - dragStart.y;
        applyVisualTransform();
        setDragStart({ x: e.clientX, y: e.clientY });
    }
    if (dragNodeId) {
        const pos = screenToWorld(e.clientX, e.clientY);
        setNodes(prev => prev.map(n => n.id === dragNodeId ? { ...n, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y } : n));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
        setIsDraggingCanvas(false);
        setDragNodeId(null);
        prevPinchDistRef.current = null;
        setViewport({ ...viewportRef.current });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && selectedNodeId) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const base64 = event.target?.result as string;
              setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, imageUrl: base64, height: Math.max(n.height, 120) } : n));
          };
          reader.readAsDataURL(file);
      }
  };

  const updateNodeAttr = (patch: Partial<MindMapNode>) => {
      if (!selectedNodeId) return;
      setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, ...patch } : n));
  };

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

  return (
    <div className="w-full h-full bg-[#000000] relative overflow-hidden flex flex-col font-sans select-none touch-none">
        <div ref={gridLayerRef} className="absolute inset-0 pointer-events-none z-0 transition-colors duration-300" />

        {/* HEADER BAR */}
        <div className="absolute top-4 left-4 z-40 flex items-center gap-3">
            <button onClick={onToggleMenu} className="p-2.5 bg-surface rounded-xl border border-border text-text-sec hover:text-text shadow-lg active:scale-95 transition-all"><Menu size={22} /></button>
            <button 
                onClick={() => setShowRenameModal(true)}
                className="bg-surface px-4 py-1.5 rounded-xl border border-white/5 shadow-md flex items-center gap-2 group hover:border-brand/40 transition-all active:scale-95"
                title="Clique para renomear"
            >
                <span className="font-bold text-sm text-text-sec group-hover:text-text truncate max-w-[150px] md:max-w-xs">{fileName.replace('.mindmap','').replace('.json','')}</span>
                <Edit2 size={12} className="text-text-sec group-hover:text-brand opacity-0 group-hover:opacity-100 transition-all" />
            </button>
            <button onClick={() => { viewportRef.current = {x: window.innerWidth/2, y: window.innerHeight/2, zoom: 1}; applyVisualTransform(); setViewport({...viewportRef.current}); }} className="p-2.5 bg-surface rounded-full border border-border text-text-sec hover:text-brand shadow-md active:scale-95 transition-all"><Target size={18} /></button>
        </div>

        <div className="absolute top-4 right-4 z-40 flex gap-2">
            <button onClick={() => setShowAiSidebar(!showAiSidebar)} className={`p-2.5 rounded-xl border transition-colors shadow-lg active:scale-95 ${showAiSidebar ? 'bg-brand/20 text-brand border-brand/50' : 'bg-surface text-text-sec border-border hover:text-white'}`}><Sparkles size={20} /></button>
            <button 
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand text-bg rounded-xl font-bold hover:brightness-110 shadow-lg active:scale-95 transition-all"
            >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar
            </button>
        </div>

        {/* CANVAS */}
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing relative" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
            <div ref={contentLayerRef} className="w-full h-full transform-gpu origin-top-left will-change-transform pointer-events-none">
                <svg className="absolute top-0 left-0 overflow-visible" style={{ width: 1, height: 1 }}>
                    {edges.map(edge => {
                        const from = nodes.find(n => n.id === edge.from), to = nodes.find(n => n.id === edge.to);
                        if (!from || !to) return null;
                        const sx = from.x + from.width/2, sy = from.y + from.height/2, ex = to.x + to.width/2, ey = to.y + to.height/2;
                        return <path key={edge.id} d={`M ${sx} ${sy} C ${sx + 50} ${sy}, ${ex - 50} ${ey}, ${ex} ${ey}`} stroke={to.color} strokeWidth="2" fill="none" opacity="0.6" />;
                    })}
                </svg>
                {nodes.map(node => (
                    <div
                        key={node.id}
                        data-node-id={node.id}
                        className={`absolute flex flex-col items-center justify-center p-2 bg-surface border-2 transition-all duration-200 pointer-events-auto ${selectedNodeId === node.id ? 'ring-4 ring-brand/30 border-brand z-10' : 'border-border'} ${node.shape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
                        style={{ left: node.x, top: node.y, minWidth: node.width, minHeight: node.height, borderColor: node.color }}
                        onDoubleClick={() => { setEditingNodeId(node.id); setEditText(node.text); }}
                    >
                        {node.imageUrl && <img src={node.imageUrl} className="w-full h-24 object-cover rounded-lg mb-2 pointer-events-none" />}
                        {editingNodeId === node.id ? (
                            <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={() => { setNodes(prev => prev.map(n => n.id === node.id ? { ...n, text: editText } : n)); setEditingNodeId(null); }} className="bg-transparent text-center text-white outline-none resize-none w-full" style={{ fontSize: node.fontSize || 14 }} />
                        ) : <span className="text-center w-full break-words font-medium" style={{ fontSize: node.fontSize || 14 }}>{node.text}</span>}
                    </div>
                ))}
            </div>
        </div>

        {/* TOOLBAR */}
        <div className="mindmap-toolbar absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0d1117]/95 backdrop-blur-md border border-[#30363d] p-1.5 rounded-2xl flex items-center gap-1 shadow-2xl animate-in slide-in-from-bottom-2">
            {!selectedNode ? (
                <>
                    <button onClick={() => { const pos = screenToWorld(window.innerWidth/2, window.innerHeight/2); setNodes(prev => [...prev, { id: `node-${Date.now()}`, text: "Novo Item", x: pos.x, y: pos.y, width: 180, height: 70, color: '#3b82f6', fontSize: 14 }]); }} className="flex items-center gap-2 px-4 py-2.5 bg-brand text-bg rounded-xl font-bold text-sm hover:brightness-110 active:scale-95 transition-all"><PlusCircle size={18}/> Novo Nó</button>
                    <div className="w-px h-6 bg-[#333] mx-2" />
                    <button onClick={() => { viewportRef.current.zoom = Math.min(viewportRef.current.zoom * 1.2, ZOOM_LIMITS.MAX); applyVisualTransform(); setViewport({...viewportRef.current}); }} className="p-2.5 text-white hover:bg-white/5 rounded-xl"><Plus size={18}/></button>
                    <span className="text-[10px] font-mono text-text-sec min-w-[40px] text-center">{Math.round(viewport.zoom * 100)}%</span>
                    <button onClick={() => { viewportRef.current.zoom = Math.max(viewportRef.current.zoom / 1.2, ZOOM_LIMITS.MIN); applyVisualTransform(); setViewport({...viewportRef.current}); }} className="p-2.5 text-white hover:bg-white/5 rounded-xl"><Minus size={18}/></button>
                </>
            ) : (
                <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => setLinkingSourceId(selectedNodeId)} className={`p-2.5 rounded-xl transition-colors ${linkingSourceId === selectedNodeId ? 'bg-brand text-bg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title="Conectar a outro nó"><LinkIcon size={18}/></button>
                    <button onClick={() => updateNodeAttr({ shape: selectedNode.shape === 'circle' ? 'rectangle' : 'circle' })} className="p-2.5 text-gray-400 hover:text-white rounded-xl" title="Trocar Forma"><Square size={18}/></button>
                    <div className="w-px h-6 bg-[#333] mx-1" />
                    <div className="flex items-center bg-black/40 p-1 rounded-xl gap-1">
                        {NODE_COLORS.map(c => (
                            <button key={c} onClick={() => updateNodeAttr({ color: c })} className={`w-5 h-5 rounded-full border border-white/10 transition-transform hover:scale-125 ${selectedNode.color === c ? 'ring-2 ring-white/50' : ''}`} style={{ backgroundColor: c }} />
                        ))}
                    </div>
                    <div className="w-px h-6 bg-[#333] mx-1" />
                    <div className="flex items-center gap-0.5">
                        <button onClick={() => updateNodeAttr({ fontSize: Math.max(8, (selectedNode.fontSize || 14) - 2) })} className="p-2.5 text-gray-400 hover:text-white rounded-xl" title="Diminuir Fonte"><MinusCircle size={18}/></button>
                        <span className="text-[10px] font-bold text-brand w-6 text-center">{selectedNode.fontSize || 14}</span>
                        <button onClick={() => updateNodeAttr({ fontSize: Math.min(36, (selectedNode.fontSize || 14) + 2) })} className="p-2.5 text-gray-400 hover:text-white rounded-xl" title="Aumentar Fonte"><PlusCircle size={18}/></button>
                    </div>
                    <div className="w-px h-6 bg-[#333] mx-1" />
                    <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-gray-400 hover:text-white rounded-xl" title="Adicionar Imagem"><ImageIcon size={18}/></button>
                    <button onClick={() => { setNodes(prev => prev.filter(n => n.id !== selectedNodeId)); setEdges(prev => prev.filter(e => e.from !== selectedNodeId && e.to !== selectedNodeId)); setSelectedNodeId(null); }} className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl ml-1" title="Excluir Nó"><Trash2 size={18}/></button>
                    <button onClick={() => setSelectedNodeId(null)} className="p-2.5 text-gray-500 hover:text-white rounded-xl" title="Fechar Edição"><X size={18}/></button>
                </div>
            )}
        </div>

        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

        {/* MODALS */}
        <MindMapSaveModal 
            isOpen={showSaveModal} 
            onClose={() => setShowSaveModal(false)}
            onDownload={handleDownloadJson}
            onSaveToDrive={() => isLocalOnly ? setShowDrivePicker(true) : handleSaveToDrive()}
            isLocalOnly={isLocalOnly}
        />

        <MindMapRenameModal 
            isOpen={showRenameModal}
            onClose={() => setShowRenameModal(false)}
            currentName={fileName}
            onRename={onRename || (() => {})}
        />

        <DriveFolderPickerModal 
            isOpen={showDrivePicker}
            onClose={() => setShowDrivePicker(false)}
            accessToken={accessToken}
            onSelectFolder={handleSaveToDrive}
        />

        {showAiSidebar && (
            <div className="absolute inset-y-0 right-0 z-50 w-96 bg-[#1e1e1e] border-l border-[#444746] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between p-4 border-b border-[#444746] bg-surface">
                    <h3 className="font-bold text-[#e3e3e3] flex items-center gap-2 text-sm uppercase tracking-widest"><Sparkles size={18} className="text-brand" /> Kalaki</h3>
                    <button onClick={() => setShowAiSidebar(false)} className="text-gray-400 hover:text-white p-1"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <AiChatPanel contextText={JSON.stringify({nodes, edges})} documentName={fileName} fileId={fileId} />
                </div>
            </div>
        )}

        {isLoading && (
            <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center">
                <Loader2 size={48} className="text-brand animate-spin mb-4" />
                <p className="text-white font-bold animate-pulse uppercase tracking-[0.2em]">Higienizando Canvas...</p>
            </div>
        )}
    </div>
  );
};
