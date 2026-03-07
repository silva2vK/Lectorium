import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { updateDriveFile, downloadDriveFile, uploadFileToDrive } from '../services/driveService';
import { MindMapNode, MindMapEdge, MindMapData } from '../types';
import { AiChatPanel } from './shared/AiChatPanel';
import { MindMapSaveModal } from './modals/MindMapSaveModal';
import { MindMapRenameModal } from './modals/MindMapRenameModal';
import { DriveFolderPickerModal } from './pdf/modals/DriveFolderPickerModal';
import { useGlobalContext } from '../context/GlobalContext';
import { Menu, Target, Sparkles, Loader2, Save, PlusCircle, LinkIcon, ImageIcon, Trash2, X } from 'lucide-react';

interface Props {
  fileId: string;
  fileName: string;
  fileBlob?: Blob;
  accessToken: string;
  onToggleMenu: () => void;
  onAuthError?: () => void;
  onRename?: (newName: string) => void;
}

// --- PEÇA 1: compute3DPositions ---
function compute3DPositions(nodes: MindMapNode[], edges: MindMapEdge[]): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>();
  if (nodes.length === 0) return positions;

  const SPREAD = 12;
  const rootNode = nodes.find(n => n.isRoot) || nodes[0];
  
  // BFS para calcular profundidade
  const depths = new Map<string, number>();
  const queue: { id: string, d: number }[] = [{ id: rootNode.id, d: 0 }];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const { id, d } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    depths.set(id, d);
    
    // Encontrar filhos
    const childrenIds = edges.filter(e => e.from === id).map(e => e.to);
    for (const childId of childrenIds) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, d: d + 1 });
      }
    }
  }
  
  // Nós não conectados ganham profundidade 0
  for (const node of nodes) {
    if (!depths.has(node.id)) depths.set(node.id, 0);
  }
  
  const maxDepth = Math.max(1, ...Array.from(depths.values()));
  
  // Encontrar limites 2D para normalizar
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }
  
  const rangeX = Math.max(1, maxX - minX);
  const rangeY = Math.max(1, maxY - minY);
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const depth = depths.get(node.id) || 0;
    
    // Normalizar X e Y para [-SPREAD, SPREAD]
    // Inverter Y pois no canvas 2D o Y cresce para baixo, no 3D cresce para cima
    const nx = ((node.x - minX) / rangeX) * (SPREAD * 2) - SPREAD;
    const ny = -(((node.y - minY) / rangeY) * (SPREAD * 2) - SPREAD);
    
    // Z baseado na profundidade (raiz na frente, folhas no fundo)
    const nz = ((depth / maxDepth) * 2 - 1) * SPREAD * 0.6;
    
    // Jitter determinístico
    const seed = (i * 137) ^ (i << 4);
    const jitterX = ((seed % 100) / 100) * 0.5 - 0.25;
    const jitterY = (((seed >> 2) % 100) / 100) * 0.5 - 0.25;
    
    positions.set(node.id, new THREE.Vector3(nx + jitterX, ny + jitterY, nz));
  }
  
  return positions;
}

// --- PEÇA 2: EnergyEdge ---
const EnergyEdge = ({ fromPos, toPos, color, fromIndex, toIndex }: { fromPos: THREE.Vector3, toPos: THREE.Vector3, color: string, fromIndex: number, toIndex: number }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const curve = useMemo(() => {
    const mid1 = new THREE.Vector3().lerpVectors(fromPos, toPos, 0.33);
    const mid2 = new THREE.Vector3().lerpVectors(fromPos, toPos, 0.66);
    
    // Offset determinístico
    const offset1 = ((fromIndex + toIndex) % 5) * 0.2 - 0.4;
    const offset2 = ((fromIndex * toIndex) % 5) * 0.2 - 0.4;
    
    mid1.y += offset1;
    mid2.x += offset2;
    
    return new THREE.CatmullRomCurve3([fromPos, mid1, mid2, toPos]);
  }, [fromPos, toPos, fromIndex, toIndex]);
  
  const geometry = useMemo(() => {
    const points = curve.getPoints(60);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    
    // Adicionar atributo U para o shader
    const uvs = new Float32Array(points.length);
    for (let i = 0; i < points.length; i++) {
      uvs[i] = i / (points.length - 1);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 1));
    return geo;
  }, [curve]);
  
  const shaderMaterial = useMemo(() => {
    const threeColor = new THREE.Color(color);
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: threeColor }
      },
      vertexShader: `
        varying float vU;
        void main() {
          vU = uv.x;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying float vU;
        void main() {
          float pulse = sin(vU * 8.0 - uTime * 3.0) * 0.5 + 0.5;
          float edgeFade = smoothstep(0.0, 0.1, vU) * smoothstep(1.0, 0.9, vU);
          gl_FragColor = vec4(uColor * (0.5 + pulse * 0.8), pulse * edgeFade * 0.8);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }, [color]);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });
  
  return (
    <line geometry={geometry}>
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </line>
  );
};

// --- PEÇA 3: HoloNode ---
const HoloNode = ({ 
  node, position, isSelected, isRoot, isLinkingSource, 
  isEditing, editText, onSelect, onDoubleClick, onEditChange, onEditCommit 
}: any) => {
  const coreRef = useRef<THREE.Mesh>(null);
  const radius = isRoot ? 0.55 : 0.38;
  const color = node.color || '#4ade80';
  
  useFrame((state) => {
    if (coreRef.current) {
      const scale = Math.sin(state.clock.elapsedTime * 1.8 + position.x) * 0.08 + 1.0;
      coreRef.current.scale.set(scale, scale, scale);
    }
  });
  
  return (
    <Float speed={1.2} floatIntensity={0.3} position={position}>
      <group>
        {/* Glow externo */}
        <mesh>
          <sphereGeometry args={[radius * 2.2, 32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        
        {/* Anel orbital (selecionado ou linking) */}
        {(isSelected || isLinkingSource) && (
          <mesh rotation-x={Math.PI / 2}>
            <torusGeometry args={[radius * 1.5, 0.02, 16, 64]} />
            <meshBasicMaterial color={isLinkingSource ? '#f97316' : color} transparent opacity={0.8} blending={THREE.AdditiveBlending} />
          </mesh>
        )}
        
        {/* Core */}
        <mesh 
          ref={coreRef}
          onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
          onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node.id); }}
        >
          <sphereGeometry args={[radius, 32, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isSelected ? 1.6 : 0.8} />
        </mesh>
        
        {/* Label HTML */}
        <Html position={[0, radius + 0.5, 0]} center distanceFactor={10} occlude={false}>
          {isEditing ? (
            <textarea
              autoFocus
              value={editText}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={onEditCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onEditCommit();
                }
              }}
              className="bg-black/80 text-white border border-white/30 rounded p-2 text-sm font-mono outline-none min-w-[150px] resize-none"
              style={{ pointerEvents: 'auto' }}
              rows={3}
            />
          ) : (
            <div 
              className="text-white font-mono text-sm whitespace-pre-wrap text-center cursor-pointer max-w-[200px]"
              style={{ 
                textShadow: `0 0 8px ${color}, 0 0 12px ${color}`,
                pointerEvents: 'none'
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

// --- PEÇA 4: Scene ---
const Scene = ({ 
  nodes, edges, positions, selectedNodeId, editingNodeId, editText, linkingSourceId,
  onSelect, onDoubleClick, onEditChange, onEditCommit, onBackgroundClick, orbitEnabled
}: any) => {
  useEffect(() => {
    // Acessar a cena global via useThree não é estritamente necessário se usarmos color attach="background" e fog attach="fog" no Canvas
    // Mas para garantir a cor exata do fog:
  }, []);

  return (
    <>
      <fog attach="fog" args={[0x000814, 0.028]} />
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 0, 0]} color="#4ade80" intensity={2.5} />
      <pointLight position={[8, 6, -5]} color="#3b82f6" intensity={1.5} />
      <pointLight position={[-8, -4, 5]} color="#a855f7" intensity={1.2} />
      
      <Stars radius={60} count={3500} factor={3} fade speed={0.4} />
      
      {edges.map((edge: MindMapEdge, i: number) => {
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        const toNode = nodes.find((n: MindMapNode) => n.id === edge.to);
        
        if (!fromPos || !toPos || !toNode) return null;
        
        const fromIndex = nodes.findIndex((n: MindMapNode) => n.id === edge.from);
        const toIndex = nodes.findIndex((n: MindMapNode) => n.id === edge.to);
        
        return (
          <EnergyEdge 
            key={edge.id} 
            fromPos={fromPos} 
            toPos={toPos} 
            color={toNode.color || '#4ade80'} 
            fromIndex={fromIndex}
            toIndex={toIndex}
          />
        );
      })}
      
      {nodes.map((node: MindMapNode) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        
        return (
          <HoloNode
            key={node.id}
            node={node}
            position={pos}
            isSelected={selectedNodeId === node.id}
            isRoot={node.isRoot}
            isLinkingSource={linkingSourceId === node.id}
            isEditing={editingNodeId === node.id}
            editText={editText}
            onSelect={onSelect}
            onDoubleClick={onDoubleClick}
            onEditChange={onEditChange}
            onEditCommit={onEditCommit}
          />
        );
      })}
      
      {/* Background click plane */}
      <mesh position={[0, 0, -30]} visible={false} onClick={(e) => { e.stopPropagation(); onBackgroundClick(); }}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial />
      </mesh>
      
      <OrbitControls 
        enabled={orbitEnabled} 
        enableDamping 
        dampingFactor={0.08} 
        minDistance={3} 
        maxDistance={50} 
        makeDefault 
      />
    </>
  );
};

// --- PEÇA 5: MindMapEditor ---
export const MindMapEditor: React.FC<Props> = ({ fileId, fileName, fileBlob, accessToken, onToggleMenu, onAuthError, onRename }) => {
  const { addNotification } = useGlobalContext();
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [edges, setEdges] = useState<MindMapEdge[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLocalOnly = useMemo(() => fileId.startsWith('local-'), [fileId]);

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
                setNodes(data.nodes || []);
                setEdges(data.edges || []);
            }
        } else {
            initDefault();
        }
      } catch (err) {
        console.error("Erro ao carregar mapa mental:", err);
        if (mounted) {
            addNotification("Erro ao carregar mapa mental.", "error");
            initDefault();
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [fileId, fileBlob, accessToken, addNotification]);

  const initDefault = () => {
    setNodes([{ id: 'root', text: 'Ideia Central', x: window.innerWidth / 2, y: window.innerHeight / 2, color: '#4ade80', isRoot: true }]);
    setEdges([]);
  };

  const saveMap = async (targetFolderId?: string) => {
    if (isLocalOnly && !targetFolderId) {
        setShowDrivePicker(true);
        return;
    }
    
    setIsSaving(true);
    try {
        const dataToSave: MindMapData = {
            nodes,
            edges,
            viewport: { x: 0, y: 0, zoom: 1 } // Fixo para compatibilidade
        };
        const blob = new Blob([JSON.stringify(dataToSave)], { type: 'application/json' });
        
        if (isLocalOnly && targetFolderId) {
            await uploadFileToDrive(accessToken, blob, fileName, targetFolderId);
            addNotification("Mapa salvo no Drive com sucesso!", "success");
            setShowDrivePicker(false);
        } else if (!isLocalOnly) {
            await updateDriveFile(accessToken, fileId, blob);
            addNotification("Mapa salvo com sucesso!", "success");
        }
    } catch (err: any) {
        console.error("Erro ao salvar:", err);
        if (err.message?.includes('401')) {
            onAuthError?.();
        } else {
            addNotification("Erro ao salvar o mapa.", "error");
        }
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddNode = () => {
    const newNodeId = `node-${Date.now()}`;
    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    
    const baseNode = selectedNode || nodes[0];
    const offset = 150;
    
    const newNode: MindMapNode = {
      id: newNodeId,
      text: 'Novo Nó',
      x: baseNode ? baseNode.x + offset : window.innerWidth / 2,
      y: baseNode ? baseNode.y + offset : window.innerHeight / 2,
      color: baseNode?.color || '#3b82f6'
    };
    
    setNodes(prev => [...prev, newNode]);
    
    if (selectedNodeId) {
      setEdges(prev => [...prev, { id: `edge-${Date.now()}`, from: selectedNodeId, to: newNodeId }]);
    }
    
    setSelectedNodeId(newNodeId);
    setEditingNodeId(newNodeId);
    setEditText('Novo Nó');
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    const nodeToDelete = nodes.find(n => n.id === selectedNodeId);
    if (nodeToDelete?.isRoot) {
        addNotification("Não é possível excluir o nó raiz.", "warning");
        return;
    }
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    setEdges(prev => prev.filter(e => e.from !== selectedNodeId && e.to !== selectedNodeId));
    setSelectedNodeId(null);
  };

  const handleSelectNode = (id: string) => {
    if (linkingSourceId && linkingSourceId !== id) {
      const edgeExists = edges.some(e => (e.from === linkingSourceId && e.to === id) || (e.from === id && e.to === linkingSourceId));
      if (!edgeExists) {
        setEdges(prev => [...prev, { id: `edge-${Date.now()}`, from: linkingSourceId, to: id }]);
      }
      setLinkingSourceId(null);
    } else {
      setSelectedNodeId(id);
    }
  };

  const handleDoubleClick = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (node) {
      setEditingNodeId(id);
      setEditText(node.text);
      setSelectedNodeId(id);
    }
  };

  const handleEditCommit = () => {
    if (!editingNodeId) return;
    setNodes(prev => prev.map(n => n.id === editingNodeId ? { ...n, text: editText } : n));
    setEditingNodeId(null);
  };

  const handleChangeColor = (color: string) => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, color } : n));
  };

  const handleImageUpload = () => {
    addNotification("Imagens serão exibidas na próxima versão 3D.", "info");
  };

  const positions = useMemo(() => compute3DPositions(nodes, edges), [nodes, edges]);
  const orbitEnabled = !editingNodeId;

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#000814]">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center space-x-4 pointer-events-auto">
          <button onClick={onToggleMenu} className="p-2 bg-black/70 backdrop-blur-xl text-white rounded hover:bg-white/10 border border-white/10 transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center space-x-2">
            <span className="text-white font-medium bg-black/70 backdrop-blur-xl px-3 py-1.5 rounded border border-white/10">{fileName}</span>
            {linkingSourceId && (
              <span className="text-orange-400 text-sm font-mono animate-pulse bg-black/70 backdrop-blur-xl px-3 py-1.5 rounded border border-orange-500/30 flex items-center">
                <LinkIcon size={14} className="mr-2" /> Selecione o destino
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 pointer-events-auto">
          <button onClick={() => setShowAiSidebar(!showAiSidebar)} className={`p-2 rounded flex items-center space-x-2 border transition-colors ${showAiSidebar ? 'bg-purple-600/20 text-purple-400 border-purple-500/50' : 'bg-black/70 backdrop-blur-xl text-white hover:bg-white/10 border-white/10'}`}>
            <Sparkles size={18} />
            <span className="text-sm font-medium hidden sm:inline">Kalaki</span>
          </button>
          <button onClick={() => saveMap()} disabled={isSaving} className="p-2 bg-black/70 backdrop-blur-xl text-white rounded hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50 flex items-center space-x-2">
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span className="text-sm font-medium hidden sm:inline">Salvar</span>
          </button>
        </div>
      </div>

      {/* 3D Canvas Container */}
      <div className="absolute inset-0">
        <Canvas 
          camera={{ position: [0, 0, 22], fov: 60 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          dpr={[1, 2]}
        >
          <color attach="background" args={['#000814']} />
          <Suspense fallback={null}>
            <Scene 
              nodes={nodes}
              edges={edges}
              positions={positions}
              selectedNodeId={selectedNodeId}
              editingNodeId={editingNodeId}
              editText={editText}
              linkingSourceId={linkingSourceId}
              onSelect={handleSelectNode}
              onDoubleClick={handleDoubleClick}
              onEditChange={setEditText}
              onEditCommit={handleEditCommit}
              onBackgroundClick={() => {
                if (!editingNodeId) {
                  setSelectedNodeId(null);
                  setLinkingSourceId(null);
                }
              }}
              orbitEnabled={orbitEnabled}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Toolbar */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 p-2 bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl z-10">
        <button onClick={handleAddNode} className="p-2 text-white hover:bg-white/10 rounded transition-colors" title="Adicionar Nó">
          <PlusCircle size={20} />
        </button>
        
        <div className="w-px h-6 bg-white/20 mx-1" />
        
        <button 
          onClick={() => {
            if (selectedNodeId) {
              setLinkingSourceId(linkingSourceId === selectedNodeId ? null : selectedNodeId);
            }
          }} 
          disabled={!selectedNodeId}
          className={`p-2 rounded transition-colors ${linkingSourceId ? 'bg-orange-500/20 text-orange-400' : 'text-white hover:bg-white/10'} disabled:opacity-30`}
          title="Conectar Nós"
        >
          <LinkIcon size={20} />
        </button>
        
        <button onClick={handleImageUpload} disabled={!selectedNodeId} className="p-2 text-white hover:bg-white/10 rounded transition-colors disabled:opacity-30" title="Adicionar Imagem">
          <ImageIcon size={20} />
        </button>
        
        <div className="w-px h-6 bg-white/20 mx-1" />
        
        <div className="flex space-x-1 px-2">
          {['#4ade80', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#ef4444', '#ffffff'].map(c => (
            <button
              key={c}
              onClick={() => handleChangeColor(c)}
              disabled={!selectedNodeId}
              className="w-6 h-6 rounded-full border border-white/20 disabled:opacity-30 transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        
        <div className="w-px h-6 bg-white/20 mx-1" />
        
        <button onClick={handleDeleteNode} disabled={!selectedNodeId} className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-30" title="Excluir Nó">
          <Trash2 size={20} />
        </button>
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 right-4 text-white/40 text-xs font-mono z-10 pointer-events-none">
        Arraste para rotacionar · Scroll para zoom
      </div>

      <input type="file" hidden ref={fileInputRef} />

      {/* Modals & Overlays */}
      {showSaveModal && <MindMapSaveModal onSave={(name) => { onRename?.(name); saveMap(); setShowSaveModal(false); }} onClose={() => setShowSaveModal(false)} currentName={fileName} />}
      {showRenameModal && <MindMapRenameModal onRename={(name) => { onRename?.(name); setShowRenameModal(false); }} onClose={() => setShowRenameModal(false)} currentName={fileName} />}
      {showDrivePicker && <DriveFolderPickerModal accessToken={accessToken} onFolderSelected={(folderId) => saveMap(folderId)} onClose={() => setShowDrivePicker(false)} />}
      
      {showAiSidebar && (
        <div className="absolute top-0 right-0 w-96 h-full bg-black/90 backdrop-blur-xl border-l border-white/10 z-20 flex flex-col shadow-2xl">
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-white font-medium flex items-center"><Sparkles size={16} className="mr-2 text-purple-400" /> Kalaki AI</h3>
            <button onClick={() => setShowAiSidebar(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AiChatPanel 
              fileId={fileId} 
              accessToken={accessToken} 
              contextData={JSON.stringify({ nodes, edges })} 
              onApplySuggestion={(suggestion) => {
                try {
                  const parsed = JSON.parse(suggestion);
                  if (parsed.nodes && parsed.edges) {
                    setNodes(parsed.nodes);
                    setEdges(parsed.edges);
                    addNotification("Mapa atualizado pela IA", "success");
                  }
                } catch (e) {
                  addNotification("Formato de sugestão inválido", "error");
                }
              }} 
            />
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
          <p className="text-white font-mono">Inicializando Rede Holográfica...</p>
        </div>
      )}
    </div>
  );
};
