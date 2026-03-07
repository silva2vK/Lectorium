# Lectorium - Histórico de Edições (Changelog)

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
