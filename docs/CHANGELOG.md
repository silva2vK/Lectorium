# Lectorium - Histórico de Edições (Changelog)

## 2026-03-12 (tarde/noite) — Sessão 12

- **Data/Hora (BRT):** 2026-03-12 ~19:00–02:00
- **Arquivos Modificados:** `components/ApiKeyModal.tsx`, `utils/apiKeyUtils.ts`, `context/PdfContext.tsx`, `services/translationService.ts`, `components/pdf/layers/PdfTextLayer.tsx`
- **Resumo:** Reconstrução do `ApiKeyModal.tsx` após sobrescrita acidental pelo Gboard; fix de closure stale no fluxo de tradução em lote; remoção de letra morta em `translationService.ts`; adição de atributos de acessibilidade nos overlays de tradução para leitores de tela (TalkBack/NVDA).

- **Causa raiz do incidente Gboard:**
  O Gboard no Android tem comportamento de compartilhamento de buffer entre abas do GitHub mobile. Ao editar dois arquivos simultaneamente (Sidebar.tsx e ApiKeyModal.tsx), o conteúdo do `apiKeyUtils.ts` foi commitado no lugar do `ApiKeyModal.tsx`. O componente React foi perdido; o arquivo virou um utilitário sem export.
  **Protocolo estabelecido:** nunca editar mais de um arquivo por vez no GitHub mobile. Fluxo: abrir → editar → commit → fechar → próximo arquivo.

- **Bugs corrigidos:**
  - `ApiKeyModal.tsx`: reconstruído do zero. Export named `export const ApiKeyModal` (compatível com import do Sidebar linha 10). Props `isOpen` + `onClose`. UI: pool de chaves com máscara `•••...XXXX`, indicador verde na chave ativa (`CheckCircle`), botão remover por chave e "Remover Todas". Validação: rejeita chaves sem prefixo `AIza`. Integra com `apiKeyUtils.ts` atualizado (`getCurrentKeyIndex`, `saveApiKeys`, `getStoredApiKeys`). Build 1 (commit `Update Sidebar.tsx`) falhou com `"ApiKeyModal" is not exported`; Build 2 falhou com `"getCurrentKeyIndex" is not exported` — resolvido aplicando `apiKeyUtils.ts` da sessão 11.
  - `PdfContext.tsx` — Bug de closure stale: o `useEffect` do `ocr-page-ready` capturava `isTranslationMode` com valor inicial `false` e nunca atualizava durante o lote. Fix via `isTranslationModeRef = useRef(false)`. `toggleTranslationMode` e `setTranslationMode` agora sincronizam o ref. `handleOcrReady`: quando `isTranslationModeRef.current === true` e chega `markdown`, chama `translationMutation.mutate(page)` automaticamente — fecha o gap entre o fluxo de lote (`backgroundOcrService` → `ocr-page-ready`) e os overlays visuais. `translationMutation.onSuccess`: seta `isTranslationModeRef.current = true` para garantir consistência quando chamado via lote sem interação manual.
  - `translationService.ts` — Removido `process.env.API_KEY` de `getAiClient()`. Letra morta no browser — consistente com `aiService.ts` e `chatService.ts`.

- **Features adicionadas / melhorias:**
  - `PdfTextLayer.tsx` — Acessibilidade nos overlays de tradução: `role="text"` (identifica bloco para NVDA/TalkBack), `aria-label="${safeText}"` (texto limpo sem ruído CSS), `lang="pt-BR"` (pronúncia correta pelo leitor), `tabindex="0"` (navegável via Tab no TalkBack/Switch Access). Escape de `"` e `'` no `aria-label` evita quebra por aspas no texto traduzido. OCR normal (modo não-tradução) não afetado — bloco `else` preservado intacto. `lang` hardcoded `pt-BR` — quando suporte a múltiplos idiomas for necessário, adicionar prop `targetLang` ao componente.

- **Pendências abertas desta sessão:**
  - `lang="pt-BR"` hardcoded no `PdfTextLayer.tsx` — adicionar prop `targetLang` quando suporte multi-idioma for implementado.
  - Bug ABNT da Kalaki (colisão Bloco 3 × ausência de referências reais) — documentado, pendente revisão da Lente Semântica.

- **Validação em produção:** fluxo "Traduzir em Lote" confirmado funcionando — figurinhas geradas no mesmo processo sem clique manual intermediário.

## 2026-03-12 (madrugada)

- **Data/Hora (BRT):** 2026-03-12 ~01:30–03:00
- **Arquivos Modificados:** `components/doc/DocEditorLayout.tsx`, `components/doc/layout/DocCanvas.tsx`, `index.css`, `components/shared/Icon.tsx`, `components/doc/AiBubbleMenu.tsx`, `components/doc/TopMenuBar.tsx`, `components/MindMapEditor.tsx`, `public/shortcut-mindmap.svg`
- **Resumo:** Correção de `window.prompt()`/`confirm()` remanescentes; fix de modais deslocados no Android; implementação de export PDF via `@media print`; ícones ausentes no Icon.tsx; `roundReplacer` no MindMapEditor; redesign do shortcut.

- **Bugs corrigidos:**
  - `DocEditorLayout.tsx`: `overflow-hidden` no wrapper raiz criava stacking context no Android Chrome/Brave, confinando `position: fixed` dos modais (StyleConfigModal, VersionHistoryModal, etc.) dentro do bounding box do editor em vez da viewport. Removido do div raiz; `overflow-hidden` permanece no container interno do editor (linha ~167), onde é necessário.
  - `Icon.tsx`: 10 ícones declarados no `IconName` type sem paths no `iconData` — componente retornava `null` silenciosamente, deixando espaços vazios na toolbar (`AlignJustify`, `Baseline`, e outros 8). Paths SVG adicionados para todos.
  - `AiBubbleMenu.tsx`: `window.prompt()` substituído por painel inline expansível (input + Enter/Escape/Remover). Imports `Check`, `X` adicionados.
  - `TopMenuBar.tsx`: `window.prompt()` no `insertLink` substituído por input inline no dropdown Inserir. `confirm()` no `handleMarkdownImport` substituído por execução direta + `addNotification()`. Import `X` adicionado.

- **Features adicionadas / melhorias:**
  - `DocEditorLayout.tsx` + `DocCanvas.tsx` + `index.css`: Export PDF funcional via `@media print`. `handleExportPdf()` zera o `translateY` da translation layer (classe `lectorium-translation-layer` adicionada no DocCanvas) antes do `window.print()`, restaurando após 500ms. `@media print` em `index.css` oculta toda a UI e expõe apenas `.ProseMirror` posicionado `fixed top:0 left:0` com padding ABNT.
  - `MindMapEditor.tsx`: `roundReplacer` adicionado antes do `interface Props` e aplicado nos 3 pontos de `JSON.stringify` (download, Drive, AiChatPanel context). Coordenadas limitadas a 2 casas decimais.
  - `shortcut-mindmap.svg`: Redesenhado como mapa cartográfico dobrado — papel ocre com 2 dobras verticais, área de terra, rio, pino roxo (brand), rosa dos ventos, escala gráfica.

- **Pendências abertas desta sessão:**
  - Export PDF: margens do `@media print` são hardcoded ABNT (3/3/2/3 cm). Para ler `pageSettings` dinâmico do usuário, seria necessário injetar `<style>` com valores interpolados em `handleExportPdf`.
  - `@tiptap/extension-focus@2.11.5`: ausente no `package.json`; import removido como workaround. CSS `.has-focus` adicionado em `index.css` aguardando `npm install`.
  - Modais: fix aguarda validação em produção no tablet Android.

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
