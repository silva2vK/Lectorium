# Lectorium - Histórico de Edições (Changelog)

## 2026-03-14 — Sessão 13

- **Data/Hora (BRT):** 2026-03-14 ~14:00–20:30
- **Arquivos Modificados:** `workers/pdfAnnotationWorker.ts`, `hooks/usePdfAnnotations.ts`, `App.tsx`, `components/Dashboard.tsx`, `hooks/useSync.ts`, `hooks/useFileManager.tsx`, `services/blobRegistry.ts`, `docs/README.md`, `docs/BLACKBOX.md`
- **Versão:** 1.7.1

### Diagnóstico de metadados PDF

Análise do arquivo `Introdução_à_Pesquisa_Social_Qualitativa_-_Philipp_Mayring.pdf` revelou:
- 538 anotações burned, páginas 1, 2, 4, 5, 6, 7, 9 apenas
- `last_sync: 2026-03-08` — anotações pós-2026-03-08 existiam só no IDB, nunca burned
- Keywords: 242.812 chars — confirmou o problema de tamanho

### Bug raiz identificado e corrigido: limite de metadados PDF

**Causa raiz confirmada:** `pdf-lib` tem limite interno de ~65KB para `PDFString`. O JSON das anotações encoded em base64 sem compressão ultrapassava esse limite silenciosamente. O `catch (metaErr) {}` engolia o erro — anotações eram pintadas no PDF mas metadados não eram gravados. Na reabertura, o Painel Tático mostrava "SEM DADOS".

**Tentativa 1 (descartada):** compressão deflate-raw via `CompressionStream`. Reduziu ~65% o tamanho. Limite prático: ~2.800 anotações. Descartada em favor de solução definitiva.

**Tentativa 2 (descartada):** degradação progressiva em 3 níveis (completo → sem semanticData → sem texto). Resolveria o sintoma mas não eliminaria o limite.

**Solução definitiva:** migração para **XMP stream** (`Root.Metadata`). XMP é um stream XML no corpo do PDF — sem limite de tamanho documentado. Padrão ISO 32000-2:2017 (PDF 2.0).

**Implementação técnica:**
- `pdfAnnotationWorker.ts`: `buildXmpXml()` gera XML com custom namespace `xmlns:lectorium="http://lectorium.app/xmp/1.0/"`. JSON como UTF-8 em `<lectorium:data>` sem Base64. `injectXmpStream()` cria `PDFRawStream` com dict `{Type: Metadata, Subtype: XML}`, registra via `pdfDoc.context.register()`, aponta via `pdfDoc.catalog.set(PDFName.of('Metadata'), ref)`.
- Keywords agora contém apenas `LECTORIUM_XMP` como marcador de versão (sem dados).
- `usePdfAnnotations.ts`: `readFromXmp()` acessa `metadata.metadata._metadata` (campo interno estável do pdfjs), parse com `DOMParser`, extrai `<lectorium:data>`. `readFromKeywordsLegacy()` mantém suporte a PDFs antigos (comprimido e não-comprimido). Ordem: XMP primeiro, fallback Keywords.

**Pendência aberta:** verificar se `metadata.metadata._metadata` está acessível no pdfjs-dist v5 para PDFs salvos pelo novo worker. Sintoma de falha: Painel Tático mostra "SEM DADOS". Se `_metadata` for null, implementar leitura alternativa via `pdfDoc.catalog`.

### Bug corrigido: Painel Tático vazio ao abrir PDFs do Drive sem cache

**Causa raiz:** condição `if (!currentBlob) return` no `useEffect` de `usePdfAnnotations` bloqueava a leitura dos metadados burned quando o arquivo vinha do Drive sem cache local (blob chega com atraso assíncrono).
**Fix:** condição alterada para `if (!pdfDoc) return`. `pdfDoc` é suficiente para ler metadados XMP/Keywords. Hash check tornou-se opcional (só quando `currentBlob` disponível, como segundo render).

### Correções de autenticação Firebase/GIS

**Problema:** login GIS funcionava (One Tap aparecia) mas UI não atualizava após login no Android Chrome.
**Causa:** `prompt: ''` no `initTokenClient` falha silenciosamente no Android no primeiro login sem consentimento Drive prévio.
**Decisão:** GIS puro abandonado. Arquitetura definitiva: Firebase Auth para sessão + GIS apenas para `refreshDriveTokenSilently`.

- `App.tsx`: `onAuthStateChanged` agora é async. Quando token Drive expirado, chama `refreshDriveTokenSilently()` automaticamente → zero interação do usuário em reaberturas.
- `Dashboard.tsx`: `localStorage.getItem('drive_access_token')` → `getValidDriveToken()` (chave errada, sempre retornava null).
- `useSync.ts`: remove `setInterval(refreshQueue, 5000)` → evento `SYNC_QUEUE_EVENT` (violava regra anti-polling).
- `useFileManager.tsx`: token check explícito + captura `DRIVE_TOKEN_EXPIRED`.

### Atualizações de dependências

- `npm audit fix` — DOMPurify CVE corrigido (moderate severity)
- `npm install -g npm@11.11.1` — npm atualizado
- TipTap 2.27.x — atualizado de 2.11.5 (permanece ^2). TipTap 3 avaliado e rejeitado: rewrite completo quebraria `PaginationExtension` customizada. `@tiptap/extension-focus` agora disponível na 2.27.x (workaround CSS `.has-focus` pode ser removido).

### Documentação

- `README.md` reescrito: stack atualizada, arquitetura, tabela de tecnologias, instruções de instalação corretas.
- About do repositório GitHub atualizado.

---

## 2026-03-12 (tarde/noite) — Sessão 12

- **Data/Hora (BRT):** 2026-03-12 ~19:00–02:00
- **Arquivos Modificados:** `components/ApiKeyModal.tsx`, `utils/apiKeyUtils.ts`, `context/PdfContext.tsx`, `services/translationService.ts`, `components/pdf/layers/PdfTextLayer.tsx`
- **Resumo:** Reconstrução do `ApiKeyModal.tsx` após sobrescrita acidental pelo Gboard; fix de closure stale no fluxo de tradução em lote; remoção de letra morta em `translationService.ts`; acessibilidade nos overlays de tradução.

- **Causa raiz do incidente Gboard:**
  O Gboard no Android tem comportamento de compartilhamento de buffer entre abas do GitHub mobile. Ao editar dois arquivos simultaneamente, o conteúdo de um foi commitado no lugar do outro.
  **Protocolo estabelecido:** nunca editar mais de um arquivo por vez no GitHub mobile.

- **Bugs corrigidos:**
  - `ApiKeyModal.tsx`: reconstruído do zero.
  - `PdfContext.tsx`: closure stale no `useEffect` do `ocr-page-ready`. Fix via `isTranslationModeRef = useRef(false)`.
  - `translationService.ts`: removido `process.env.API_KEY` (letra morta no browser).

- **Features adicionadas:**
  - `PdfTextLayer.tsx`: acessibilidade nos overlays de tradução: `role="text"`, `aria-label`, `lang="pt-BR"`, `tabindex="0"`.

- **Pendências abertas:**
  - `lang="pt-BR"` hardcoded — adicionar prop `targetLang` quando suporte multi-idioma for necessário.

---

## 2026-03-12 (madrugada)

- **Data/Hora (BRT):** 2026-03-12 ~01:30–03:00
- **Arquivos Modificados:** `DocEditorLayout.tsx`, `DocCanvas.tsx`, `index.css`, `Icon.tsx`, `AiBubbleMenu.tsx`, `TopMenuBar.tsx`, `MindMapEditor.tsx`, `public/shortcut-mindmap.svg`
- **Resumo:** Fix de modais deslocados no Android; export PDF via `@media print`; ícones ausentes; `roundReplacer` no MindMapEditor; redesign do shortcut.

- **Bugs corrigidos:**
  - `DocEditorLayout.tsx`: `overflow-hidden` no wrapper raiz criava stacking context, confinando `position: fixed` dos modais.
  - `Icon.tsx`: 10 ícones sem paths adicionados.
  - `AiBubbleMenu.tsx` + `TopMenuBar.tsx`: `window.prompt()`/`confirm()` substituídos por inputs inline.

- **Features adicionadas:**
  - Export PDF via `@media print` funcional.
  - `MindMapEditor.tsx`: `roundReplacer` nos 3 pontos de `JSON.stringify`.
  - `shortcut-mindmap.svg`: redesenhado como mapa cartográfico dobrado.

---

## 2026-03-10 (tarde)

- **Arquivos Modificados:** `documentParser.ts`, `index.css`, `TablePropertiesModal.tsx`
- **Resumo:** Correção da discrepância de ~10% entre contagem de páginas no Google Docs e no Lectorium. Regras CSS para bordas de tabela. Expansão do modal de propriedades de tabela.

- **Causa raiz da discrepância de páginas:** `lineHeight` ignorado pelo TipTap → browser Android usava ~1.2 em vez de 1.5 ABNT → acumulava ~10% de diferença em documentos longos.

---

## 2026-03-07

- **Arquivos Modificados:** `MindMapEditor.tsx`, `package.json`
- **Resumo:** Transformação do editor de mapas mentais de 2D para 3D holográfico com Three.js + React Three Fiber.

---

## 2026-03-06

- **Arquivos Modificados:** `DocEditorContext.tsx`, `TopMenuBar.tsx`, `localFileService.ts`, `useFileManager.tsx`, `types.ts`
- **Resumo:** Substituição de `alert()` por `addNotification()`. Tipagem estrita de `storageMode`. Renomeação `useFileManager.ts` → `.tsx`.

---

## 2026-03-02

- **Arquivos Modificados:** `usePdfAnnotations.ts`
- **Resumo:** Anotações burned agora podem ser atualizadas (adição de tags).

---

## 2026-03-01

- **Resumo:** Criação do sistema de Memória Persistente (BLACKBOX.md + CHANGELOG.md).
