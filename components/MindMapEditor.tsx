import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { Icon } from './shared/Icon';
import { updateDriveFile, downloadDriveFile, uploadFileToDrive } from '../services/driveService';
import { MindMapNode, MindMapEdge, MindMapViewport, MindMapData } from '../types';
import { AiChatPanel } from './shared/AiChatPanel';
import { MindMapSaveModal } from './modals/MindMapSaveModal';
import { MindMapRenameModal } from './modals/MindMapRenameModal';
import { DriveFolderPickerModal } from './pdf/modals/DriveFolderPickerModal';
import { useGlobalContext } from '../context/GlobalContext';
import {
  Menu, Edit2, Target, Sparkles, Loader2, Save, PlusCircle,
  Plus, Minus, LinkIcon, Square, MinusCircle, ImageIcon, Trash2, X, Map
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const NODE_COLORS = ['#4ade80', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#ef4444', '#ffffff'];
const SPREAD = 12; // World-space radius for layout

// ─── Layout Algorithm ────────────────────────────────────────────────────────
// Converts 2D node positions → 3D positions using a force-relaxed sphere layout.
// Nodes with existing (x,y) are normalised; depth in tree drives Z.
function compute3DPositions(
  nodes: MindMapNode[],
  edges: MindMapEdge[]
): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>();
  if (!nodes.length) return positions;

  // Build adjacency & depth map (BFS from root)
  const depthMap = new Map<string, number>();
  const root = nodes.find(n => n.isRoot) ?? nodes[0];
  const adj = new Map<string, string[]>();
  nodes.forEach(n => adj.set(n.id, []));
  edges.forEach(e => {
    adj.get(e.from)?.push(e.to);
    adj.get(e.to)?.push(e.from);
  });
  const queue = [root.id];
  depthMap.set(root.id, 0);
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depthMap.get(cur)!;
    for (const nb of (adj.get(cur) ?? [])) {
      if (!depthMap.has(nb)) { depthMap.set(nb, d + 1); queue.push(nb); }
    }
  }
  const maxDepth = Math.max(...depthMap.values(), 1);

  // Normalise existing 2D coords into [-1, 1]
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs) || 1;
  const yMin = Math.min(...ys), yMax = Math.max(...ys) || 1;

  nodes.forEach((n, i) => {
    // Spread X/Y from original 2D layout, normalised
    const nx = xMax === xMin ? 0 : ((n.x - xMin) / (xMax - xMin) * 2 - 1) * SPREAD;
    const ny = yMax === yMin ? 0 : ((n.y - yMin) / (yMax - yMin) * 2 - 1) * SPREAD;
    // Z from tree depth: root at 0, leaves pushed back
    const depth = depthMap.get(n.id) ?? 0;
    const nz = ((depth / maxDepth) * 2 - 1) * SPREAD * 0.6;
    // Add a deterministic jitter per node so siblings don't overlap exactly
    const jitterSeed = (i * 2654435761) >>> 0;
    const jx = ((jitterSeed & 0xff) / 255 - 0.5) * 2.5;
    const jy = (((jitterSeed >> 8) & 0xff) / 255 - 0.5) * 2.5;
    const jz = (((jitterSeed >> 16) & 0xff) / 255 - 0.5) * 2.0;
    positions.set(n.id, new THREE.Vector3(nx + jx, -ny + jy, nz + jz));
  });

  return positions;
}

// ─── Pulsing Energy Edge ──────────────────────────────────────────────────────
interface EdgeProps {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
}

const EnergyEdge: React.FC<EdgeProps> = ({ from, to, color }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const { points, length } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      from.clone(),
      from.clone().lerp(to, 0.33).add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.0
      )),
      from.clone().lerp(to, 0.66).add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.0
      )),
      to.clone(),
    ]);
    const pts = curve.getPoints(60);
    return { points: pts, length: from.distanceTo(to) };
  }, [from, to]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const uvs = new Float32Array(points.length);
    points.forEach((_, i) => { uvs[i] = i / (points.length - 1); });
    geo.setAttribute('uv_along', new THREE.BufferAttribute(uvs, 1));
    return geo;
  }, [points]);

  // Custom shader for the flowing pulse effect
  const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.55 },
    },
    vertexShader: `
      attribute float uv_along;
      varying float vU;
      void main() {
        vU = uv_along;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vU;
      void main() {
        // Travelling pulse
        float pulse = sin(vU * 8.0 - uTime * 3.0) * 0.5 + 0.5;
        float glow = pow(pulse, 3.0) * 0.9 + 0.1;
        float fade = smoothstep(0.0, 0.08, vU) * smoothstep(1.0, 0.92, vU);
        gl_FragColor = vec4(uColor * (0.4 + glow * 0.8), uOpacity * glow * fade);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [color]);

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <line geometry={geometry}>
      <primitive object={shaderMaterial} ref={matRef} attach="material" />
    </line>
  );
};

// ─── Holographic Node Sphere ──────────────────────────────────────────────────
interface NodeProps {
  node: MindMapNode;
  position: THREE.Vector3;
  isSelected: boolean;
  isRoot: boolean;
  isLinkingSource: boolean;
  isEditing: boolean;
  editText: string;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onEditChange: (text: string) => void;
  onEditCommit: () => void;
}

const HoloNode: React.FC<NodeProps> = ({
  node, position, isSelected, isRoot, isLinkingSource,
  isEditing, editText, onSelect, onDoubleClick, onEditChange, onEditCommit
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const baseColor = useMemo(() => new THREE.Color(node.color), [node.color]);
  const radius = isRoot ? 0.55 : 0.38;

  // Animate: idle float + selection pulse
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (meshRef.current) {
      // Glow pulse
      const pulse = Math.sin(t * 1.8 + position.x) * 0.08 + 1.0;
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      const g = Math.sin(t * 2.2 + position.y) * 0.12 + 1.0;
      glowRef.current.scale.setScalar(g * (isSelected ? 1.4 : 1.0));
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        isSelected ? 0.22 : 0.1;
    }
    if (ringRef.current && isSelected) {
      ringRef.current.rotation.z = t * 1.2;
      ringRef.current.rotation.x = Math.sin(t * 0.6) * 0.4;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.3}>
      <group position={position}>
        {/* Outer glow sphere */}
        <mesh ref={glowRef}>
          <sphereGeometry args={[radius * 2.2, 16, 16]} />
          <meshBasicMaterial
            color={baseColor}
            transparent
            opacity={0.1}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Selection orbit ring */}
        {isSelected && (
          <mesh ref={ringRef}>
            <torusGeometry args={[radius * 1.7, 0.025, 8, 64]} />
            <meshBasicMaterial
              color={baseColor}
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        )}

        {/* Core sphere */}
        <mesh
          ref={meshRef}
          onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(node.id); }}
          onDoubleClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onDoubleClick(node.id); }}
        >
          <sphereGeometry args={[radius, 32, 32]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={baseColor}
            emissiveIntensity={isSelected ? 1.6 : 0.8}
            roughness={0.1}
            metalness={0.6}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Linking source indicator */}
        {isLinkingSource && (
          <mesh>
            <sphereGeometry args={[radius * 1.5, 16, 16]} />
            <meshBasicMaterial
              color="#4ade80"
              transparent
              opacity={0.2}
              blending={THREE.AdditiveBlending}
              side={THREE.BackSide}
            />
          </mesh>
        )}

        {/* HTML Label */}
        <Html
          center
          distanceFactor={10}
          position={[0, radius + 0.55, 0]}
          style={{ pointerEvents: isEditing ? 'auto' : 'none', userSelect: 'none' }}
          occlude={false}
        >
          {isEditing ? (
            <textarea
              autoFocus
              value={editText}
              onChange={e => onEditChange(e.target.value)}
              onBlur={onEditCommit}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEditCommit(); } }}
              style={{
                background: 'rgba(0,0,0,0.75)',
                border: `1.5px solid ${node.color}`,
                borderRadius: 8,
                color: '#fff',
                fontSize: node.fontSize ?? 13,
                fontFamily: '"Space Grotesk", sans-serif',
                padding: '6px 10px',
                outline: 'none',
                width: 160,
                minHeight: 40,
                resize: 'none',
                textAlign: 'center',
                backdropFilter: 'blur(8px)',
                boxShadow: `0 0 12px ${node.color}66`,
              }}
            />
          ) : (
            <div
              style={{
                color: '#fff',
                fontSize: node.fontSize ?? (isRoot ? 15 : 12),
                fontFamily: '"Space Grotesk", monospace',
                fontWeight: isRoot ? 700 : 500,
                textAlign: 'center',
                maxWidth: 140,
                wordBreak: 'break-word',
                textShadow: `0 0 8px ${node.color}, 0 0 16px ${node.color}99`,
                letterSpacing: '0.03em',
                background: 'rgba(0,0,0,0.45)',
                padding: '3px 8px',
                borderRadius: 6,
                backdropFilter: 'blur(4px)',
                border: `1px solid ${node.color}44`,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.35,
                pointerEvents: 'none',
              }}
            >
              {node.text}
            </div>
          )}
        </Html>
      </group>
    </Float>
  );
};

// ─── Scene ────────────────────────────────────────────────────────────────────
interface SceneProps {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  linkingSourceId: string | null;
  positions: Map<string, THREE.Vector3>;
  onSelectNode: (id: string) => void;
  onDoubleClickNode: (id: string) => void;
  onEditChange: (text: string) => void;
  onEditCommit: () => void;
  onBackgroundClick: () => void;
  orbitEnabled: boolean;
}

const Scene: React.FC<SceneProps> = ({
  nodes, edges, selectedNodeId, editingNodeId, editText,
  linkingSourceId, positions, onSelectNode, onDoubleClickNode,
  onEditChange, onEditCommit, onBackgroundClick, orbitEnabled,
}) => {
  const { scene } = useThree();

  // Ambient grid / particle haze
  useEffect(() => {
    scene.fog = new THREE.FogExp2(0x000814, 0.028);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 0, 0]} intensity={2.5} color="#4ade80" distance={30} decay={2} />
      <pointLight position={[8, 6, -5]} intensity={1.5} color="#3b82f6" distance={25} decay={2} />
      <pointLight position={[-8, -4, 5]} intensity={1.2} color="#a855f7" distance={25} decay={2} />

      {/* Star field */}
      <Stars radius={60} depth={40} count={3500} factor={3} saturation={0.2} fade speed={0.4} />

      {/* Edges */}
      {edges.map(edge => {
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        const toNode = nodes.find(n => n.id === edge.to);
        if (!fromPos || !toPos || !toNode) return null;
        return (
          <EnergyEdge
            key={edge.id}
            from={fromPos}
            to={toPos}
            color={toNode.color}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        return (
          <HoloNode
            key={node.id}
            node={node}
            position={pos}
            isSelected={selectedNodeId === node.id}
            isRoot={!!node.isRoot}
            isLinkingSource={linkingSourceId === node.id}
            isEditing={editingNodeId === node.id}
            editText={editText}
            onSelect={onSelectNode}
            onDoubleClick={onDoubleClickNode}
            onEditChange={onEditChange}
            onEditCommit={onEditCommit}
          />
        );
      })}

      {/* Background click deselect */}
      <mesh
        position={[0, 0, -30]}
        onClick={onBackgroundClick}
        visible={false}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial />
      </mesh>

      <OrbitControls
        enabled={orbitEnabled}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        dampingFactor={0.08}
        enableDamping
        minDistance={3}
        maxDistance={50}
        makeDefault
      />
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  fileId: string;
  fileName: string;
  fileBlob?: Blob;
  accessToken: string;
  onToggleMenu: () => void;
  onAuthError?: () => void;
  onRename?: (newName: string) => void;
}

export const MindMapEditor: React.FC<Props> = ({
  fileId, fileName, fileBlob, accessToken, onToggleMenu, onAuthError, onRename
}) => {
  const { addNotification } = useGlobalContext();
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [edges, setEdges] = useState<MindMapEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLocalOnly = useMemo(() => fileId.startsWith('local-'), [fileId]);

  // Computed 3D positions, recalculated when topology changes
  const positions = useMemo(() => compute3DPositions(nodes, edges), [nodes, edges]);

  // OrbitControls disabled when editing a node (to avoid camera drift on click)
  const orbitEnabled = !editingNodeId;

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        let blob = fileBlob;
        if (!blob && accessToken && !fileId.startsWith('local-')) {
          blob = await downloadDriveFile(accessToken, fileId);
        }
        if (blob) {
          const data: MindMapData = JSON.parse(await blob.text());
          if (mounted) {
            setNodes(data.nodes || []);
            setEdges(data.edges || []);
          }
        } else {
          initDefault();
        }
      } catch {
        initDefault();
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [fileId, fileBlob]);

  const initDefault = () => {
    setNodes([{
      id: 'root', text: 'Ideia Central',
      x: 0, y: 0, width: 200, height: 80,
      color: '#a855f7', isRoot: true, fontSize: 18
    }]);
    setEdges([]);
  };

  // ── Save / Download ───────────────────────────────────────────────────────
  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.mindmap') ? fileName : `${fileName}.mindmap`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleSaveToDrive = useCallback(async (folderId?: string) => {
    if (!accessToken) { onAuthError?.(); return; }
    setIsSaving(true);
    try {
      const blob = new Blob([JSON.stringify({ nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } })], { type: 'application/json' });
      const name = fileName.endsWith('.mindmap') ? fileName : `${fileName}.mindmap`;
      if (isLocalOnly && folderId) {
        await uploadFileToDrive(accessToken, blob, name, [folderId], 'application/json');
      } else {
        await updateDriveFile(accessToken, fileId, blob, 'application/json');
      }
      addNotification('Sincronizado com sucesso!', 'success');
    } catch {
      addNotification('Erro ao salvar no Drive.', 'error');
    } finally {
      setIsSaving(false);
      setShowDrivePicker(false);
    }
  }, [accessToken, nodes, edges, fileName, fileId, isLocalOnly, onAuthError, addNotification]);

  // ── Node Interaction ──────────────────────────────────────────────────────
  const handleSelectNode = useCallback((id: string) => {
    if (linkingSourceId && linkingSourceId !== id) {
      setEdges(prev => [...prev, { id: `edge-${Date.now()}`, from: linkingSourceId, to: id }]);
      setLinkingSourceId(null);
      setSelectedNodeId(null);
    } else {
      setSelectedNodeId(id);
    }
  }, [linkingSourceId]);

  const handleDoubleClickNode = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setEditingNodeId(id);
    setEditText(node.text);
  }, [nodes]);

  const handleEditCommit = useCallback(() => {
    if (!editingNodeId) return;
    setNodes(prev => prev.map(n => n.id === editingNodeId ? { ...n, text: editText } : n));
    setEditingNodeId(null);
  }, [editingNodeId, editText]);

  const handleBackgroundClick = useCallback(() => {
    if (editingNodeId) { handleEditCommit(); return; }
    setSelectedNodeId(null);
    setLinkingSourceId(null);
  }, [editingNodeId, handleEditCommit]);

  const updateNodeAttr = useCallback((patch: Partial<MindMapNode>) => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, ...patch } : n));
  }, [selectedNodeId]);

  const handleAddNode = () => {
    const id = `node-${Date.now()}`;
    // Spawn near selected node or near origin
    const base = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : nodes[0];
    const x = (base?.x ?? 0) + (Math.random() - 0.5) * 300;
    const y = (base?.y ?? 0) + (Math.random() - 0.5) * 300;
    const newNode: MindMapNode = {
      id, text: 'Novo Nó', x, y, width: 180, height: 70,
      color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
      fontSize: 14,
    };
    setNodes(prev => [...prev, newNode]);
    if (selectedNodeId) {
      setEdges(prev => [...prev, { id: `edge-${Date.now()}`, from: selectedNodeId, to: id }]);
    }
    setSelectedNodeId(id);
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    setEdges(prev => prev.filter(e => e.from !== selectedNodeId && e.to !== selectedNodeId));
    setSelectedNodeId(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedNodeId) {
      const reader = new FileReader();
      reader.onload = ev => {
        const base64 = ev.target?.result as string;
        setNodes(prev => prev.map(n =>
          n.id === selectedNodeId ? { ...n, imageUrl: base64, height: Math.max(n.height, 120) } : n
        ));
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full bg-[#000814] relative overflow-hidden flex flex-col select-none font-sans">

      {/* ── HEADER ── */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-3">
        <button
          onClick={onToggleMenu}
          className="p-2.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-slate-400 hover:text-white shadow-lg active:scale-95 transition-all"
        >
          <Menu size={22} />
        </button>
        <button
          onClick={() => setShowRenameModal(true)}
          className="bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-xl border border-white/10 shadow-md flex items-center gap-2 group hover:border-purple-500/40 transition-all active:scale-95"
        >
          <span className="font-bold text-sm text-slate-400 group-hover:text-white truncate max-w-[150px] md:max-w-xs">
            {fileName.replace('.mindmap', '').replace('.json', '')}
          </span>
          <Edit2 size={12} className="text-slate-500 group-hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-all" />
        </button>

        {/* Linking mode indicator */}
        {linkingSourceId && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/40 rounded-xl text-green-400 text-xs font-bold animate-pulse backdrop-blur-md">
            <LinkIcon size={14} />
            Clique em outro nó para conectar
          </div>
        )}
      </div>

      {/* ── TOP RIGHT ACTIONS ── */}
      <div className="absolute top-4 right-4 z-40 flex gap-2">
        <button
          onClick={() => setShowAiSidebar(!showAiSidebar)}
          className={`p-2.5 rounded-xl border transition-colors shadow-lg active:scale-95 backdrop-blur-md ${showAiSidebar ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'bg-black/60 text-slate-400 border-white/10 hover:text-white'}`}
        >
          <Sparkles size={20} />
        </button>
        <button
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-black rounded-xl font-bold hover:brightness-110 shadow-lg active:scale-95 transition-all text-sm"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Salvar
        </button>
      </div>

      {/* ── 3D CANVAS ── */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 22], fov: 60, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping }}
          dpr={[1, 2]}
        >
          <color attach="background" args={['#000814']} />
          <Suspense fallback={null}>
            <Scene
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              editingNodeId={editingNodeId}
              editText={editText}
              linkingSourceId={linkingSourceId}
              positions={positions}
              onSelectNode={handleSelectNode}
              onDoubleClickNode={handleDoubleClickNode}
              onEditChange={setEditText}
              onEditCommit={handleEditCommit}
              onBackgroundClick={handleBackgroundClick}
              orbitEnabled={orbitEnabled}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-black/70 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl flex items-center gap-1 shadow-2xl animate-in slide-in-from-bottom-2">
        {!selectedNode ? (
          <>
            <button
              onClick={handleAddNode}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-black rounded-xl font-bold text-sm hover:brightness-110 active:scale-95 transition-all"
            >
              <PlusCircle size={18} /> Novo Nó
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
            {/* Connect */}
            <button
              onClick={() => setLinkingSourceId(selectedNodeId)}
              className={`p-2.5 rounded-xl transition-colors ${linkingSourceId === selectedNodeId ? 'bg-green-500 text-black' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
              title="Conectar a outro nó"
            >
              <LinkIcon size={18} />
            </button>

            <button
              onClick={() => updateNodeAttr({ shape: selectedNode.shape === 'circle' ? 'rectangle' : 'circle' })}
              className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="Trocar Forma"
            >
              <Square size={18} />
            </button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* Color palette */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl gap-1">
              {NODE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateNodeAttr({ color: c })}
                  className={`w-5 h-5 rounded-full border border-white/10 transition-transform hover:scale-125 ${selectedNode.color === c ? 'ring-2 ring-white/60' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* Font size */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => updateNodeAttr({ fontSize: Math.max(8, (selectedNode.fontSize || 14) - 2) })}
                className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
              >
                <MinusCircle size={18} />
              </button>
              <span className="text-[10px] font-bold text-green-400 w-6 text-center">{selectedNode.fontSize || 14}</span>
              <button
                onClick={() => updateNodeAttr({ fontSize: Math.min(36, (selectedNode.fontSize || 14) + 2) })}
                className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
              >
                <PlusCircle size={18} />
              </button>
            </div>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
              title="Adicionar Imagem"
            >
              <ImageIcon size={18} />
            </button>

            <button
              onClick={handleAddNode}
              className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
              title="Novo nó conectado"
            >
              <Plus size={18} />
            </button>

            <button
              onClick={handleDeleteNode}
              className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl ml-1 transition-colors"
              title="Excluir Nó"
            >
              <Trash2 size={18} />
            </button>

            <button
              onClick={() => { setSelectedNodeId(null); setLinkingSourceId(null); }}
              className="p-2.5 text-slate-500 hover:text-white rounded-xl hover:bg-white/10"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ── HELP HINT ── */}
      <div className="absolute bottom-6 right-6 z-40 text-[10px] text-slate-600 font-mono text-right leading-relaxed pointer-events-none">
        <p>Arraste para rotacionar · Scroll para zoom</p>
        <p>Clique = selecionar · Duplo clique = editar</p>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

      {/* ── MODALS ── */}
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

      {/* ── AI SIDEBAR ── */}
      {showAiSidebar && (
        <div className="absolute inset-y-0 right-0 z-50 w-96 bg-[#0a0a0f]/95 border-l border-purple-500/20 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 backdrop-blur-xl">
          <div className="flex items-center justify-between p-4 border-b border-purple-500/20">
            <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm uppercase tracking-widest">
              <Sparkles size={18} className="text-purple-400" /> Kalaki
            </h3>
            <button onClick={() => setShowAiSidebar(false)} className="text-slate-500 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AiChatPanel
              contextText={JSON.stringify({ nodes, edges })}
              documentName={fileName}
              fileId={fileId}
            />
          </div>
        </div>
      )}

      {/* ── LOADING OVERLAY ── */}
      {isLoading && (
        <div className="absolute inset-0 z-[60] bg-[#000814] flex flex-col items-center justify-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-2xl animate-pulse" />
            <Loader2 size={48} className="text-purple-400 animate-spin relative z-10" />
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-sm animate-pulse">
            Inicializando Rede Neural...
          </p>
        </div>
      )}
    </div>
  );
};
