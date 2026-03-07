# Lectorium - Histórico de Edições (Changelog)

## 2026-03-07

- **Data/Hora (BRT):** 2026-03-07 13:02:14
- **Arquivos Modificados:** `/components/MindMapEditor.tsx`, `package.json`
- **Resumo:** Transformação completa do editor de mapas mentais de 2D para 3D holográfico.
- **Features adicionadas:**
  - Integração com `@react-three/fiber`, `@react-three/drei` e `three`.
  - Algoritmo `compute3DPositions` para converter coordenadas 2D em espaço 3D (Z baseado em profundidade na árvore).
  - Componente `EnergyEdge` usando `CatmullRomCurve3` e `ShaderMaterial` para arestas animadas.
  - Componente `HoloNode` renderizando esferas 3D com glow, anéis orbitais e labels HTML flutuantes.
  - Câmera controlada via `OrbitControls` (zoom e rotação).
  - Estética sci-fi (fundo escuro, fog, estrelas, blending aditivo).
- **Bugs corrigidos / Notas:**
  - A estrutura de dados original (`MindMapData`, `MindMapNode`, `MindMapEdge`) foi preservada.
  - O campo `viewport` é salvo com valores fixos para manter compatibilidade com o formato `.mindmap`.
  - Imagens (`imageUrl`) foram temporariamente desativadas na renderização 3D com um aviso ao usuário.

## 2026-03-06

- **Data/Hora (BRT):** 2026-03-06 09:27:00
- **Arquivos Modificados:** `/context/DocEditorContext.tsx`, `/components/doc/TopMenuBar.tsx`, `/services/localFileService.ts`, `/hooks/useFileManager.tsx` (renomeado de `.ts`), `/src/types.ts`
- **Resumo:** Substituição de chamadas `alert()` por `addNotification()` do `useGlobalContext` para melhor UX. Tipagem estrita de `storageMode` e `FileSystemHandle` em `types.ts` removendo `any`. Renomeação de `useFileManager.ts` para `.tsx` para suportar JSX.

## 2026-03-02

- **Data/Hora (BRT):** 2026-03-02 20:20:00
- **Arquivos Modificados:** `/hooks/usePdfAnnotations.ts`
- **Resumo:** Correção no salvamento de tags no Sintetizador Lexicográfico. Anotações "gravadas" (burned) agora podem ser atualizadas (ex: adição de tags) e são salvas localmente, contornando a restrição anterior que impedia a atualização de anotações embutidas no PDF.

## 2026-03-01

- **Data/Hora (BRT):** 2026-03-01 19:42:20
- **Arquivos Modificados:** `/docs/CHANGELOG.md`, `/docs/BLACKBOX.md`
- **Resumo:** Criação do sistema de Memória Persistente (Protocolo de Continuidade). O objetivo é manter o contexto entre sessões longas, registrando o histórico de modificações e mapeando a arquitetura atual do sistema (Caixa-Preta) para contornar o limite de 1.200s e evitar alucinações de contexto.
