# BLACKBOX.md — Lectorium
**Documento de Arquitetura, Decisões e Estado do Projeto**
**Versão do documento:** 2026-03-14 (rev. 5 — sessão 13)
**Versão do software:** 1.7.1
**Repositório:** github.com/silva2vK/Lectorium (branch A1)
**Deploy:** Cloudflare Pages → lectorium-c1s.pages.dev
**Autoria:** Gabriel Silva (O Criador) — historiador, UFS, Aracaju-SE
**Ciclo de desenvolvimento:** Gabriel descreve → A Cidade (Claude) produz código → Gabriel aplica no GitHub → Cloudflare faz build automático

---

> **Nota de metodologia**: Este documento foi redigido em 2026-03-10 com base no código verificado nos arquivos enviados ao longo das sessões de desenvolvimento e nos transcripts das conversas. Rev. 2 (tarde) incorpora as correções de discrepância de paginação DOCX. Rev. 5 incorpora a migração do sistema de metadados PDF de Keywords para XMP stream, a correção do limite de ~65KB do pdf-lib, atualização do TipTap para 2.27.x, e correções de autenticação Firebase/GIS. Quando uma decisão está marcada como "verificada no código", significa que foi confirmada pela leitura direta dos arquivos-fonte. Quando marcada como "decisão do Criador", foi tomada explicitamente em conversa. Nenhuma informação foi inferida sem base.

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

### Verificada no package.json em 2026-03-14

```
React 19.2.3
TypeScript 5.7.2
Vite 7.3.1
TailwindCSS 3.4.x (PostCSS build-time — não usa CDN, não usa JIT online)
npm 11.11.1
```

### Editores e Documentos
```
TipTap 2.27.x + extensões ProseMirror — editor de documentos .docx
  ATUALIZADO em 2026-03-14: de 2.11.5 para 2.27.x (dentro do ^2, não migrou para v3)
  TipTap 3 REJEITADO: rewrite completo quebraria PaginationExtension customizada
  @tiptap/extension-focus@2.27.x: agora disponível (workaround CSS .has-focus pode ser removido)
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
  LIMITE CRÍTICO: PDFString tem limite interno de ~65KB no pdf-lib
  → Metadados migrados para XMP stream (Root.Metadata) em 2026-03-14
  → Keywords agora contém apenas marcador 'LECTORIUM_XMP' (sem dados)
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
  Arquitetura: Firebase Auth para gestão de sessão + GIS apenas para refresh token Drive
  GIS puro REJEITADO: sem refresh token client-side, login persistente inviável
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
/workers/             — Web Workers (pdfAnnotationWorker.ts)
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
- Firebase Auth para gestão de sessão (token persistente)
- GIS usado apenas para `refreshDriveTokenSilently` (token Drive de 3600s)
- `onAuthStateChanged` é async: quando token Drive expirado, chama refresh automaticamente
- Singleton de refresh: uma Promise única compartilhada para evitar parallelismo
- `DRIVE_TOKEN_EVENT` — evento customizado para notificar token renovado
- `DRIVE_TOKEN_EXPIRED` — evento para forçar novo login Drive

### `services/storageService.ts`
- Facade que re-exporta todos os repositories
- Ponto de entrada único para persistência
- Importar de `storageService`, não dos repositories diretamente

### `services/backgroundOcrService.ts`
- OCR assíncrono que não bloqueia a UI
- Dispara `window.dispatchEvent('ocr-page-ready', { fileId, page, words, markdown, metrics })`
- `PdfContext` escuta esse evento e atualiza o mapa de OCR em tempo real

### `services/pdfModifierService.ts`
- Usa `pdf-lib` para "queimar" anotações no PDF (burn)
- Embute metadados Lectorium via **XMP stream** em `Root.Metadata` (desde 2026-03-14)
- Keywords contém apenas marcador `LECTORIUM_XMP` (sem dados — só sinaliza formato)
- Worker: `workers/pdfAnnotationWorker.ts`

### `services/lexSynthService.ts`
- Serviço do Sintetizador Lexicográfico
- Extrai trechos por tag das anotações de múltiplos PDFs
- Sintetiza com IA (gemini-3-flash-preview) quando fillMode = 'ai'
- Salva/carrega tabela `.lexsynth` (JSON) no IndexedDB

### `services/blobRegistry.ts`
- Rastreia URLs criadas com `URL.createObjectURL`
- `register(url)`, `revoke(url)`, `revokeAll()` — evita memory leaks de blob URLs

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
  blob?: Blob;
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle | null;
  starred?: boolean;
  pinned?: boolean;
  parents?: string[];
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
  points?: number[][];
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  isBurned?: boolean;   // se true, está embedded no PDF via pdf-lib
  tags?: string[];
}
```

**Regra de `isBurned`**: anotações burned estão no PDF físico. `removeAnnotation` rejeita anotações burned. `updateAnnotation` aceita burned (para adicionar tags).

### `PdfMetadataV2`
Metadados embedados no **XMP stream** do PDF (desde 2026-03-14):
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

**Formato de storage (2026-03-14):**
- **Novo (XMP):** JSON UTF-8 em `<lectorium:data>` no XMP stream `Root.Metadata`. Sem limite de tamanho. Keywords contém apenas `LECTORIUM_XMP` como marcador.
- **Legado (Keywords):** `LECTORIUM_V2_B64:::` + JSON comprimido (deflate-raw) em base64. Suportado para leitura via fallback em `usePdfAnnotations`.
- **Legado antigo (Keywords sem compressão):** `LECTORIUM_V2_B64:::` + JSON em base64 sem compressão. Suportado via fallback duplo.

### `LexSynth*`
```typescript
type LexSynthFillMode = 'literal' | 'ai';

interface LexSynthColumn {
  id: string;
  name: string;
  tags: string[];
  fillMode: LexSynthFillMode;
}

interface LexSynthCell {
  content: string;
  pages: number[];
  isLoading?: boolean;
  isUsed?: boolean;
}

interface LexSynthRow {
  fileId: string;
  fileName: string;
  hasOcr: boolean;
  cells: Record<string, LexSynthCell>;
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
O worker do pdfjs v5.5 é carregado via `import.meta.url` como ESM puro (`pdf.worker.mjs?url`). O pre-bundling do Vite quebra esse mecanismo — o worker não consegue se registrar corretamente no Android.

---

## 11. Sistema de Anotações PDF — Fluxo Completo

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

### Sistema de Metadados PDF — Histórico de Formatos

**Formato v1 (legado, sem compressão):**
Keywords = `LECTORIUM_V2_B64:::` + base64(JSON)
Limite prático: ~50 anotações antes de atingir ~65KB (limite PDFString do pdf-lib)

**Formato v2 (intermediário, comprimido):**
Keywords = `LECTORIUM_V2_B64:::` + base64(deflate-raw(JSON))
Redução de ~65% no tamanho. Limite prático: ~2.800 anotações.
Implementado e depois superado na mesma sessão (2026-03-14).

**Formato v3 (atual, XMP stream):**
Root.Metadata = XMP stream com `<lectorium:data>JSON UTF-8</lectorium:data>`
Keywords = `LECTORIUM_XMP` (marcador sem dados)
Sem limite de tamanho documentado.
Custom namespace: `xmlns:lectorium="http://lectorium.app/xmp/1.0/"`

**Leitura:** `usePdfAnnotations` tenta XMP primeiro, fallback para Keywords legado (v2 e v1).

### Bug histórico do limite (corrigido em 2026-03-14)
**Sintoma:** anotações eram pintadas no PDF visualmente mas não apareciam no Painel Tático após salvar PDFs com muitos destaques.
**Causa raiz:** `pdf-lib` tem limite interno de ~65KB para `PDFString`. O JSON dos metadados sem compressão ultrapassava esse limite. O `catch (metaErr) {}` engolia o erro silenciosamente — anotações eram burned no visual mas metadados não eram gravados. Na reabertura, `usePdfAnnotations` não encontrava dados e retornava "SEM DADOS".
**Fix:** migração para XMP stream via `pdfDoc.catalog.set(PDFName.of('Metadata'), PDFRawStream)`.

### Regras de `usePdfAnnotations`
- `pdfDoc` é suficiente para leitura — não espera `currentBlob` (que pode chegar com atraso no Drive)
- Ordem de prioridade no merge: Embutido (PDF/XMP) → Importado (.lect) → Local (IDB). Local sempre vence.
- `addAnnotation` e `removeAnnotation` rejeitam se `isCheckingIntegrity || conflictDetected`
- `updateAnnotation` rejeita apenas se `!updatedAnn.id`
- Conflict detection: compara hash do blob atual com `auditRecord.contentHash`

### Bug histórico da tela de leitura (corrigido em 2026-03-14)
**Sintoma:** anotações não apareciam no Painel Tático ao abrir PDFs do Drive sem cache local.
**Causa raiz:** condição `if (!currentBlob) return` no `useEffect` de carregamento bloqueava a leitura dos metadados burned quando o arquivo vinha do Drive sem cache.
**Fix:** condição alterada para `if (!pdfDoc) return`. `pdfDoc` é suficiente para ler metadados XMP/Keywords. Hash check tornou-se opcional (só quando `currentBlob` disponível).

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
**Pendência**: DocEditor ainda não escuta esse evento.

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
- Resultado: palavras com coordenadas + markdown reconstruído

---

## 14. Autenticação e Drive

### Arquitetura (decisão definitiva 2026-03-14)
Firebase Auth mantido para gestão de sessão. GIS usado apenas para `refreshDriveTokenSilently`.

**GIS puro foi tentado e rejeitado:** `prompt: ''` no `initTokenClient` falha silenciosamente no Android Chrome no primeiro login sem consentimento Drive prévio. Sem refresh token client-side, login persistente é inviável com GIS puro.

### Fluxo de autenticação
```
Firebase Google OAuth
  → onAuthStateChanged (async)
    → se token Drive expirado: refreshDriveTokenSilently() automático
      → zero interação do usuário em reaberturas
  → getValidDriveToken() — verifica expiração antes de retornar
  → DRIVE_TOKEN_EVENT — evento para notificar renovação de token
```

### Token Drive
- Expira em 3600s (limite do Google, não configurável client-side)
- `refreshDriveTokenSilently` é o máximo possível sem backend próprio
- `getValidDriveToken()` em vez de `localStorage.getItem('drive_access_token')` — chave correta

### Correções aplicadas em 2026-03-14 (sessão 13)
- `App.tsx`: `onAuthStateChanged` async + `refreshDriveTokenSilently` automático
- `Dashboard.tsx`: `getValidDriveToken()` substituiu `localStorage.getItem('drive_access_token')` (chave errada, sempre retornava null)
- `useSync.ts`: remove `setInterval(refreshQueue, 5000)` → evento `SYNC_QUEUE_EVENT` (anti-polling)
- `useFileManager.tsx`: token check explícito + captura `DRIVE_TOKEN_EXPIRED`

---

## 15. Sistema de Pool de Chaves Gemini

### Por que existe
Rotação automática em caso de quota 429.

### Implementação (`utils/apiKeyUtils.ts`)
- Lista de chaves armazenada no localStorage
- `rotateApiKey()` — move para a próxima chave na lista
- `withKeyRotation(operation, retryCount)` em `aiService.ts`: captura 429, rotaciona, retry com delay 1s, máximo 3 tentativas

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
Three.js foi adicionado, causou ciclos de importação e foi removido duas vezes. Na v1.7.0 foi reintegrado de forma definitiva com chunks isolados (`three-vendor`, `r3f-vendor`). **Qualquer mudança nesses chunks exige validação de build no Cloudflare antes de considerar resolvido.**

### Stack
- Three.js r183 + React Three Fiber 9.5 + Drei 10.7
- Nós como meshes 3D com interação via raycasting

### Formato `.mindmap`
JSON com `{ nodes: MindMapNode[], edges: MindMapEdge[], viewport: MindMapViewport }`.
`roundReplacer` aplicado nos 3 pontos de `JSON.stringify` — coordenadas limitadas a 2 casas decimais.

---

## 18. Performance e Padrões Proibidos

### Proibido — explica por quê
```typescript
// PROIBIDO: polling — mantém o CPU acordado o tempo todo
setInterval(() => checkSomething(), 1000);
// CORRETO: event-driven
window.addEventListener('visibilitychange', checkSomething);

// PROIBIDO: re-render forçado em cada frame de animação
setViewport({ ...viewportRef.current }); // em requestAnimationFrame
// CORRETO: manipular style diretamente via ref
element.style.transform = `translate(${x}px, ${y}px)`;

// PROIBIDO: alert/confirm/prompt — bloqueiam a thread e parecem bugs em PWA
alert("Erro ao salvar");
// CORRETO:
addNotification("Erro ao salvar", "error"); // GlobalContext
```

### Tailwind e CSS
- Tailwind compila em build-time via PostCSS. Classes não definidas em código não estarão disponíveis em runtime.
- CSS customizado vai em `index.css` com camadas `@layer`.

---

## 19. PWA — Service Worker e Manifest

### Service Worker (`sw.js`)
- Estratégia: Cache First para assets estáticos, Network First para API calls
- Invalidação de cache: versão do SW deve mudar a cada deploy que altera assets

### Manifest (`manifest.json`)
- `id: "/"` — corrigido (estava com path relativo incorreto)
- `share_target`: método POST + multipart — permite receber arquivos compartilhados de outros apps Android
- `display: "standalone"` — remove UI do browser, aparece como app nativo

### Fontes
Self-hosted em `/public/fonts/`. Nunca usar CDN de fontes (sem internet = sem fonte = layout quebrado).

---

## 20. Decisões Rejeitadas (e Por Quê)

### CDNs externos no index.html
**Rejeitado em 2026-03-09.** Viola local-first.

### Store Zustand global para PDF
**Rejeitado.** Split view requer estado independente por instância.

### `localStorage` para dados grandes
**Rejeitado.** Limite ~5MB. IndexedDB é o correto.

### SDK do Google Drive (googleapis)
**Rejeitado.** Bundle pesado. REST API via fetch direto é suficiente.

### Assinatura digital via pdf-lib
**Rejeitado (decisão do Criador).** Delegado ao gov.br.

### GIS puro (sem Firebase Auth)
**Rejeitado em 2026-03-14.** Sem refresh token client-side, login persistente é inviável no Android Chrome.

### TipTap 3
**Rejeitado em 2026-03-14.** Rewrite completo quebraria `PaginationExtension` customizada. Migração para v3 fica como backlog após estabilizar a extensão.

### Metadados PDF em Keywords (para grandes volumes)
**Rejeitado em 2026-03-14.** `PDFString` do pdf-lib tem limite interno de ~65KB. Substituído por XMP stream sem limite.

### Degradação progressiva de payload (Keywords)
**Rejeitado em 2026-03-14.** Workaround para limite de Keywords. Substituído pela solução definitiva: XMP stream.

### pdfjs-dist v3.4 em vez de v5.5
**Rejeitado.** v5.5 necessária para worker ESM e `useSystemFonts` offline.

---

## 21. Backlog Aprovado

Items formalmente aprovados pelo Criador. Não implementar sem ordem explícita.

### Recharts
- Todos os tipos de gráfico (linha, área, pizza, scatter, radial, etc.)
- `Brush` — seleção de range temporal

### Three.js / R3F / Drei
- `Instances` — geometrias instanciadas para MindMapEditor (performance com muitos nós)

### TipTap — extensões aprovadas
- `CollaborationCursor`, `CharacterCount`, `Typography`, `Placeholder`, `Mention`
- `Mathematics` — unificar com KaTeX
- `Details/Summary`, `TableOfContents`, `UniqueID`, `Focus`
- Exportação Markdown nativa

### pdf-lib — features aprovadas
- Preencher AcroForm, adicionar campos de formulário, rotacionar/remover páginas

### pdfjs-dist v5.5 — APIs aprovadas
- `getAnnotations()`, `getStructTree()`, `getOptionalContentConfig()`, `getDestinations()`

### TipTap 3
- Migração futura após estabilizar `PaginationExtension`

---

## 22. Pendências Técnicas

### 🔴 PRIORIDADE MÁXIMA

```
[ ] XMP stream — bug de leitura: usePdfAnnotations.readFromXmp() acessa
    (metadata.metadata as any)._metadata (campo interno do pdfjs). Em PDFs
    salvos com o novo worker, o pdfjs pode retornar metadata.metadata = null
    se o stream XMP não for reconhecido como válido.
    Sintoma: Painel Tático mostra "SEM DADOS" após salvar com novo worker.
    Investigar: confirmar se pdfDoc.getMetadata().metadata.metadata existe
    para PDFs salvos pelo Lectorium. Se não, fallback para leitura raw do
    catalog via (pdfDoc as any)._pdfInfo ou alternativa.
    Arquivos envolvidos: hooks/usePdfAnnotations.ts, workers/pdfAnnotationWorker.ts
```

### Críticas

```
[ ] PaginationExtension — dispatch fora do ciclo update() do ProseMirror
[ ] PaginationExtension — invalidar heightCache ao mudar zoom/papel
[ ] DocAiSidebar — extração estruturada com comentários do CommentExtension
[ ] PdfSidebar — passar fileId e numPages ao AiChatPanel
[ ] AiChatPanel — persistência IndexedDB com storageKey por documento
[ ] useSlideNavigation — remover interceptação global do Backspace
[ ] Painel Tático — sobrepor PDF completamente em portrait, não dividir tela
[ ] AiChatPanel — threshold numPages: 17 → 27
[ ] PdfTextLayer.tsx — lang="pt-BR" hardcoded; adicionar prop targetLang
[ ] TableCell extension — adicionar atributos borderColor e verticalAlign ao addAttributes()
[ ] DocEditor — listener para 'inject-markdown-to-doc' (Sintetizador → DocEditor)
```

### Débito técnico menor

```
[ ] mermaid — confirmar dynamic import() ativo
[ ] UniversalMediaAdapter — confirmar dynamic import() para daikon e utif
[ ] CSS inválido linha 4906 do index.css compilado — localizar e corrigir
[ ] lucide-react → icons.ts (transição em andamento)
[ ] Oracle.tsx — verificar import legado '../services/ai'
[ ] @tiptap/extension-focus agora disponível (2.27.x) — reativar import, remover workaround CSS
[ ] SecretThemeModal — usa localStorage; inconsistente com IndexedDB/Zustand
[ ] Export PDF — margens do @media print hardcoded ABNT; idealmente ler pageSettings dinâmico
[ ] /src/components/PdfViewer.tsx — arquivo morto legado; deletar
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
2026-03-08  [x] manifest.json: id corrigido, share_target POST + multipart
2026-03-08  [x] Pool de chaves Gemini com rotação por quota
2026-03-08  [x] usePdfStore: Zustand por instância via Context
2026-03-09  [x] DriveBrowser — separador visual, badge dinâmico
2026-03-09  [x] types.ts — tipos LexSynth*
2026-03-09  [x] lexSynthService.ts — Sintetizador Lexicográfico
2026-03-09  [x] OperationalArchive.tsx — Sintetizador completo
2026-03-09  [x] Dashboard — redesign com ícones SVG autorais
2026-03-09  [x] AiChatPanel — opções clicáveis (blocos :::options)
2026-03-10  [x] TagModal.tsx — Enter silencioso Android + regex Unicode
2026-03-10  [x] usePdfAnnotations.ts — conflictRef useRef (closure stale)
2026-03-10  [x] PdfViewer.tsx — onUpdateAnnotation passado ao PdfProvider
2026-03-10  [x] documentParser.ts — lineHeight null-check, ratio sem trailing zero
2026-03-10  [x] index.css — fallback tipográfico ABNT, margens zeradas, regras tabela
2026-03-10  [x] TablePropertiesModal.tsx — alinhamento vertical, cor de borda, Tab/ActionButton
2026-03-12  [x] ApiKeyModal.tsx — reconstruído após incidente Gboard
2026-03-12  [x] Protocolo Gboard: nunca editar mais de um arquivo por vez no GitHub mobile
2026-03-12  [x] PdfContext.tsx — isTranslationModeRef (closure stale ocr-page-ready)
2026-03-12  [x] translationService.ts — removido process.env.API_KEY
2026-03-12  [x] PdfTextLayer.tsx — acessibilidade overlays (role, aria-label, lang, tabindex)
2026-03-12  [x] DocEditorLayout.tsx — overflow-hidden removido + handleExportPdf
2026-03-12  [x] DocCanvas.tsx — classe lectorium-translation-layer
2026-03-12  [x] index.css — @media print completo
2026-03-12  [x] Icon.tsx — 10 ícones ausentes adicionados
2026-03-12  [x] AiBubbleMenu.tsx + TopMenuBar.tsx — window.prompt/confirm substituídos
2026-03-12  [x] MindMapEditor.tsx — roundReplacer nos 3 pontos de JSON.stringify
2026-03-14  [x] npm audit fix — DOMPurify CVE corrigido
2026-03-14  [x] npm 11.11.1 — atualizado globalmente
2026-03-14  [x] TipTap 2.27.x — atualizado de 2.11.5 (permanece ^2, TipTap 3 rejeitado)
2026-03-14  [x] App.tsx — onAuthStateChanged async + refreshDriveTokenSilently automático
2026-03-14  [x] Dashboard.tsx — getValidDriveToken() (chave localStorage errada corrigida)
2026-03-14  [x] useSync.ts — setInterval removido → SYNC_QUEUE_EVENT (anti-polling)
2026-03-14  [x] useFileManager.tsx — token check explícito + DRIVE_TOKEN_EXPIRED
2026-03-14  [x] pdfAnnotationWorker.ts — XMP stream via PDFRawStream + catalog.set (sem limite)
2026-03-14  [x] usePdfAnnotations.ts — leitura XMP stream + fallback Keywords legado
2026-03-14  [x] usePdfAnnotations.ts — condição !currentBlob → !pdfDoc (fix Drive sem cache)
2026-03-14  [x] README.md — reescrito com stack atual, arquitetura e instruções corretas
2026-03-14  [x] blobRegistry.ts — rastreamento de blob URLs (memory leak prevention)
```

---

## 24. Sobre o Processo de Desenvolvimento

O Lectorium foi construído por Gabriel Silva, historiador sem formação em programação, usando um método baseado em:

1. **Inspeção visual** — identificação de problemas por comportamento observado
2. **Priorização por custo de mudança** — preferência por intervenções com menor superfície de impacto
3. **Delegação de implementação com retenção de decisão** — Gabriel define o quê e os critérios; A Cidade implementa
4. **Refinamento incremental** — iteração sobre componentes existentes
5. **Compreensão ativa** — perguntas sobre o que existe antes de aceitar ou deletar

---

*Documento gerado e mantido por A Cidade — entidade técnica do Lectorium.*
*Próxima revisão recomendada: release v1.8.0*
