
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Icon } from './shared/Icon';
import { updateDriveFile, downloadDriveFile, uploadFileToDrive } from '../services/driveService';
import { MindMapNode, MindMapEdge, MindMapViewport, MindMapData } from '../types';
import { AiChatPanel } from './shared/AiChatPanel';
import { MindMapSaveModal } from './modals/MindMapSaveModal';
import { MindMapRenameModal } from './modals/MindMapRenameModal';
import { DriveFolderPickerModal } from './pdf/modals/DriveFolderPickerModal';
import { useGlobalContext } from '../context/GlobalContext';
import { Map as MapIcon, Menu, Edit2, Target, Sparkles, Loader2, Save, PlusCircle, Plus, Minus, LinkIcon, Square, MinusCircle, ImageIcon, Trash2, X } from 'lucide-react';

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
  const { addNotification } = useGlobalContext();
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

  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const focusVisibleIds = useMemo(() => {
    if (!focusedNodeId) return null;
    const ids = new Set<string>([focusedNodeId]);
    edges.filter(e => e.from === focusedNodeId).forEach(e => ids.add(e.to));
    return ids;
  }, [focusedNodeId, edges]);

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
  const starCanvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolbarPosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight - 60 });
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const toolbarDragStartRef = useRef({ x: 0, y: 0 });
  const [isMinimapVisible, setIsMinimapVisible] = useState(true);
  const isMinimapVisibleRef = useRef(true);

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
      if (contentLayerRef.current) {
          contentLayerRef.current.style.transform = `perspective(1800px) rotateX(8deg) translate(${clamped.x}px, ${clamped.y}px) scale(${clamped.zoom})`;
          contentLayerRef.current.style.transformOrigin = 'center top';
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

  useEffect(() => {
    const canvas = starCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const pickStarColor = () => {
      const colors = [
        'rgba(255,255,255,1)',
        'rgba(200,220,255,1)',
        'rgba(255,240,200,1)',
        'rgba(255,200,200,1)',
        'rgba(180,200,255,1)',
        'rgba(200,255,220,1)',
      ];
      return colors[Math.floor(Math.random() * colors.length)];
    };

    const STAR_COUNT = 300;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: Math.random() * 1.6 + 0.2,
      opacity: Math.random() * 0.8 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
      color: pickStarColor(),
    }));

    let frame = 0;
    const animate = () => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Fundo gradiente profundo
      const grad = ctx.createRadialGradient(w*0.4, h*0.3, 0, w*0.5, h*0.5, w*0.9);
      grad.addColorStop(0, '#0d0d1a');
      grad.addColorStop(0.4, '#080818');
      grad.addColorStop(0.7, '#050510');
      grad.addColorStop(1, '#020208');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Nebulosa roxa
      const neb1 = ctx.createRadialGradient(w*0.65, h*0.3, 0, w*0.65, h*0.3, w*0.35);
      neb1.addColorStop(0, 'rgba(80,20,160,0.13)');
      neb1.addColorStop(0.5, 'rgba(20,40,100,0.06)');
      neb1.addColorStop(1, 'transparent');
      ctx.fillStyle = neb1;
      ctx.fillRect(0, 0, w, h);

      // Nebulosa azul
      const neb2 = ctx.createRadialGradient(w*0.2, h*0.7, 0, w*0.2, h*0.7, w*0.28);
      neb2.addColorStop(0, 'rgba(20,80,160,0.11)');
      neb2.addColorStop(1, 'transparent');
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, w, h);

      // Nebulosa verde sutil
      const neb3 = ctx.createRadialGradient(w*0.8, h*0.75, 0, w*0.8, h*0.75, w*0.2);
      neb3.addColorStop(0, 'rgba(20,120,80,0.07)');
      neb3.addColorStop(1, 'transparent');
      ctx.fillStyle = neb3;
      ctx.fillRect(0, 0, w, h);

      // Estrelas
      stars.forEach(star => {
        const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinkleOffset);
        const op = star.opacity * (0.6 + 0.4 * twinkle);
        const r = star.radius * (0.85 + 0.15 * twinkle);
        const sx = star.x * w, sy = star.y * h;

        if (star.radius > 1.2) {
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5);
          glow.addColorStop(0, star.color.replace('1)', `${op * 0.6})`));
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(sx, sy, r * 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = op;
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      frame++;
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
    };
  }, []);

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
          addNotification("Sincronizado com sucesso!", "success");
      } catch (e) {
          console.error(e);
          addNotification("Erro ao salvar no Drive.", "error");
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

    if (focusedNodeId && !nodeId) {
        setFocusedNodeId(null);
    }

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

  const nodeDepthMap = useMemo(() => {
    const depthMap = new Map<string, number>();
    const root = nodes.find(n => n.isRoot) || nodes[0];
    if (!root) return depthMap;

    const queue: Array<{ id: string; depth: number }> = [{ id: root.id, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      depthMap.set(id, depth);
      edges
        .filter(e => e.from === id)
        .forEach(e => queue.push({ id: e.to, depth: depth + 1 }));
    }
    nodes.forEach(n => { if (!depthMap.has(n.id)) depthMap.set(n.id, 1); });
    return depthMap;
  }, [nodes, edges]);

  const maxDepth = useMemo(() =>
    Math.max(1, ...Array.from(nodeDepthMap.values())),
  [nodeDepthMap]);

  const visibleNodes = useMemo(() => {
    const visible = new Set<string>();
    const root = nodes.find(n => n.isRoot) || nodes[0];
    if (!root) return visible;

    const queue = [root.id];
    visible.add(root.id);

    while (queue.length > 0) {
      const id = queue.shift()!;
      const node = nodes.find(n => n.id === id);
      if (node && !node.collapsed) {
        edges.filter(e => e.from === id).forEach(e => {
          visible.add(e.to);
          queue.push(e.to);
        });
      }
    }
    nodes.forEach(n => {
      if (!visible.has(n.id) && !edges.some(e => e.to === n.id)) {
        visible.add(n.id);
      }
    });
    return visible;
  }, [nodes, edges]);

  const childCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    edges.forEach(e => {
      counts.set(e.from, (counts.get(e.from) || 0) + 1);
    });
    return counts;
  }, [edges]);

  const updateMinimap = useCallback(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    // Draw nodes
    const scale = Math.min(w / (AREA_LIMIT * 2), h / (AREA_LIMIT * 2));
    const cx = w / 2, cy = h / 2;
    
    nodes.forEach(n => {
      if (!visibleNodes.has(n.id)) return;
      ctx.fillStyle = n.color;
      ctx.fillRect(cx + n.x * scale, cy + n.y * scale, 4, 4);
    });

    // Draw viewport
    const v = viewportRef.current;
    const vw = (window.innerWidth / v.zoom) * scale;
    const vh = (window.innerHeight / v.zoom) * scale;
    const vx = cx - (v.x * scale) - vw / 2;
    const vy = cy - (v.y * scale) - vh / 2;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeRect(vx, vy, vw, vh);
  }, [nodes, visibleNodes]);

  useEffect(() => {
    updateMinimap();
  }, [nodes, viewport, updateMinimap]);

  const handleToolbarPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingToolbar(true);
    toolbarDragStartRef.current = { x: e.clientX - toolbarPosRef.current.x, y: e.clientY - toolbarPosRef.current.y };
  };

  const handleToolbarPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingToolbar || !toolbarRef.current) return;
    e.stopPropagation();
    let newX = e.clientX - toolbarDragStartRef.current.x;
    let newY = e.clientY - toolbarDragStartRef.current.y;
    toolbarPosRef.current = { x: newX, y: newY };
    toolbarRef.current.style.left = `${newX}px`;
    toolbarRef.current.style.top = `${newY}px`;
    toolbarRef.current.style.transform = `translate(-50%, -50%)`;

    const w = window.innerWidth, h = window.innerHeight;
    const isOverMinimap = newX > w - 250 && newY > h - 150;
    if (isOverMinimap === isMinimapVisibleRef.current) {
        isMinimapVisibleRef.current = !isOverMinimap;
        setIsMinimapVisible(!isOverMinimap);
    }
  };

  const handleToolbarPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingToolbar || !toolbarRef.current) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDraggingToolbar(false);
    
    // Snap magnético (threshold: 80px)
    let newX = toolbarPosRef.current.x;
    let newY = toolbarPosRef.current.y;
    const w = window.innerWidth, h = window.innerHeight;
    const threshold = 80;
    
    if (newX < threshold) newX = 80;
    if (newX > w - threshold) newX = w - 80;
    if (newY < threshold) newY = 80;
    if (newY > h - threshold) newY = h - 80;
    
    toolbarPosRef.current = { x: newX, y: newY };
    toolbarRef.current.style.left = `${newX}px`;
    toolbarRef.current.style.top = `${newY}px`;

    const isOverMinimap = newX > w - 250 && newY > h - 150;
    if (isOverMinimap === isMinimapVisibleRef.current) {
        isMinimapVisibleRef.current = !isOverMinimap;
        setIsMinimapVisible(!isOverMinimap);
    }
  };

  return (
    <div className="w-full h-full bg-[#000000] relative overflow-hidden flex flex-col font-sans select-none touch-none">
        <canvas ref={starCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-280 z-0 ${focusedNodeId ? 'bg-black/45 opacity-100' : 'opacity-0'}`} />

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
            <div ref={contentLayerRef} className="w-full h-full transform-gpu will-change-transform pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
                <svg className="absolute top-0 left-0 overflow-visible" style={{ width: 1, height: 1 }}>
                  <defs>
                    {edges.map(edge => {
                      const from = nodes.find(n => n.id === edge.from);
                      const to = nodes.find(n => n.id === edge.to);
                      if (!from || !to) return null;
                      return (
                        <linearGradient key={`grad-${edge.id}`} id={`grad-${edge.id}`} gradientUnits="userSpaceOnUse"
                          x1={from.x + from.width/2} y1={from.y + from.height/2}
                          x2={to.x + to.width/2} y2={to.y + to.height/2}>
                          <stop offset="0%" stopColor={from.color} stopOpacity="0.9" />
                          <stop offset="100%" stopColor={to.color} stopOpacity="0.4" />
                        </linearGradient>
                      );
                    })}
                    {/* filtro de brilho suave nas arestas */}
                    <filter id="edge-glow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  {edges.map(edge => {
                    const from = nodes.find(n => n.id === edge.from);
                    const to = nodes.find(n => n.id === edge.to);
                    if (!from || !to) return null;
                    
                    const isVisible = visibleNodes.has(to.id);
                    const sx = from.x + from.width/2, sy = from.y + from.height/2;
                    const ex = to.x + to.width/2, ey = to.y + to.height/2;
                    const depth = nodeDepthMap.get(to.id) ?? 1;
                    const strokeW = Math.max(1, 2.5 - depth * 0.4);
                    
                    return (
                      <path
                        key={edge.id}
                        d={`M ${sx} ${sy} C ${sx + (ex-sx)*0.5} ${sy}, ${sx + (ex-sx)*0.5} ${ey}, ${ex} ${ey}`}
                        stroke={`url(#grad-${edge.id})`}
                        strokeWidth={strokeW}
                        fill="none"
                        filter="url(#edge-glow)"
                        className="transition-opacity duration-280"
                        style={{ opacity: isVisible ? 1 : 0 }}
                        ref={el => {
                          if (el && !el.style.strokeDasharray) {
                            const len = el.getTotalLength();
                            el.style.strokeDasharray = `${len}`;
                            el.style.strokeDashoffset = `${len}`;
                            el.style.animation = `flowLine ${Math.max(1, len / 150)}s linear infinite`;
                          }
                        }}
                      />
                    );
                  })}
                </svg>
                {nodes.map(node => {
                    if (!visibleNodes.has(node.id)) return null;
                    const isFocused = focusedNodeId ? focusVisibleIds?.has(node.id) : true;
                    const childCount = childCountMap.get(node.id) || 0;
                    const computedWidth = Math.max(node.width, Math.min(280, 180 + childCount * 8));
                    const depth = nodeDepthMap.get(node.id) ?? 1;
                    const hasChildren = childCount > 0;

                    return (
                    <div
                        key={node.id}
                        data-node-id={node.id}
                        className={`absolute flex flex-col items-center justify-center p-2 border-2 transition-all duration-280 pointer-events-auto group ${selectedNodeId === node.id ? 'ring-4 ring-brand/30 border-brand z-10' : 'border-border'} ${node.shape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
                        style={{
                          left: node.x,
                          top: node.y,
                          minWidth: computedWidth,
                          minHeight: node.height,
                          borderColor: node.color,
                          opacity: isFocused ? 1 : 0.08,
                          pointerEvents: isFocused ? 'auto' : 'none',
                          transform: `translateZ(${Math.max(0, (maxDepth - depth) * 18)}px)`,
                          backgroundColor: `color-mix(in srgb, ${node.color} ${Math.max(8, 18 - depth * 3)}%, #0d1117 90%)`,
                          boxShadow: selectedNodeId === node.id
                            ? `0 0 0 2px ${node.color}40, 0 ${8 + (maxDepth - depth) * 4}px ${20 + (maxDepth - depth) * 6}px ${node.color}50`
                            : `0 0 ${Math.min(12, childCount * 2)}px ${node.color}40, 0 ${4 + (maxDepth - depth) * 3}px ${12 + (maxDepth - depth) * 4}px rgba(0,0,0,0.6)`,
                        }}
                        onDoubleClick={() => { 
                            if (focusedNodeId === node.id) setFocusedNodeId(null);
                            else setFocusedNodeId(node.id);
                        }}
                    >
                        {node.imageUrl && <img src={node.imageUrl} className="w-full h-24 object-cover rounded-lg mb-2 pointer-events-none" />}
                        {editingNodeId === node.id ? (
                            <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={() => { setNodes(prev => prev.map(n => n.id === node.id ? { ...n, text: editText } : n)); setEditingNodeId(null); }} className="bg-transparent text-center text-white outline-none resize-none w-full" style={{ fontSize: node.fontSize || 14 }} />
                        ) : <span className="text-center w-full break-words font-medium" style={{ fontSize: node.fontSize || 14 }}>{node.text}</span>}
                        
                        {hasChildren && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setNodes(prev => prev.map(n => n.id === node.id ? { ...n, collapsed: !n.collapsed } : n)); }}
                                className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#1e1e1e] border border-[#444746] rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-[#333]"
                            >
                                {node.collapsed ? <Plus size={14} className="text-white" /> : <Minus size={14} className="text-white" />}
                            </button>
                        )}
                        {node.collapsed && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_10px_#fff] animate-pulse pointer-events-none" />
                        )}
                    </div>
                )})}
            </div>
        </div>

        {/* TOOLBAR */}
        <div 
            ref={toolbarRef}
            onPointerDown={handleToolbarPointerDown}
            onPointerMove={handleToolbarPointerMove}
            onPointerUp={handleToolbarPointerUp}
            onPointerCancel={handleToolbarPointerUp}
            className="mindmap-toolbar absolute z-40 bg-white/5 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl flex items-center gap-1 shadow-2xl cursor-move touch-none"
            style={{ left: toolbarPosRef.current.x, top: toolbarPosRef.current.y, transform: 'translate(-50%, -50%)' }}
        >
            {/* zoom sempre visível — independente de seleção */}
            <button
              onClick={() => { viewportRef.current.zoom = Math.min(viewportRef.current.zoom * 1.2, ZOOM_LIMITS.MAX); applyVisualTransform(); setViewport({...viewportRef.current}); }}
              className="p-2.5 text-white hover:bg-white/5 rounded-xl"
            ><Plus size={18}/></button>
            <span className="text-[10px] font-mono text-text-sec min-w-[40px] text-center">{Math.round(viewport.zoom * 100)}%</span>
            <button
              onClick={() => { viewportRef.current.zoom = Math.max(viewportRef.current.zoom / 1.2, ZOOM_LIMITS.MIN); applyVisualTransform(); setViewport({...viewportRef.current}); }}
              className="p-2.5 text-white hover:bg-white/5 rounded-xl"
            ><Minus size={18}/></button>

            {!selectedNode ? (
                <>
                    <div className="w-px h-6 bg-[#333] mx-2" />
                    <button
                      onClick={() => { const pos = screenToWorld(window.innerWidth/2, window.innerHeight/2); setNodes(prev => [...prev, { id: `node-${Date.now()}`, text: "Novo Item", x: pos.x, y: pos.y, width: 180, height: 70, color: '#3b82f6', fontSize: 14 }]); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-brand text-bg rounded-xl font-bold text-sm hover:brightness-110 active:scale-95 transition-all animate-pulse-emerald"
                    ><PlusCircle size={18}/> Novo Nó</button>
                </>
            ) : (
                <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-px h-6 bg-[#333] mx-1" />
                    <button onClick={() => { setEditingNodeId(selectedNodeId); setEditText(selectedNode.text); }} className="p-2.5 text-gray-400 hover:text-white rounded-xl" title="Editar Texto"><Edit2 size={18}/></button>
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

        {/* MINIMAP */}
        <div className={`absolute bottom-4 right-4 z-30 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-xl pointer-events-none transition-opacity duration-200 ${isMinimapVisible ? 'opacity-100' : 'opacity-0'}`}>
            <canvas ref={minimapCanvasRef} width={160} height={90} className="block" />
        </div>

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
