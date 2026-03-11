# Lectorium - Histórico de Edições (Changelog)

## 2026-03-10 (tarde)

- **Data/Hora (BRT):** 2026-03-10 ~20:00
- **Arquivos Modificados:** `services/docx/documentParser.ts`, `index.css`, `components/doc/modals/TablePropertiesModal.tsx`
- **Resumo:** Correção da discrepância de ~10% entre contagem de páginas no Google Docs e no Lectorium. Adição de regras CSS para bordas de tabela. Expansão do modal de propriedades de tabela.
- **Bugs corrigidos:**
  - `documentParser.ts`: `twipsToPt()` retornava `null` para espaçamento zero — concatenado com `"pt"` gerava `"nullpt"` como CSS inválido em `marginTop`/`marginBottom`. Adicionado null-check. `lineHeight` com `toFixed(2)` gerava `"1.50"` (zero trailing) — substituído por `String(parseFloat(...))` → `"1.5"`.
  - **Causa raiz da discrepância de páginas**: `attrs.lineHeight` era gerado pelo parser mas ignorado silenciosamente pelo TipTap (sem atributo nativo para `lineHeight` em parágrafos). O CSS do `.ProseMirror` não definia `line-height`, então o browser Android usava o padrão (~1.2) em vez dos 1.5 do ABNT. Acumulava ~10% de diferença em documentos longos.
- **Features adicionadas / melhorias:**
  - `index.css`: bloco `DOC EDITOR — TIPOGRAFIA` — `.ProseMirror` com `line-height: 1.5`, `font-family: Times New Roman`, `font-size: 12pt` como fallback ABNT. Parágrafos e headings com `margin-top/bottom: 0` (Word não tem margem entre parágrafos; browser adiciona por padrão).
  - `index.css`: bloco `DOC EDITOR — TABELAS` — `border-collapse: collapse`, `border: 1px solid #000` em `td`/`th`, `.selectedCell::after`, `.column-resize-handle`. Sem essas regras o browser não renderizava nenhuma borda.
  - `TablePropertiesModal.tsx`: adicionados `toggleHeaderCell`, alinhamento vertical (topo/centro/base via `setCellAttribute('verticalAlign', ...)`), cor de borda (`setCellAttribute('borderColor', ...)`), paleta expandida. Refatoração interna: componentes `Tab` e `ActionButton` com prop `active`.
- **Nota**: `borderColor` e `verticalAlign` no modal requerem que a extensão `TableCell` declare esses atributos em `addAttributes()` para persistirem no JSON. Sem isso os comandos são ignorados silenciosamente — sem quebra.
- **Diagnóstico documentado**: `CM_TO_TWIPS = 566.929` verificado correto. `TWIPS_TO_PX = 1.33` correto. Margens lidas corretamente pelo `parseSectionProperties`. A discrepância era exclusivamente do `line-height`.



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
