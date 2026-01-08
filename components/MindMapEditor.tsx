
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, Minus, Trash2, Type, Menu, Save, Loader2, Link, Download, WifiOff, 
  Undo, Redo, Square, Circle as CircleIcon, StickyNote, 
  Sparkles, Image as ImageIcon, X, Palette, Scaling, ChevronUp,
  ToggleLeft, Hexagon, Edit2, Check
} from 'lucide-react';
import { updateDriveFile, downloadDriveFile } from '../services/driveService';
import { saveOfflineFile } from '../services/storageService';
import { MindMapNode, MindMapEdge, MindMapViewport, MindMapData, NodeShape } from '../types';
import { AiChatPanel } from './shared/AiChatPanel';

// --- Constants & Styles ---
const SHAPES: { id: NodeShape, icon: React.ElementType }[] = [
  { id: 'rectangle', icon: Square },
  { id: 'circle', icon: CircleIcon },
  { id: 'sticky', icon: StickyNote },
  { id: 'pill', icon: ToggleLeft }, 
  { id: 'hexagon', icon: Hexagon }, 
];

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
  '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#1e293b'
];

interface Props {
  fileId: string;
  fileName: string;
  fileBlob?: Blob;
  accessToken: string;
  onToggleMenu: () => void;
  onAuthError?: () => void;
  onRename?: (newName: string) => void; 
}

interface HistoryState {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export const MindMapEditor: React.FC<Props> = ({ fileId, fileName, fileBlob, accessToken, onToggleMenu, onAuthError, onRename }) => {
  const isLocalFile = fileId.startsWith('local-') || !accessToken;

  // --- State ---
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [edges, setEdges] = useState<MindMapEdge[]>([]);
  const [viewport, setViewport] = useState<MindMapViewport>({ x: 0, y: 0, zoom: 1 });
  
  const [historyPast, setHistoryPast] = useState<HistoryState[]>([]);
  const [historyFuture, setHistoryFuture] = useState<HistoryState[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  
  // UI State
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAiSidebar, setShowAiSidebar] = useState(false);

  // Interaction State
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isResizingNode, setIsResizingNode] = useState(false);
  
  // Pointers for Multi-touch
  const pointersRef = useRef<Map<number, { x: number, y: number }>>(new Map());
  const prevPinchDistRef = useRef<number | null>(null);
  const prevPinchCenterRef = useRef<{ x: number, y: number } | null>(null);

  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragSnapshotRef = useRef<HistoryState | null>(null);
  
  // Editing & Linking
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  
  // Renaming State
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState(fileName);

  // Autosave
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Styles Injection ---
  useEffect(() => {
    const styleId = 'mindmap-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            @keyframes grid-drift {
                0% { background-position: 0px 0px; }
                100% { background-position: 40px 40px; }
            }
            .immersive-grid {
                animation: grid-drift 20s linear infinite;
            }
        `;
        document.head.appendChild(style);
    }
  }, []);

  // Sync tempName with fileName prop
  useEffect(() => {
      setTempName(fileName.replace('.mindmap', ''));
  }, [fileName]);

  // --- Initialization ---
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        let blobToRead = fileBlob;

        if (!blobToRead && accessToken && !isLocalFile) {
             try { blobToRead = await downloadDriveFile(accessToken, fileId); } catch (e) { console.error(e); }
        }

        if (blobToRead) {
            const text = await blobToRead.text();
            try {
                const data: MindMapData = JSON.parse(text);
                if (mounted) {
                    setNodes(data.nodes || []);
                    setEdges(data.edges || []);
                    setViewport(data.viewport || { x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 });
                }
            } catch (e) {
                if (mounted) initDefaultMap();
            }
        } else {
             if (mounted) initDefaultMap();
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [fileId, fileBlob]);

  const initDefaultMap = () => {
      // Tamanho padrão aumentado e formato base quadrado
      setNodes([{
        id: `root-${Date.now()}`,
        text: "Ideia Central",
        x: 0, y: 0,
        width: 200, height: 80, 
        color: '#a855f7',
        isRoot: true,
        scale: 1.2,
        fontSize: 24, 
        shape: 'rectangle' // Alterado para rectangle
      }]);
      setViewport({ x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 });
  };

  // --- Autosave ---
  useEffect(() => {
    if (isLoading || nodes.length === 0) return;
    setHasUnsavedChanges(true);
    
    if (!isLocalFile && navigator.onLine) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(saveToDrive, 3000); 
    }
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [nodes, edges, viewport]);

  const saveToDrive = async () => {
      if (!accessToken || isLocalFile) return;
      setIsSaving(true);
      const data: MindMapData = { nodes, edges, viewport };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      try {
          await updateDriveFile(accessToken, fileId, blob, 'application/json');
          setHasUnsavedChanges(false);
      } catch (e: any) {
          console.error("Autosave failed", e);
          if (e.message === "Unauthorized" && onAuthError) onAuthError();
      } finally {
          setIsSaving(false);
      }
  };

  const saveToAppStorage = async () => {
      setIsSaving(true);
      try {
          const data: MindMapData = { nodes, edges, viewport };
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          
          await saveOfflineFile({
              id: fileId,
              name: fileName,
              mimeType: 'application/json',
              size: blob.size.toString(),
              modifiedTime: new Date().toISOString()
          }, blob);
          
          setHasUnsavedChanges(false);
      } catch (e) {
          console.error("Local save failed", e);
          alert("Erro ao salvar localmente.");
      } finally {
          setIsSaving(false);
      }
  };

  const downloadLocal = () => {
      const data: MindMapData = { nodes, edges, viewport };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.endsWith('.mindmap') ? fileName : `${fileName}.mindmap`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleRenameSubmit = () => {
      if (tempName.trim() && tempName !== fileName.replace('.mindmap', '') && onRename) {
          onRename(tempName);
      }
      setIsRenaming(false);
  };

  // --- History ---
  const recordHistory = () => {
    setHistoryPast(prev => [...prev.slice(-49), { nodes: structuredClone(nodes), edges: structuredClone(edges) }]);
    setHistoryFuture([]);
  };

  const undo = () => {
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryFuture(f => [{ nodes: structuredClone(nodes), edges: structuredClone(edges) }, ...f]);
    setHistoryPast(p => p.slice(0, -1));
    setNodes(prev.nodes);
    setEdges(prev.edges);
  };

  const redo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryPast(p => [...p, { nodes: structuredClone(nodes), edges: structuredClone(edges) }]);
    setHistoryFuture(f => f.slice(1));
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  // --- Helpers ---
  const screenToWorld = (sx: number, sy: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (sx - rect.left - viewport.x) / viewport.zoom,
      y: (sy - rect.top - viewport.y) / viewport.zoom
    };
  };

  // --- Interaction Logic ---

  const handlePointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    if (pointersRef.current.size === 1) {
        setIsDraggingCanvas(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        
        if (linkingSourceId) setLinkingSourceId(null);
        setSelectedNodeId(null);
        setShowColorPicker(false);
        setSelectedEdgeId(null);
        // Se clicar fora, tenta salvar edição pendente
        if (editingNodeId) {
            commitEdit(editingNodeId, editText);
        }
    } else {
        setIsDraggingCanvas(false); 
        prevPinchDistRef.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    const pointers = Array.from(pointersRef.current.values()) as { x: number; y: number }[];

    if (pointers.length === 2) {
        const p1 = pointers[0];
        const p2 = pointers[1];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const centerX = (p1.x + p2.x) / 2;
        const centerY = (p1.y + p2.y) / 2;
        
        if (prevPinchDistRef.current && prevPinchCenterRef.current) {
            const rect = containerRef.current!.getBoundingClientRect();
            const scaleDiff = dist / prevPinchDistRef.current;
            const newZoom = Math.min(Math.max(0.1, viewport.zoom * scaleDiff), 5);
            
            const relativeCenterX = centerX - rect.left;
            const relativeCenterY = centerY - rect.top;
            const worldX = (relativeCenterX - viewport.x) / viewport.zoom;
            const worldY = (relativeCenterY - viewport.y) / viewport.zoom;
            const newX = relativeCenterX - (worldX * newZoom);
            const newY = relativeCenterY - (worldY * newZoom);

            setViewport({ x: newX, y: newY, zoom: newZoom });
        }
        prevPinchDistRef.current = dist;
        prevPinchCenterRef.current = { x: centerX, y: centerY };
        return;
    }

    if (isDraggingCanvas && pointersRef.current.size === 1) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
    }

    if (dragNodeId && !isResizingNode) {
        const pos = screenToWorld(e.clientX, e.clientY);
        setNodes(prev => prev.map(n => n.id === dragNodeId ? { ...n, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y } : n));
    }

    if (dragNodeId && isResizingNode) {
        const pos = screenToWorld(e.clientX, e.clientY);
        setNodes(prev => prev.map(n => {
            if (n.id === dragNodeId) {
                const newWidth = Math.max(50, pos.x - n.x);
                const newHeight = Math.max(30, pos.y - n.y);
                return { ...n, width: newWidth, height: newHeight };
            }
            return n;
        }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
        prevPinchDistRef.current = null;
        prevPinchCenterRef.current = null;
    }
    if (dragNodeId && dragSnapshotRef.current) {
        const old = dragSnapshotRef.current.nodes.find(n => n.id === dragNodeId);
        const curr = nodes.find(n => n.id === dragNodeId);
        if (old && curr && (old.x !== curr.x || old.y !== curr.y || old.width !== curr.width || old.height !== curr.height)) {
            recordHistory();
        }
    }
    setIsDraggingCanvas(false);
    setDragNodeId(null);
    setIsResizingNode(false);
    dragSnapshotRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = containerRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - viewport.x) / viewport.zoom;
        const worldY = (mouseY - viewport.y) / viewport.zoom;
        const zoomFactor = 1 - e.deltaY * 0.002;
        const newZoom = Math.min(Math.max(0.1, viewport.zoom * zoomFactor), 5);
        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;
        setViewport({ x: newX, y: newY, zoom: newZoom });
    } else {
        setViewport(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handleNodeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    if (linkingSourceId) {
        completeLinking(id);
        return;
    }
    
    if (selectedNodeId !== id) setShowColorPicker(false);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setDragNodeId(id);
    
    // Se estava editando outro nó, salva
    if (editingNodeId && editingNodeId !== id) {
        commitEdit(editingNodeId, editText);
    }
    
    const pos = screenToWorld(e.clientX, e.clientY);
    const node = nodes.find(n => n.id === id);
    if (node) {
        setDragOffset({ x: pos.x - node.x, y: pos.y - node.y });
        dragSnapshotRef.current = { nodes: structuredClone(nodes), edges: structuredClone(edges) };
    }
  };

  const handleResizeDown = (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      setSelectedNodeId(id);
      setDragNodeId(id);
      setIsResizingNode(true);
      dragSnapshotRef.current = { nodes: structuredClone(nodes), edges: structuredClone(edges) };
  };

  const startLinking = (id: string) => {
      setLinkingSourceId(id);
      setSelectedNodeId(null);
  };

  const completeLinking = (targetId: string) => {
      if (linkingSourceId && linkingSourceId !== targetId) {
          const exists = edges.some(e => (e.from === linkingSourceId && e.to === targetId) || (e.from === targetId && e.to === linkingSourceId));
          if (!exists) {
              recordHistory();
              setEdges(prev => [...prev, { id: `edge-${Date.now()}`, from: linkingSourceId, to: targetId }]);
          }
      }
      setLinkingSourceId(null);
  };

  const commitEdit = (id: string, text: string) => {
      const node = nodes.find(n => n.id === id);
      if (node && node.text !== text) {
          recordHistory();
          setNodes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
      }
      setEditingNodeId(null);
  };

  const createChildNode = (parentId: string) => {
      const parent = nodes.find(n => n.id === parentId);
      if (!parent) return;

      recordHistory();
      const newNodeId = `node-${Date.now()}`;
      
      const siblings = nodes.filter(n => n.parentId === parentId);
      const count = siblings.length;
      const offsetX = 240; 
      const safeY = count === 0 ? 0 : (count * 90) - 45; 

      const newNode: MindMapNode = {
          id: newNodeId,
          text: "Novo Item",
          x: parent.x + offsetX,
          y: parent.y + safeY,
          width: 180, 
          height: 70, 
          color: parent.color, 
          parentId: parent.id,
          scale: 1,
          fontSize: 16, 
          shape: parent.shape || 'rectangle' // Herança de formato
      };

      const newEdge: MindMapEdge = {
          id: `edge-${Date.now()}`,
          from: parent.id,
          to: newNodeId
      };

      setNodes(prev => [...prev, newNode]);
      setEdges(prev => [...prev, newEdge]);
      setSelectedNodeId(newNodeId);
      
      // Atraso para garantir renderização antes de focar
      setTimeout(() => {
          setEditingNodeId(newNodeId);
          setEditText("Novo Item");
      }, 50);
  };

  const deleteSelection = () => {
      recordHistory();
      if (selectedNodeId) {
          const toDel = new Set([selectedNodeId]);
          setNodes(prev => prev.filter(n => !toDel.has(n.id)));
          setEdges(prev => prev.filter(e => !toDel.has(e.from) && !toDel.has(e.to)));
          setSelectedNodeId(null);
      } else if (selectedEdgeId) {
          setEdges(prev => prev.filter(e => e.id !== selectedEdgeId));
          setSelectedEdgeId(null);
      }
  };

  const updateNodeStyle = (updates: Partial<MindMapNode>) => {
      if (!selectedNodeId) return;
      recordHistory();
      setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, ...updates } : n));
  };

  const updateImageScale = (delta: number) => {
      if (!selectedNodeId) return;
      const node = nodes.find(n => n.id === selectedNodeId);
      if (!node) return;

      const currentScale = node.imageScale || 1;
      let newScale = currentScale + delta;
      
      if (newScale < 1) newScale = 1;
      if (newScale > 10) newScale = 10;

      if (newScale === currentScale) return;

      const baseW = node.width / currentScale;
      const baseH = node.height / currentScale;

      const newW = baseW * newScale;
      const newH = baseH * newScale;

      recordHistory();
      setNodes(prev => prev.map(n => n.id === selectedNodeId ? { 
          ...n, 
          imageScale: newScale,
          width: newW,
          height: newH
      } : n));
  };

  const increaseFontSize = () => {
      if (!selectedNodeId) return;
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node) {
          const currentSize = node.fontSize || 14;
          updateNodeStyle({ fontSize: currentSize + 2 });
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && selectedNodeId) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              updateNodeStyle({ 
                  imageUrl: evt.target?.result as string, 
                  height: 150, 
                  width: 150,
                  imageScale: 1
              });
          };
          reader.readAsDataURL(file);
      }
  };

  // --- AI Context Generation ---
  const mapContext = useMemo(() => {
    return `ESTRUTURA DO MAPA MENTAL (JSON):
${JSON.stringify({
    nodes: nodes.map(n => ({ id: n.id, text: n.text, parentId: n.parentId, isRoot: n.isRoot })),
    edges: edges.map(e => ({ from: e.from, to: e.to, label: e.label }))
}, null, 2)}`;
  }, [nodes, edges]);

  // --- Rendering ---
  const renderEdge = (edge: MindMapEdge) => {
      const from = nodes.find(n => n.id === edge.from);
      const to = nodes.find(n => n.id === edge.to);
      if (!from || !to) return null;

      const sx = from.x + from.width / 2;
      const sy = from.y + from.height / 2;
      const ex = to.x + to.width / 2;
      const ey = to.y + to.height / 2;

      const dx = Math.abs(ex - sx);
      const d = `M ${sx} ${sy} C ${sx + 50} ${sy}, ${ex - 50} ${ey}, ${ex} ${ey}`;
      
      const isSelected = selectedEdgeId === edge.id;

      return (
          <g key={edge.id} onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}>
              <path d={d} stroke="transparent" strokeWidth="15" fill="none" className="cursor-pointer" />
              <path 
                d={d} 
                stroke={isSelected ? '#a855f7' : (to.color === '#ffffff' ? '#555' : to.color)} 
                strokeWidth={isSelected ? 4 : 2} 
                fill="none" 
                strokeDasharray={edge.style === 'dashed' ? '5,5' : 'none'}
                className="transition-all duration-300 pointer-events-none"
              />
              {edge.label && (
                  <foreignObject x={(sx+ex)/2 - 40} y={(sy+ey)/2 - 10} width="80" height="20">
                      <div className="bg-bg text-[10px] text-text border border-border rounded px-1 text-center truncate">{edge.label}</div>
                  </foreignObject>
              )}
          </g>
      );
  };

  const renderNode = (node: MindMapNode) => {
      const isSelected = selectedNodeId === node.id;
      const isEditing = editingNodeId === node.id;
      
      let borderRadius = '8px';
      if (node.shape === 'pill') borderRadius = '9999px';
      if (node.shape === 'circle') borderRadius = '50%';
      
      const isSticky = node.shape === 'sticky';
      const bgColor = isSticky ? node.color : 'var(--bg-surface)';
      
      const baseClasses = `absolute flex flex-col items-center justify-center p-2 group transition-shadow duration-200 select-none bg-surface border-2`;
      const selectedClasses = isSelected ? `ring-2 ring-offset-2 ring-offset-black ring-[${node.color}]` : 'hover:shadow-lg border-border';

      return (
          <div
            key={node.id}
            className={`${baseClasses} ${selectedClasses}`}
            style={{
                left: node.x, top: node.y, width: node.width, height: node.height,
                borderRadius,
                borderColor: node.color,
                zIndex: isSelected ? 10 : 1,
                cursor: linkingSourceId ? 'crosshair' : 'grab',
            }}
            onPointerDown={(e) => handleNodeDown(e, node.id)}
            onDoubleClick={(e) => { 
                e.stopPropagation(); 
                setEditingNodeId(node.id); 
                setEditText(node.text); 
            }}
          >
              <div className={`w-full h-full flex flex-col items-center justify-center overflow-hidden`}>
                  {node.imageUrl && <img src={node.imageUrl} className="w-full h-2/3 object-cover rounded-sm mb-1 pointer-events-none" alt="" />}
                  
                  {isEditing ? (
                      <textarea
                        ref={editInputRef}
                        autoFocus
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={() => commitEdit(node.id, editText)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                commitEdit(node.id, editText);
                            }
                            if (e.key === 'Escape') {
                                setEditingNodeId(null);
                            }
                        }}
                        onPointerDown={e => e.stopPropagation()} 
                        className="w-full h-full bg-transparent outline-none text-center resize-none p-1"
                        style={{ color: 'var(--text-main)', fontSize: node.fontSize || 14 }}
                      />
                  ) : (
                      <span className="text-center w-full break-words leading-tight" style={{ color: 'var(--text-main)', fontSize: node.fontSize || 14, fontWeight: node.isRoot ? 'bold' : 'normal' }}>
                          {node.text || (isSticky ? "Nota" : "")}
                      </span>
                  )}
              </div>

              {isSelected && !isDraggingCanvas && node.shape !== 'circle' && (
                  <div 
                    className="absolute bottom-0 right-0 w-6 h-6 flex items-end justify-end p-0.5 cursor-nwse-resize opacity-50 hover:opacity-100 touch-none"
                    onPointerDown={(e) => handleResizeDown(e, node.id)}
                  >
                      <Scaling size={12} className="text-text-sec" />
                  </div>
              )}

              {isSelected && !isEditing && !isDraggingCanvas && !isResizingNode && (
                  <div 
                    className="absolute -top-16 left-1/2 -translate-x-1/2 flex gap-1 bg-[#1e1e1e] border border-[#333] p-1.5 rounded-xl animate-in fade-in zoom-in duration-200"
                    onPointerDown={e => e.stopPropagation()}
                  >
                      <div className="relative">
                          <button 
                            onClick={() => setShowColorPicker(!showColorPicker)} 
                            className="p-1.5 hover:bg-white/10 rounded text-pink-400 relative" 
                            title="Cor"
                          >
                              <Palette size={16}/>
                          </button>
                          
                          {showColorPicker && (
                              <div className="absolute top-full left-0 mt-2 p-2 bg-[#252525] border border-[#444] rounded-lg grid grid-cols-5 gap-2 z-[60] w-[180px]">
                                  {COLORS.map(c => (
                                      <button 
                                        key={c}
                                        onClick={() => { updateNodeStyle({ color: c }); setShowColorPicker(false); }}
                                        className="w-8 h-8 rounded-full border border-white/20 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: c }}
                                      />
                                  ))}
                              </div>
                          )}
                      </div>

                      <button onClick={increaseFontSize} className="p-1.5 hover:bg-white/10 rounded text-white flex items-center gap-0.5" title="Aumentar Fonte">
                          <Type size={16} />
                          <ChevronUp size={10} />
                      </button>

                      <div className="w-px h-4 bg-white/10 self-center mx-0.5"></div>
                      
                      <button onClick={() => createChildNode(node.id)} className="p-1.5 hover:bg-white/10 rounded text-green-400 font-bold" title="Adicionar Filho"><Plus size={18}/></button>
                      <button onClick={startLinking.bind(null, node.id)} className="p-1.5 hover:bg-white/10 rounded text-yellow-400" title="Conectar"><Link size={16}/></button>
                      <div className="w-px h-4 bg-white/10 self-center mx-0.5"></div>
                      <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-white/10 rounded text-blue-400" title="Imagem"><ImageIcon size={16}/></button>
                      
                      {node.imageUrl && (
                          <>
                              <div className="w-px h-4 bg-white/10 self-center mx-0.5"></div>
                              <div className="flex items-center gap-1 bg-white/5 rounded px-1">
                                  <button onClick={() => updateImageScale(-1)} className="p-1 hover:bg-white/10 rounded text-white" title="Reduzir Imagem">
                                      <Minus size={12} />
                                  </button>
                                  <span className="text-[10px] w-8 text-center text-white font-mono">{ (node.imageScale || 1) * 100 }%</span>
                                  <button onClick={() => updateImageScale(1)} className="p-1 hover:bg-white/10 rounded text-white" title="Aumentar Imagem">
                                      <Plus size={12} />
                                  </button>
                              </div>
                          </>
                      )}

                      {!node.isRoot && <button onClick={deleteSelection} className="p-1.5 hover:bg-red-500/20 rounded text-red-400 ml-1" title="Excluir"><Trash2 size={16}/></button>}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="w-full h-full bg-[#000000] relative overflow-hidden flex flex-col font-sans select-none text-text">
        <div className="absolute inset-0 bg-[#050505] z-0" />
        
        {/* Grid de Pontos Brancos Infinito */}
        <div 
            className="absolute inset-0 pointer-events-none z-0"
            style={{
                backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.35) 1.5px, transparent 1.5px)',
                backgroundSize: `${40 * viewport.zoom}px ${40 * viewport.zoom}px`,
                backgroundPosition: `${viewport.x}px ${viewport.y}px`
            }}
        />

        {/* Header Overlay */}
        <div className="absolute top-4 left-4 z-40 flex items-center gap-3 ui-layer">
            <button onClick={onToggleMenu} className="p-2.5 bg-surface rounded-xl border border-border hover:border-brand/50 text-text-sec hover:text-text transition-colors">
                <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-xl border border-white/5">
                {isRenaming ? (
                    <div className="flex items-center gap-2">
                        <input 
                            autoFocus
                            className="bg-transparent border-b border-brand outline-none text-sm font-bold text-white w-40"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); }}
                            onBlur={handleRenameSubmit}
                        />
                        <button onClick={handleRenameSubmit} className="text-brand hover:text-white"><Check size={16} /></button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => onRename && setIsRenaming(true)}>
                        <span className="font-bold text-sm">{fileName.replace('.mindmap','')}</span>
                        {onRename && <Edit2 size={12} className="text-text-sec opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                )}
            </div>
            {(isLocalFile || !navigator.onLine) && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-lg text-xs font-bold">
                    <WifiOff size={14} /> Offline
                </div>
            )}
        </div>

        {/* AI & Save Overlay */}
        <div className="absolute top-4 right-4 z-40 flex gap-2 ui-layer">
            <button onClick={() => setShowAiSidebar(!showAiSidebar)} className={`p-2.5 rounded-xl border transition-colors ${showAiSidebar ? 'bg-brand/20 text-brand border-brand/50' : 'bg-surface text-text-sec border-border hover:text-white'}`} title="Sexta-feira (IA)">
                <Sparkles size={20} />
            </button>
            <button onClick={downloadLocal} className="p-2.5 bg-surface rounded-xl border border-border hover:bg-white/5 text-text transition-colors" title="Exportar Arquivo">
                <Download size={20} />
            </button>
            
            {/* Save Button: Context Aware (Cloud or Local) */}
            <button 
                onClick={isLocalFile ? saveToAppStorage : saveToDrive} 
                className="flex items-center gap-2 px-4 py-2.5 bg-brand text-bg rounded-xl font-bold hover:brightness-110 transition-all"
                title={isLocalFile ? "Salvar no Aplicativo (Local)" : "Salvar no Drive"}
            >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span className="hidden sm:inline">Salvar</span>
            </button>
        </div>

        {/* Main Canvas */}
        <div 
            ref={containerRef}
            className={`w-full h-full touch-none ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-default'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
        >
            <div 
                className="w-full h-full transform-gpu origin-top-left"
                style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
            >
                <svg className="absolute top-0 left-0 overflow-visible" style={{ width: 1, height: 1 }}>
                    {edges.map(renderEdge)}
                    {linkingSourceId && dragStart && (
                        <path 
                            d={`M ${nodes.find(n=>n.id===linkingSourceId)!.x + nodes.find(n=>n.id===linkingSourceId)!.width/2} ${nodes.find(n=>n.id===linkingSourceId)!.y + nodes.find(n=>n.id===linkingSourceId)!.height/2} L ${(dragStart.x - viewport.x)/viewport.zoom} ${(dragStart.y - viewport.y)/viewport.zoom}`}
                            stroke="#a855f7" strokeWidth="2" strokeDasharray="5,5" fill="none"
                        />
                    )}
                </svg>
                {nodes.map(renderNode)}
            </div>
        </div>

        {/* Bottom Toolbar - GitHub Style */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0d1117] border border-[#30363d] p-1.5 rounded-md flex items-center gap-1 shadow-xl ui-layer animate-in slide-in-from-bottom-10">
            <div className="flex gap-1 pr-2 border-r border-[#30363d]">
                <button onClick={undo} disabled={historyPast.length===0} className={`p-2 rounded-md ${historyPast.length ? 'hover:bg-[#21262d] text-[#c9d1d9]' : 'text-zinc-600'}`}><Undo size={20}/></button>
                <button onClick={redo} disabled={historyFuture.length===0} className={`p-2 rounded-md ${historyFuture.length ? 'hover:bg-[#21262d] text-[#c9d1d9]' : 'text-zinc-600'}`}><Redo size={20}/></button>
            </div>
            
            <div className="flex gap-1">
                <button onClick={() => {
                    recordHistory();
                    setNodes(prev => [...prev, {
                        id: `node-${Date.now()}`,
                        text: "Novo Item",
                        x: (window.innerWidth/2 - viewport.x)/viewport.zoom,
                        y: (window.innerHeight/2 - viewport.y)/viewport.zoom,
                        width: 180, height: 70, // Aumentado
                        color: '#a855f7',
                        scale: 1,
                        fontSize: 16,
                        shape: 'rectangle' // Alterado para rectangle
                    }]);
                }} className="p-2 bg-brand text-bg rounded-md hover:brightness-110"><Plus size={22}/></button>
            </div>

            <div className="w-px h-6 bg-[#30363d] mx-1"></div>

            <div className="flex gap-1">
                {SHAPES.map(s => (
                    <button 
                        key={s.id} 
                        onClick={() => selectedNodeId && updateNodeStyle({ shape: s.id })}
                        className={`p-2 rounded-md text-[#c9d1d9] hover:text-white hover:bg-[#21262d] ${selectedNodeId && nodes.find(n => n.id === selectedNodeId)?.shape === s.id ? 'bg-[#21262d] text-brand' : ''}`}
                    >
                        <s.icon size={18} />
                    </button>
                ))}
            </div>
        </div>

        {/* Sidebar Sexta-feira */}
        {showAiSidebar && (
            <div className="absolute inset-y-0 right-0 z-50 w-96 bg-[#1e1e1e] border-l border-[#444746] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between p-4 border-b border-[#444746] bg-surface">
                    <h3 className="font-bold text-[#e3e3e3] flex items-center gap-2 text-sm uppercase tracking-widest">
                        <Sparkles size={18} className="text-brand" />
                        Assistente Gemini
                    </h3>
                    <button onClick={() => setShowAiSidebar(false)} className="text-gray-400 hover:text-white p-1">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">
                    <AiChatPanel 
                        contextText={mapContext} 
                        documentName={fileName} 
                        fileId={fileId}
                    />
                </div>
            </div>
        )}

        {/* Hidden Inputs */}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
    </div>
  );
};
