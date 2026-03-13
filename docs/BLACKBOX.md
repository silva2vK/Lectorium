# BLACKBOX.md — Lectorium
**Documento de Arquitetura, Decisões e Estado do Projeto**
**Versão do documento:** 2026-03-12 (rev. 4 — sessão 12 tarde/noite)
**Versão do software:** 1.7.0
**Repositório:** github.com/silva2vK/Lectorium (branch A1)
**Deploy:** Cloudflare Pages → lectorium-c1s.pages.dev
**Autoria:** Gabriel Silva (O Criador) — historiador, UFS, Aracaju-SE
**Ciclo de desenvolvimento:** Gabriel descreve → A Cidade (Claude) produz código → Gabriel aplica no GitHub → Cloudflare faz build automático

---

> **Nota de metodologia**: Este documento foi redigido em 2026-03-10 com base no código verificado nos arquivos enviados ao longo das sessões de desenvolvimento e nos transcripts das conversas. Rev. 2 (tarde) incorpora as correções de discrepância de paginação DOCX (documentParser + index.css), regras CSS de tabela, e expansão do TablePropertiesModal. Quando uma decisão está marcada como "verificada no código", significa que foi confirmada pela leitura direta dos arquivos-fonte. Quando marcada como "decisão do Criador", foi tomada explicitamente em conversa. Nenhuma informação foi inferida sem base.

---

## 1. Visão e Propósito

O Lectorium nasceu de uma constatação empírica do TCC de Gabriel: das 139 dissertações do PROHIS-UFS (Programa de Pós-Graduação em História, 2014–2025), nenhuma atingiu o que ele definiu como nível 3 de impacto social. A causa identificada foi instrumental — os pesquisadores não tinham ferramentas adequadas para organizar, anotar, sintetizar e escrever num fluxo contínuo.

O Lectorium é a resposta: um workspace acadêmico PWA local-first que integra leitura de PDFs, anotação, escrita com rigor ABNT, mapas mentais, síntese semântica com IA e gestão de arquivos num único ambiente.

**Constraints não-negociáveis que moldam todas as decisões:**
- Funciona em tablet Android (Galaxy Tab — hardware médio, touch-first)
- Local-first absoluto: dados do usuário nunca dependem de servidor proprietário
- Performance é primária, não secundária
- Zero backend próprio: toda lógica reside no cliente
- Build deve passar no Cloudflare Pages a cada commit

---

## 2. Stack Técnica

### Verificada no package.json em 2026-03-09

```
React 19.2.3
TypeScript 5.7.2
Vite 7.3.1
TailwindCSS 3.4.x (PostCSS build-time — não usa CDN, não usa JIT online)
```

### Editores e Documentos
```
TipTap 2.11.5 + extensões ProseMirror — editor de documentos .docx
Yjs 13.6.x — CRDT para colaboração
y-webrtc 10.3.0 — transporte P2P para Yjs
y-prosemirror 1.3.7 — binding Yjs ↔ ProseMirror
docx 9.5.1 — geração de .docx no cliente
```

### PDF
```
pdfjs-dist 5.5.x — renderização + extração de texto
  CRÍTICO: deve estar em optimizeDeps.exclude no vite.config.ts
  Motivo: usa worker ESM (pdf.worker.mjs?url), incompatível com pre-bundling do Vite
  Nunca mover para include — quebra o worker no Android
pdf-lib 1.17.1 — modificação de PDFs (burn annotations, embed metadados)
```

### Estado e UI
```
Zustand 5.0.11 + subscribeWithSelector — estado global e por instância
TanStack Query 5.90.x — estado assíncrono (mutations para OCR, lens, tradução)
motion 12.x (Framer Motion fork) — animações
lucide-react 0.577.x — ícones (em transição para SVG autoral)
```

### IA
```
@google/genai 1.43.x — SDK oficial Gemini
Modelos em uso (NUNCA substituir):
  gemini-3-flash-preview — Kalaki (chat streaming, OCR, síntese rápida)
  gemini-3-pro-preview   — análises complexas, geração de mapas mentais com IA
```

### Armazenamento
```
idb 8.0.3 — IndexedDB wrapper tipado
idb-keyval 6.2.2 — key-value simples para settings
File System Access API (nativa) — acesso a pasta local do dispositivo
OPFS (Origin Private File System) — arquivos pesados, sem quota prompt
```

### Infraestrutura e Autenticação
```
Firebase 12.7.0 — autenticação Google OAuth
Google Drive REST API (via fetch direto, não SDK)
```

### Formatos e Mídia
```
three 0.183.x — Three.js para MindMapEditor 3D
@react-three/fiber 9.5.x — binding React para Three.js
@react-three/drei 10.7.x — helpers R3F
jszip 3.10.1 — compressão, leitura CBZ
daikon 1.2.46 — DICOM (lazy-load)
utif 3.1.0 — TIFF (lazy-load)
heic2any 0.0.4 — conversão HEIC → JPEG no cliente
katex 0.16.x — fórmulas matemáticas
mermaid 11.12.2 — diagramas (lazy-load)
recharts 3.7.x — gráficos (em transição para SVG/Canvas nativo)
uuid 13.x — geração de IDs
qrcode 1.5.4 — geração de QR
```

---

## 3. Estrutura de Arquivos

### Raiz do projeto (sem src/)
O projeto não tem diretório `src/`. Componentes e serviços ficam na raiz:

```
/components/          — componentes React
/services/            — serviços (lógica de negócio, APIs externas)
/hooks/               — React hooks customizados
/stores/              — Zustand stores
/context/             — React contexts
/repositories/        — CRUD IndexedDB
/utils/               — utilitários puros
/types.ts             — contrato de tipos central (FONTE DE VERDADE)
/App.tsx              — orquestrador raiz
/firebase.ts          — inicialização Firebase
/public/fonts/        — fontes self-hosted (não usar CDN)
/docs/                — documentação (BLACKBOX.md, CHANGELOG.md)
```

**ATENÇÃO**: Existe um `/src/components/PdfViewer.tsx` legado (~120 linhas, interface simples) de quando o projeto tinha estrutura `src/`. É arquivo morto. Pode ser deletado. O PdfViewer real está em `/components/PdfViewer.tsx` (670+ linhas).

---

## 4. Arquitetura de Camadas

```
App.tsx (Orquestrador)
  └── GlobalProvider
        └── ErrorBoundary
              └── AppContent
                    ├── useWorkspace  — onboarding, tema, wakeLock, fullscreen
                    ├── useFileManager — tabs, roteamento de viewers, lazy loading
                    └── useSync       — sincronização Drive ↔ IDB
```

### Viewers (todos lazy via React.lazy + Suspense)

| Viewer | Arquivo | Ativa para |
|---|---|---|
| `PdfViewer` | `components/PdfViewer.tsx` | `.pdf` e qualquer mimeType não reconhecido |
| `DocEditor` | `components/DocEditor.tsx` | `.docx`, `DOCX mimeType`, `GOOGLE_DOC` |
| `MindMapEditor` | `components/MindMapEditor.tsx` | `.mindmap`, `.json`, `application/json` |
| `UniversalMediaAdapter` | `components/UniversalMediaAdapter.tsx` | `image/*`, `application/dicom`, `text/*`, `.cbz` |
| `LectAdapter` | `components/LectAdapter.tsx` | `.lect`, `application/vnd.lectorium` |
| `OperationalArchive` | `components/OperationalArchive.tsx` | tab `operational-archive` (Sintetizador Lexicográfico) |
| `Dashboard` | `components/Dashboard.tsx` | tab `dashboard` (tela inicial) |
| `DriveBrowser` | `components/DriveBrowser.tsx` | tabs `browser`, `mindmaps`, `offline`, `local-fs`, `shared` |

### IDs de arquivo (convenção)
- `local-*` — criados localmente (sem Drive)
- `native-*` — File System Access API (pasta local nativa)
- Sem prefixo — Google Drive ID

---

## 5. Contextos e Estado

### GlobalContext (`context/GlobalContext.tsx`)
Estado verdadeiramente global. Provê:
- `addNotification(msg, type)` — sistema de toast. **Todo alerta ao usuário passa por aqui. Nunca usar `alert()`.**
- `isOcrRunning`, `ocrProgress`, `ocrStatusMessage` — estado do OCR background
- `dashboardScale` — escala visual do dashboard (1–5)

### DocEditorContext (`context/DocEditorContext.tsx`)
Estado completo do editor TipTap. Instância única por arquivo aberto.

### PdfContext (`context/PdfContext.tsx`)
Estado do PdfViewer. Provê:
- `settings` — preferências visuais (cor, zoom, ferramentas)
- `annotations`, `addAnnotation`, `removeAnnotation`, `updateAnnotation`
- `ocrMap`, `nativeTextMap` — texto extraído por página
- `lensData` — dados da Lente Semântica (OCR + markdown)
- `triggerSemanticLens(page)`, `triggerOcr(page)`, `triggerRefinement(page)`, `triggerTranslation(page)`
- `fileId` — ID do arquivo atual
- `isTranslationMode`, `toggleTranslationMode`, `setTranslationMode` — controle do modo de tradução visual
- `translationMap` — overlays de tradução por página

**Importante**: `updateAnnotation` no PdfContext é apenas um repasse para o caller (`PdfViewer` via prop `onUpdateAnnotation`). A implementação real está em `usePdfAnnotations.updateAnnotation`.

**Importante**: `isTranslationModeRef = useRef(false)` sincronizado com `isTranslationMode`. Necessário porque o `useEffect` do `ocr-page-ready` usa `dep array: [fileId]` — sem o ref, `isTranslationMode` no closure seria sempre `false` (closure stale). **Nunca remover o ref.**

### usePdfStore (`stores/usePdfStore.ts`)
Zustand **por instância**, não global. Padrão: factory function + Context.

**Por que por instância?** O usuário pode ter dois PDFs abertos em split view. Um store global causaria conflito de estado entre os dois viewers.

**Nunca converter para store global** — quebraria split view.

Provê: `currentPage`, `numPages`, `scale`, `activeTool`, `isSpread`, `jumpToPage`, `setIsSpread`, etc.

---

## 6. Serviços

### `services/aiService.ts`
- `getAiClient()` — retorna instância do GoogleGenAI com chave do usuário ou da env
- `withKeyRotation(operation)` — wrapper que rotaciona chave do pool em caso de erro 429
- Funções de IA específicas: `refineTranscript`, geração de mapas mentais, etc.

### `services/chatService.ts` (Kalaki)
- Chat streaming com `gemini-3-flash-preview`
- Mantém histórico de mensagens da sessão
- Usado pelo `AiChatPanel` e `DocAiSidebar`

### `services/ragService.ts`
- RAG bare-metal: sem LangChain, sem biblioteca externa
- Embeddings via Gemini API
- Similaridade de cosseno implementada diretamente
- `indexDocumentForSearch(fileId, blob, text)` — indexa documento
- Busca retorna trechos relevantes por vetor

### `services/authService.ts`
- OAuth Google + token Drive
- Singleton de refresh (resolvido em 2026-03-08)
- `error_callback` no GSI configurado
- `DRIVE_TOKEN_EVENT` — evento customizado para notificar token renovado

### `services/storageService.ts`
- Facade que re-exporta todos os repositories
- Ponto de entrada único para persistência
- Importar de `storageService`, não dos repositories diretamente (exceto quando necessário por clareza)

### `services/backgroundOcrService.ts`
- OCR assíncrono que não bloqueia a UI
- Dispara `window.dispatchEvent('ocr-page-ready', { fileId, page, words, markdown, metrics })`
- `PdfContext` escuta esse evento e atualiza o mapa de OCR em tempo real

### `services/pdfModifierService.ts`
- Usa `pdf-lib` para "queimar" anotações no PDF (burn)
- Também embute metadados Lectorium (`LECTORIUM_V2_B64:::`) nas Keywords do PDF
- Chamado no ciclo de save do Drive

### `services/lexSynthService.ts` *(adicionado em 2026-03-09)*
- Serviço do Sintetizador Lexicográfico
- Extrai trechos por tag das anotações de múltiplos PDFs
- Sintetiza com IA (gemini-3-flash-preview) quando fillMode = 'ai'
- Salva/carrega tabela `.lexsynth` (JSON) no IndexedDB

---

## 7. Repositories

Todos ficam em `/repositories/`. Acesso via `idb getDb()`.

### `contentRepository.ts`
- `saveAnnotation(uid, fileId, ann)` — CRUD de anotações (IndexedDB `annotations`)
- `loadAnnotations(uid, fileId)` — carrega por índice fileId
- `deleteAnnotation(id)` — delete por id
- `saveDocVersion / getDocVersions` — versionamento de documentos (max 50 versões)
- `saveOcrData / loadOcrData` — cache de OCR por página
- `saveAuditRecord / getAuditRecord` — hash de integridade do PDF

### `fileRepository.ts`
- CRUD de arquivos offline (IndexedDB `offlineFiles`)

### `vectorRepository.ts`
- CRUD de vetores RAG (IndexedDB `vector_store`)
- `VectorIndex` + `EmbeddingChunk[]` por documento

### `settingsRepository.ts`
- Configurações persistidas (IndexedDB `settings`)

---

## 8. IndexedDB — Stores

Todas as stores são acessadas via `idb getDb()` definido em `services/db.ts`.

| Store | Conteúdo | Chave |
|---|---|---|
| `offlineFiles` | Blobs de arquivos para uso offline | `id` |
| `ocrCache` | Palavras OCR + markdown por página | `fileId-page` |
| `vector_store` | Vetores RAG + índice | `fileId` |
| `document_versions` | Versões do conteúdo TipTap | `id` (index: `fileId`) |
| `audit_log` | Hash de integridade dos PDFs | `fileId` |
| `settings` | Configurações do usuário | chave string |
| `annotations` | Anotações PDF | `id` (index: `fileId`) |
| **[legado]** `documents` | Formato antigo de documentos | — |
| **[legado]** `syntheses` | Sínteses antigas | — |

**Regra crítica**: Nunca alterar estrutura de stores sem plano de migração. Usuários com dados existentes não têm mecanismo automático de migração se a schema quebrar.

---

## 9. Modelo de Dados Central (`types.ts`)

### `DriveFile`
```typescript
interface DriveFile {
  id: string;           // 'local-*' | 'native-*' | Drive ID
  name: string;
  mimeType: string;
  blob?: Blob;          // presente quando arquivo está em memória
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle | null; // para nativos
  starred?: boolean;
  pinned?: boolean;
  parents?: string[];   // pasta pai no Drive
}
```

### `Annotation`
```typescript
interface Annotation {
  id?: string;
  page: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  text?: string;
  type: 'highlight' | 'note' | 'ink';
  points?: number[][];  // para 'ink'
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  isBurned?: boolean;   // se true, está embedded no PDF via pdf-lib
  tags?: string[];      // tags do Sintetizador Lexicográfico
}
```

**Regra de `isBurned`**: anotações burned estão no PDF físico. `removeAnnotation` rejeita anotações burned — não se pode deletar o que está gravado no arquivo. `updateAnnotation` aceita burned (para adicionar tags).

### `PdfMetadataV2`
Metadados embedados nas Keywords do PDF via base64:
```typescript
interface PdfMetadataV2 {
  lectorium_v: string;
  last_sync: string;
  pageCount: number;
  pageOffset?: number;
  annotations: Annotation[];
  semanticData?: Record<number, string>; // markdown por página
}
```
Prefixo no PDF: `LECTORIUM_V2_B64:::` seguido de JSON base64.

### `LexSynth*` *(adicionado em 2026-03-09)*
```typescript
type LexSynthFillMode = 'literal' | 'ai';

interface LexSynthColumn {
  id: string;
  name: string;
  tags: string[];           // tags mapeadas (sem '#')
  fillMode: LexSynthFillMode;
}

interface LexSynthCell {
  content: string;
  pages: number[];
  isLoading?: boolean;
  isUsed?: boolean;         // marcado como "já citado" no DocEditor
}

interface LexSynthRow {
  fileId: string;
  fileName: string;
  hasOcr: boolean;
  cells: Record<string, LexSynthCell>; // chave = LexSynthColumn.id
}

interface LexSynthTable {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  columns: LexSynthColumn[];
  rows: LexSynthRow[];
}
```

---

## 10. Chunks do Vite (`vite.config.ts`)

A ordem das regras em `manualChunks` é crítica. Alterar sem entender causa ciclos de importação.

| Chunk | Conteúdo | Nota crítica |
|---|---|---|
| `vendor-react` | react, react-dom, scheduler | — |
| `three-vendor` | three.js | Historicamente instável. Isolado intencionalmente. |
| `r3f-vendor` | @react-three/fiber, @react-three/drei | Depende de three-vendor |
| `vendor-firebase` | firebase | — |
| `vendor-ai-sdk` | @google/genai | — |
| `vendor-yjs` | yjs, y-webrtc, **y-prosemirror**, lib0 | **y-prosemirror DEVE ficar aqui**, antes de vendor-editor |
| `vendor-editor` | @tiptap, prosemirror | Se y-prosemirror estiver aqui, cria ciclo com vendor-yjs |
| `vendor-pdf` | pdfjs-dist, pdf-lib | pdfjs em optimizeDeps.exclude |
| `vendor-mermaid` | mermaid | Lazy-load — não importar diretamente |
| `vendor-katex` | katex | — |
| `vendor-medical-formats` | daikon, utif | Lazy-load — não importar diretamente |
| `vendor-charts` | recharts | Em transição para SVG nativo |
| `vendor-utils-light` | jszip, uuid, idb, clsx, tailwind-merge | — |
| `vendor-icons` | lucide-react | Em transição para icons.ts autoral |
| `vendor-state` | zustand, @tanstack | — |

**Por que `pdfjs-dist` em `optimizeDeps.exclude`?**
O worker do pdfjs v5.5 é carregado via `import.meta.url` como ESM puro (`pdf.worker.mjs?url`). O pre-bundling do Vite quebra esse mecanismo — o worker não consegue se registrar corretamente no Android. A versão 5.5 foi adotada exatamente por esse padrão ESM funcionar offline (useSystemFonts).

---

## 11. Sistema de Anotações PDF — Fluxo Completo

Este foi o sistema com mais bugs históricos. Documentado com precisão.

### Cadeia de persistência

```
Usuário interage com PDF
  → PdfPage detecta gesto (seleção, clique)
    → SelectionMenu ou ferramenta ativa
      → PdfSidebar.updateAnnotation({ ...ann, tags })
        → usePdfContext().updateAnnotation            [via PdfContext]
          → onUpdateAnnotation (prop do PdfProvider)  [PdfViewer passa esta prop]
            → usePdfAnnotations.updateAnnotation()    [implementação real]
              → saveAnnotation(uid, fileId, ann)       [contentRepository → IDB]
```

### Bug histórico (corrigido em 2026-03-10)
**Causa raiz**: `onUpdateAnnotation={updateAnnotation}` não estava sendo passado ao `PdfProvider` em `PdfViewer.tsx`. O fio estava solto na linha 644. `updateAnnotation` também não estava desestruturado no `usePdfAnnotations`.

**Segundo bug associado**: `isCheckingIntegrity` iniciava como `true` e closure stale em `conflictDetected` bloqueava `updateAnnotation` silenciosamente. Corrigido com `conflictRef = useRef(false)`.

**Terceiro bug associado (TagModal.tsx, corrigido em 2026-03-10)**:
1. `<form>` sem `<button type="submit">` — submit por Enter ignorado no teclado virtual Android
2. Regex `/[^a-z0-9-]/g` destruía acentuação. Substituída por `/[^\p{L}\p{N}_-]/gu` (Unicode property escapes)

### Regras de `usePdfAnnotations`
- Ordem de prioridade no merge: Embutido (PDF) → Importado (.lect) → Local (IDB). Local sempre vence.
- `addAnnotation` e `removeAnnotation` rejeitam se `isCheckingIntegrity || conflictDetected`
- `updateAnnotation` rejeita apenas se `!updatedAnn.id` (permite atualizar anotações burned para adicionar tags)
- Conflict detection: compara hash do blob atual com `auditRecord.contentHash`

---

## 12. Sintetizador Lexicográfico (`OperationalArchive`)

### O que é
Ferramenta de síntese comparativa. O usuário seleciona múltiplos PDFs, define colunas mapeadas a tags de anotações, e o sistema preenche uma tabela cruzando cada PDF com cada coluna — literalmente (trechos destacados com aquela tag) ou via IA (síntese dos trechos).

### Fluxo
```
Usuário seleciona PDFs (local ou Drive)
  → MultiFilePicker lista arquivos disponíveis
    → Para cada arquivo, carrega anotações (IDB) e OCR (IDB)
      → Para cada coluna (tag mapeada):
          fillMode 'literal': concatena text das annotations com aquela tag
          fillMode 'ai': envia trechos + prompt para gemini-3-flash-preview
            → recebe síntese → preenche célula
```

### Integração com DocEditor
O Sintetizador pode injetar markdown no DocEditor ativo via evento:
```javascript
window.dispatchEvent(new CustomEvent('inject-markdown-to-doc', {
  detail: { fileId, markdown }
}));
```
**Pendência**: DocEditor ainda não escuta esse evento. Precisa implementar listener em `DocEditor.tsx` que chama `editor.commands.insertContent(markdown)`.

### Persistência
Tabelas salvas como `.lexsynth` (JSON serializado) no IndexedDB.

---

## 13. OCR e Lente Semântica

### Pipeline OCR
```
backgroundOcrService.ts (assíncrono, não bloqueia UI)
  → visionService.ts → Gemini Vision (gemini-3-flash-preview)
    → mapSegmentsToWords() — mapeia segmentos para coordenadas no canvas
      → saveOcrData(fileId, page, words, markdown) — persiste no IDB
        → window.dispatchEvent('ocr-page-ready', { fileId, page, words, markdown, metrics })
          → PdfContext escuta e atualiza ocrMap + lensData em tempo real
```

### Lente Semântica (triggerSemanticLens)
- Renderiza a página em 1536px de largura (ótimo para Gemini 3 Flash)
- Aplica filtro `grayscale(1) contrast(1.4) brightness(1.1)` — "Clean Slate Filter"
- Converte para JPEG 70% quality
- Envia para `performFullPageOcr`
- Resultado: palavras com coordenadas + markdown reconstruído

### Refinamento (triggerRefinement)
- Pega o markdown da Lente já processado
- Envia para `refineTranscript` (aiService)
- Reorganiza sem re-renderizar a página
- Preserva coordenadas originais (refinamento é só textual)

---

## 14. Autenticação e Drive

### Fluxo de autenticação
```
Firebase Google OAuth
  → token de acesso ao Drive (access_token, não refresh_token)
  → saveDriveToken() — persiste no localStorage com timestamp
  → getValidDriveToken() — verifica expiração antes de retornar
  → DRIVE_TOKEN_EVENT — evento para notificar renovação de token
```

### Singleton de refresh (corrigido em 2026-03-08)
Antes havia múltiplas chamadas paralelas de refresh. Agora: uma Promise única compartilhada. Se já está refreshando, novas chamadas aguardam a mesma Promise.

### Google Drive REST API
Usado diretamente via fetch, sem SDK. Endpoints: Files API v3.
Sync é bidirecional mas não completo — pendência documentada na seção de backlog.

### `error_callback` no GSI (corrigido em 2026-03-08)
O Google Sign-In SDK precisa do `error_callback` configurado para capturar falhas de popup (bloqueadores de popup no Android). Sem isso, falhas silenciosas.

---

## 15. Sistema de Pool de Chaves Gemini

### Por que existe
O Criador usa API key própria e pode ter múltiplas. Em ambientes de alta carga (muitas chamadas OCR), uma chave atinge quota 429. O pool rotaciona automaticamente.

### Implementação (`utils/apiKeyUtils.ts`)
- Lista de chaves armazenada no localStorage
- `rotateApiKey()` — move para a próxima chave na lista
- `withKeyRotation(operation, retryCount)` em `aiService.ts`:
  - Captura erros 429 ou 'quota'
  - Rotaciona chave
  - Retry com delay de 1s
  - Máximo 3 tentativas

---

## 16. Formato `.lect` (Proprietário)

Formato de empacotamento do Lectorium. Combina num único arquivo:
- Conteúdo do documento (TipTap JSON ou PDF blob)
- Anotações
- Metadados semânticos (OCR markdown por página)
- Offset de página

Gerenciado por `lectService.ts` e `LectAdapter` (viewer).

---

## 17. MindMapEditor 3D

### Histórico
Three.js foi adicionado, causou ciclos de importação e foi removido duas vezes. Na v1.7.0 foi reintegrado de forma definitiva com chunks isolados (`three-vendor`, `r3f-vendor`) no vite.config.ts. **Qualquer mudança nesses chunks exige validação de build no Cloudflare antes de considerar resolvido.**

### Stack
- Three.js r183 + React Three Fiber 9.5 + Drei 10.7
- Nós como meshes 3D com interação via raycasting
- Instanced geometry (Three.js Instances) aprovado no backlog para otimização futura

### Formato `.mindmap`
JSON com `{ nodes: MindMapNode[], edges: MindMapEdge[], viewport: MindMapViewport }`.

---

## 18. Performance e Padrões Proibidos

### Contexto
O Criador usa tablet Android (hardware médio). Cada pattern errado é perceptível.

### Proibido — explica por quê
```typescript
// PROIBIDO: polling — mantém o CPU acordado o tempo todo
setInterval(() => checkSomething(), 1000);
// CORRETO: event-driven
window.addEventListener('visibilitychange', checkSomething);

// PROIBIDO: re-render forçado em cada frame de animação
setViewport({ ...viewportRef.current }); // em requestAnimationFrame
// CORRETO: manipular style diretamente via ref
viewportRef.current.x += delta;
element.style.transform = `translate(${x}px, ${y}px)`;

// PROIBIDO: alert/confirm/prompt — bloqueiam a thread e parecem bugs em PWA
alert("Erro ao salvar");
// CORRETO:
addNotification("Erro ao salvar", "error"); // GlobalContext
```

### Tailwind e CSS
- Tailwind compila em build-time via PostCSS. Classes não definidas em código não estarão disponíveis em runtime.
- Não usar `style={{ }}` para valores que o Tailwind cobre.
- CSS customizado vai em `index.css` com camadas `@layer`.

---

## 19. PWA — Service Worker e Manifest

### Service Worker (`sw.js`)
- Estratégia: Cache First para assets estáticos, Network First para API calls
- Screenshots adicionados manualmente pelo Criador — não gerar automaticamente
- Invalidação de cache: versão do SW deve mudar a cada deploy que altera assets

### Manifest (`manifest.json`) — corrigido em 2026-03-09
- `id: "/"` — corrigido (estava com path relativo incorreto)
- `share_target`: método POST + multipart — permite receber arquivos compartilhados de outros apps Android
- `display: "standalone"` — remove UI do browser, aparece como app nativo

### Fontes
Self-hosted em `/public/fonts/`. Nunca usar CDN de fontes (sem internet = sem fonte = layout quebrado).

---

## 20. Decisões Rejeitadas (e Por Quê)

Documentar o que foi descartado é tão importante quanto o que foi aceito.

### CDNs externos no index.html
**Rejeitado em 2026-03-09.** Qualquer CDN externo cria dependência de conectividade e viola o princípio local-first. Todos os scripts foram removidos e substituídos por imports via npm/bundler.

### Store Zustand global para PDF
**Rejeitado.** Split view (dois viewers lado a lado) requer estado independente por instância. Store global causaria conflito entre os dois viewers ativos.

### `localStorage` para dados grandes
**Rejeitado.** Limite de ~5MB. Dados de anotações, OCR e vetores facilmente ultrapassam isso. IndexedDB é o correto.

### SDK do Google Drive (googleapis)
**Rejeitado.** Bundle pesado. REST API via fetch direto é suficiente e mantém o bundle menor.

### Assinatura digital via pdf-lib
**Rejeitado em 2026-03-10 (decisão do Criador).** Delegado ao gov.br e sistemas governamentais. O Lectorium não precisa implementar — o usuário usa o serviço adequado para isso.

### Angular ou framework alternativo
**Nunca considerado formalmente, mas justificado.** React foi escolhido porque: TipTap, R3F e pdfjs-dist são React-first; React 19 tem Concurrent Mode (essencial para lazy loading sem travar UI em tablet); ecossistema de hooks customizados é mais adequado para desenvolvimento solo incremental.

### pdfjs-dist v3.4 em vez de v5.5
**Rejeitado.** v5.5 é necessária por: worker via ESM (`pdf.worker.mjs?url`) compatível com Vite 7; `useSystemFonts` para modo offline; `getAnnotations()` e `getStructTree()` disponíveis (backlog).

---

## 21. Backlog Aprovado (2026-03-10)

Items formalmente aprovados pelo Criador para implementação futura. Não implementar sem ordem explícita.

### Recharts
- Todos os tipos de gráfico (linha, área, pizza, scatter, radial, etc.)
- `Brush` — componente de seleção de range temporal

### Three.js / R3F / Drei
- `Instances` — geometrias instanciadas para MindMapEditor (performance com muitos nós)

### TipTap — extensões não utilizadas aprovadas
- `CollaborationCursor` — cursor de colaborador em tempo real
- `CharacterCount` — contagem de caracteres/palavras
- `Typography` — substituição tipográfica automática (aspas, travessões)
- `Placeholder` por nó — placeholder configurável por tipo de nó
- `Mention` — @menções com popover
- `Mathematics` — unificar com KaTeX separado (atualmente duplicado)
- `Details/Summary` — blocos colapsáveis
- `TableOfContents` — índice automático
- `UniqueID` — ID único por nó (útil para comentários e ancoragem)
- `Focus` — gerenciamento de foco com classes CSS
- Exportação Markdown nativa

### pdf-lib — features não utilizadas aprovadas
- Preencher AcroForm (formulários PDF)
- Adicionar campos de formulário programaticamente
- Rotacionar páginas
- Remover páginas

### pdfjs-dist v5.5 — APIs não utilizadas aprovadas
- `getAnnotations()` — ler anotações nativas do PDF
- `getStructTree()` — estrutura semântica do documento
- `getOptionalContentConfig()` — camadas opcionais (OCG)
- `getDestinations()` — âncoras internas do PDF

---

## 22. Pendências Técnicas

### 🔴 PRIORIDADE MÁXIMA (sessão 2026-03-12)
```
[ ] DocEditor — Export PDF: window.print() captura UI inteira (header, réguas, toolbar).
    Correção produzida: @media print em index.css + handleExportPdf em DocEditorLayout.tsx
    + classe lectorium-translation-layer em DocCanvas.tsx. Aguarda validação em produção.
    Limitação conhecida: margens do @media print são hardcoded ABNT (3cm/3cm/2cm/3cm),
    não leem pageSettings dinâmico do usuário.

[ ] DocEditor — Modais deslocados (StyleConfigModal e outros saindo da viewport):
    Causa confirmada: overflow-hidden no wrapper raiz do DocEditorLayout criava stacking
    context no Android, confinando position:fixed dos modais. Fix produzido: remoção do
    overflow-hidden do div raiz. Aguarda validação em produção.

[ ] Performance geral — revisão de arquivos críticos para reduzir re-renders, heap e
    tempo de parse. Foco: DocCanvas.tsx (translateY frequente), MindMapEditor.tsx (muitos
    nós), PdfViewer.tsx (camadas sobrepostas). Ainda sem intervenção — pendente mapeamento.
```

### Críticas (impactam funcionalidade existente)
```
[ ] PaginationExtension — dispatch fora do ciclo update() do ProseMirror
[ ] PaginationExtension — invalidar heightCache ao mudar zoom/papel
[ ] DocAiSidebar — extração estruturada com comentários do CommentExtension
[ ] PdfSidebar — passar fileId e numPages ao AiChatPanel
[ ] AiChatPanel — persistência IndexedDB com storageKey por documento
[ ] useSlideNavigation — remover interceptação global do Backspace (afeta inputs)
[ ] Painel Tático (PdfViewer) — sobrepor PDF completamente em portrait, não dividir tela
[ ] AiChatPanel — threshold numPages: 17 → 27 (uma linha)
[ ] PdfTextLayer.tsx — lang="pt-BR" hardcoded nos overlays de tradução; adicionar prop targetLang quando suporte multi-idioma for necessário
[ ] TableCell extension — adicionar atributos borderColor e verticalAlign ao addAttributes()
```

### Débito técnico menor
```
[ ] mermaid — confirmar se dynamic import() está ativo no componente
[ ] UniversalMediaAdapter — confirmar dynamic import() para daikon e utif
[ ] CSS inválido na linha 4906 do index.css compilado — localizar e corrigir
[ ] lucide-react → icons.ts (transição em andamento)
[ ] AiChatPanel — storageKey por documento nos callers
[ ] Oracle.tsx — verificar se import legado '../services/ai' foi migrado para aiService.ts
[ ] @tiptap/extension-focus@2.11.5 — ausente no package.json; import removido como workaround.
    CSS .has-focus adicionado em index.css aguardando npm install para ativar.
[ ] Export PDF — margens do @media print hardcoded ABNT; idealmente ler pageSettings dinâmico
[ ] SecretThemeModal — usa localStorage; inconsistente com resto do projeto (IndexedDB/Zustand)
```

### Arquitetura (sem prazo)
```
[ ] Drive bidirecional completo
[ ] recharts → SVG/Canvas nativo no VisualChart
[ ] Tagging interativa (clicar em trechos do PDF → adicionar tag inline)
[ ] Geração automática de tabelas/gráficos a partir de tags com IA
[ ] Substituição completa de lucide-react por icons.ts autoral
```

---

## 23. Concluído — Linha do Tempo

Registro cronológico de decisões resolvidas. Não regredir.

```
2026-03-02  [x] Correção salvamento de tags em anotações burned
2026-03-06  [x] alert()/confirm() → addNotification() em todo o codebase
2026-03-07  [x] MindMapEditor 3D — three.js chunkado e funcional
2026-03-08  [x] Singleton de refresh no authService.ts
2026-03-08  [x] error_callback no GSI (Google Sign-In)
2026-03-08  [x] pdfjs-dist: exclude em optimizeDeps (nunca reverter)
2026-03-08  [x] Chunks circulares vendor-yjs/vendor-editor resolvidos
2026-03-08  [x] CDNs externos removidos do index.html
2026-03-08  [x] Tailwind migrado para PostCSS build-time
2026-03-08  [x] Fontes self-hosted em /public/fonts/
2026-03-08  [x] process.env.API_KEY removido do vite.config.ts define
2026-03-08  [x] manifest.json: id corrigido para "/", share_target POST + multipart
2026-03-08  [x] StorageMode tipagem estrita (removido any)
2026-03-08  [x] useFileManager.ts → .tsx (suporte JSX)
2026-03-08  [x] Pool de chaves Gemini com rotação por quota
2026-03-08  [x] usePdfStore: Zustand por instância via Context
2026-03-08  [x] View Transition API no useFileManager
2026-03-08  [x] Wake Lock API no useWorkspace
2026-03-08  [x] Janitor automático (runJanitor) — limpeza IDB quando > 500MB
2026-03-09  [x] DriveBrowser — separador visual pasta/arquivo
2026-03-09  [x] DriveBrowser — badge "DIR" → "X itens" dinâmico nas pastas
2026-03-09  [x] Sidebar.tsx — "Sintetizador" em linha única, text-[17px]
2026-03-09  [x] sw.js e manifest.json revisados e validados
2026-03-09  [x] types.ts — adição dos tipos LexSynth*
2026-03-09  [x] lexSynthService.ts — criado em services/
2026-03-09  [x] OperationalArchive.tsx — Sintetizador Lexicográfico completo
2026-03-09  [x] App.tsx — bloco operational-archive expandido com openDocxFiles + onInjectToDocx
2026-03-09  [x] Dashboard — redesign: ícones SVG autorais, layout proporcional, gradiente corrigido
2026-03-09  [x] AiChatPanel — opções clicáveis (blocos :::options JSON, parser CustomMarkdown)
2026-03-10  [x] TagModal.tsx — Bug 1: Enter silencioso no Android (onKeyDown + button type=submit)
2026-03-10  [x] TagModal.tsx — Bug 2: regex destroçava acentuação (/[^\p{L}\p{N}_-]/gu)
2026-03-10  [x] usePdfAnnotations.ts — conflictRef useRef para closure stale
2026-03-10  [x] PdfViewer.tsx — onUpdateAnnotation={updateAnnotation} passado ao PdfProvider
2026-03-10  [x] documentParser.ts — lineHeight: null-check em marginTop/marginBottom; ratio sem toFixed trailing zero
2026-03-10  [x] index.css — fallback tipográfico ABNT (.ProseMirror: line-height 1.5, Times New Roman, 12pt)
2026-03-10  [x] index.css — margin-bottom zerado em p/h1-h6 dentro do editor (Word não tem margem entre parágrafos)
2026-03-10  [x] index.css — regras de tabela (.ProseMirror table): border-collapse, bordas pretas, selectedCell, column-resize-handle
2026-03-10  [x] TablePropertiesModal.tsx — expandido: alinhamento vertical, cor de borda, toggleHeaderCell, refatoração Tab/ActionButton
2026-03-12  [x] ApiKeyModal.tsx — reconstruído após sobrescrita acidental pelo Gboard; named export, pool de chaves, máscara, validação AIza, integração apiKeyUtils
2026-03-12  [x] Protocolo Gboard estabelecido: nunca editar mais de um arquivo por vez no GitHub mobile
2026-03-12  [x] PdfContext.tsx — isTranslationModeRef adicionado (resolve closure stale no useEffect ocr-page-ready); handleOcrReady dispara translationMutation automaticamente quando lote conclui em modo tradução; toggleTranslationMode e setTranslationMode sincronizam o ref
2026-03-12  [x] translationService.ts — removido process.env.API_KEY (letra morta, consistência com aiService/chatService)
2026-03-12  [x] PdfTextLayer.tsx — overlays de tradução com role="text", aria-label, lang="pt-BR", tabindex="0"; OCR normal intacto; safeText escapa aspas no aria-label
2026-03-12  [x] Fluxo "Traduzir em Lote" validado em produção — figurinhas geradas automaticamente sem clique manual
2026-03-12  [x] DocEditorLayout.tsx — overflow-hidden removido do wrapper raiz (fix modais deslocados no Android)
2026-03-12  [x] DocEditorLayout.tsx — handleExportPdf() com reset de translateY + injeção de <style> temporário antes do window.print()
2026-03-12  [x] DocCanvas.tsx — classe lectorium-translation-layer adicionada para seleção no handleExportPdf
2026-03-12  [x] index.css — @media print completo: oculta UI, expõe só .ProseMirror, page-break entre seções, tabelas
2026-03-12  [x] Icon.tsx — 10 ícones sem paths adicionados ao iconData: AlignJustify, Baseline, ActivitySquare, FunctionSquare, Grid3X3, Merge, Split, GripHorizontal, Indent, Play
2026-03-12  [x] AiBubbleMenu.tsx — window.prompt() substituído por input inline com Check/X/Remover
2026-03-12  [x] TopMenuBar.tsx — window.prompt() substituído por input inline no dropdown Inserir; confirm() no handleMarkdownImport substituído por addNotification()
2026-03-12  [x] MindMapEditor.tsx — roundReplacer adicionado nos 3 pontos de JSON.stringify (download, Drive, AiChatPanel context)
2026-03-12  [x] shortcut-mindmap.svg — redesenhado como mapa cartográfico (papel dobrado, rosa dos ventos, pino roxo brand)
```

---

## 24. Sobre o Processo de Desenvolvimento

O Lectorium foi construído por Gabriel Silva, historiador sem formação em programação, usando um método de desenvolvimento baseado em:

1. **Inspeção visual** — identificação de problemas por comportamento observado, não por leitura de código
2. **Priorização por custo de mudança** — preferência por intervenções com menor superfície de impacto
3. **Delegação de implementação com retenção de decisão** — Gabriel define o quê e os critérios de aceitação; a implementação é produzida pela IA
4. **Refinamento incremental** — iteração sobre componentes existentes, não substituição total
5. **Compreensão ativa** — perguntas sobre o que existe antes de aceitar ou deletar

Este processo é documentado aqui porque qualquer desenvolvedor que assumir manutenção precisa entender que o conhecimento do sistema está distribuído entre o código, este documento, e o raciocínio do Criador. O `CHANGELOG.md` deve ser consultado para entender o histórico de decisões. O código atual é a fonte de verdade final.

---

*Documento gerado e mantido por A Cidade — entidade técnica do Lectorium.*
*Próxima revisão recomendada: a cada release minor (1.8.0, 1.9.0, etc.)*
