# Lectorium - Caixa-Preta (Arquitetura e Fluxo)

## Visão Geral do Sistema
O Lectorium é o "Domo Cognitivo", uma infraestrutura soberana focada na extração de dados (Estado do Conhecimento), análise historiográfica rigorosa e impacto social real, servindo como a ferramenta definitiva para o mestrado no PPGED.
O sistema é regido por 4 Faculdades:
1. **Media Archaeology & Rendering:** Foco na renderização forense de PDFs via PDF.js, Canvas API e Web Workers. O arquivo é um objeto temporal.
2. **Rationality Engine (Editor):** Foco na estruturação semântica e rigor metodológico (ABNT) usando Tiptap/ProseMirror. A escrita é a manifestação da razão.
3. **Cosmotechnics (Storage & Data):** Foco na soberania de dados (Local-First) usando IndexedDB, OPFS e Google Drive como espelho.
4. **Synthetic Reason (AI & Oracle):** Foco no RAG Local e extração de dados usando Google GenAI SDK (@google/genai), atuando como um oráculo para síntese e juízo crítico.

## Fluxo de Dados (Data Flow)
- **Local-First Absoluto:** Todos os dados (PDFs, anotações, documentos textuais, mapas mentais) residem primariamente no navegador do usuário (IndexedDB e OPFS).
- **IndexedDB:** Atua como o catálogo bibliográfico pessoal e armazena metadados estruturados, estado dos documentos (.lect) e configurações.
- **OPFS (Origin Private File System):** Utilizado para armazenamento de arquivos pesados (PDFs) para garantir performance e persistência local.
- **Google Drive (Sync):** Funciona apenas como um espelho/backup. A sincronização é feita de forma soberana, garantindo que o usuário tenha controle total sobre seus dados.
- **Single Source of Truth:** O estado JSON do Tiptap é a realidade para documentos textuais; o HTML é apenas uma projeção.

## Mapa de Componentes Principais
- **`PdfViewer` / `PdfPage`:** Renderização de PDFs usando PDF.js. Lida com a camada de visualização e anotações.
- **`DocEditor`:** Editor de texto rico baseado em Tiptap, configurado para rigor acadêmico (ABNT).
- **`OperationalArchive`:** Interface principal para gerenciamento de arquivos, busca e visualização de metadados.
- **`VisualChart`:** Componente autoral (em transição de Recharts para SVG/Canvas nativo) para visualização de dados extraídos.
- **`AiChatPanel` / `DocAiSidebar`:** Interfaces de comunicação com o Oráculo (Gemini API) para RAG e assistência na escrita.
- **`MindMapEditor`:** Ferramenta de visualização de conexões e estruturação de ideias.
- **`LectAdapter` / `UniversalMediaAdapter`:** Conversores e adaptadores para o formato proprietário `.lect`.

## Palavras-chave e Padrões
- **Stack:** React 19, Vite, TailwindCSS.
- **Estética:** Tema "The Maker" (Perfeccionismo Pragmático, Acessibilidade Universal).
- **IA:** `@google/genai` (Gemini 3.0 Pro/Flash), RAG Local, Extração Estruturada.
- **Armazenamento:** IndexedDB (`idb`), OPFS, LocalStorage.
- **Ícones:** Transição de `lucide-react` para dicionário SVG autoral (`icons.ts`).
- **Gráficos:** Transição de bibliotecas pesadas para SVG/Canvas nativo.
- **Zero-Backend Proprietário:** Toda a lógica reside no cliente (navegador).

## Pendências / Dívida Técnica
- **Substituição do `lucide-react`:** Concluir a criação do `icons.ts` e refatorar todos os componentes para usar os SVGs autorais, removendo a dependência.
- **Refinamento do `VisualChart`:** Expandir a implementação autoral em SVG/Canvas para suportar múltiplos tipos de gráficos (além de barras simples) e remover completamente qualquer resquício de bibliotecas externas de gráficos.
- **Web Workers:** Implementar processamento assíncrono pesado (ex: parsing de PDF, embeddings) em Web Workers para não travar a UI (Performance Cronológica).
- **Tagging Interativa:** Implementar a funcionalidade de clicar em trechos de texto para adicionar tags estruturadas.
- **Geração Automática de Tabelas/Gráficos:** Desenvolver a lógica de IA para analisar tags e gerar visualizações de dados automaticamente.
- **Integração Google Drive:** Finalizar o fluxo de importação/exportação bidirecional robusta.
