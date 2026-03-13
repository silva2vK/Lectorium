
import { generateEmbeddings } from "./aiService";
import { getVectorIndex, saveVectorIndex } from "./storageService";
import { computeSparseHash } from "../utils/hashUtils";
import { EmbeddingChunk, SearchResult, VectorIndex } from "../types";

const MAX_CHUNK_LENGTH = 1000; // Caracteres por chunk
const MAX_CHUNKS = 300;        // Limite de chunks por documento — evita explosão de custo em docs grandes
const EMBEDDING_MODEL = 'text-embedding-004';

// --- MATH UTILS (Bare Metal JS) ---

/**
 * Calcula a Similaridade de Cosseno entre dois vetores Float32Array.
 * Otimizado para loops quentes.
 * Retorna valor entre -1 e 1 (1 = idêntico).
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Divide o texto em chunks inteligentes respeitando sentenças.
 * Limita a MAX_CHUNKS chunks por documento via amostragem uniforme —
 * preserva cobertura de início, meio e fim mesmo em documentos muito longos.
 */
function smartChunking(fullText: string): string[] {
    const chunks: string[] = [];
    const text = fullText.replace(/\r\n/g, '\n');
    const rawBlocks = text.split(/\n\s*\n/);
    
    for (const block of rawBlocks) {
        if (block.length <= MAX_CHUNK_LENGTH) {
            if (block.trim().length > 20) chunks.push(block.trim());
        } else {
            const sentences = block.match(/[^.!?]+[.!?]+[\])'"]*/g) || [block];
            let currentChunk = "";
            
            for (const sentence of sentences) {
                if (currentChunk.length + sentence.length > MAX_CHUNK_LENGTH) {
                    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
                    currentChunk = sentence;
                } else {
                    currentChunk += sentence;
                }
            }
            if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
        }
    }

    // Amostragem uniforme para documentos com muitos chunks
    // 300 chunks × ~1000 chars = ~220 páginas A4 de cobertura efetiva
    if (chunks.length > MAX_CHUNKS) {
        const step = chunks.length / MAX_CHUNKS;
        return Array.from({ length: MAX_CHUNKS }, (_, i) => chunks[Math.floor(i * step)]);
    }

    return chunks;
}

// --- ORCHESTRATION ---

/**
 * Indexa um documento para busca semântica.
 * Verifica integridade via Hash antes de reprocessar.
 *
 * Otimização: Usa hash do texto extraído (textHash) além do hash do arquivo (contentHash).
 * Se apenas o binário mudou (anotações), mas o texto é igual, evita reprocessamento.
 */
export async function indexDocumentForSearch(
    fileId: string, 
    blob: Blob, 
    extractedText: string
): Promise<void> {
    const currentFileHash = await computeSparseHash(blob);
    
    const textBuffer = new TextEncoder().encode(extractedText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', textBuffer);
    const currentTextHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 1. Check Existing Index
    const existingIndex = await getVectorIndex(fileId);
    
    if (existingIndex && existingIndex.model === EMBEDDING_MODEL) {
        if (existingIndex.contentHash === currentFileHash) {
            console.log(`[RAG] Índice válido (Arquivo Intacto) para ${fileId}`);
            return;
        }
        if (existingIndex.textHash === currentTextHash) {
            console.log(`[RAG] Índice válido (Texto Intacto) para ${fileId}. Apenas metadados mudaram.`);
            const updatedIndex = { ...existingIndex, contentHash: currentFileHash, updatedAt: Date.now() };
            await saveVectorIndex(updatedIndex);
            return;
        }
    }

    // 2. Process New Index
    console.log(`[RAG] Gerando novos embeddings para ${fileId}...`);
    
    const textChunks = smartChunking(extractedText);
    if (textChunks.length === 0) return;

    const vectors = await generateEmbeddings(textChunks);

    // Guard: vectors pode ser menor que textChunks em falha parcial da API Gemini.
    // Filtra chunks sem vetor válido em vez de persistir undefined no índice.
    const chunks: EmbeddingChunk[] = textChunks
        .map((text, i) => ({ text, vector: vectors[i], id: `${fileId}-${i}` }))
        .filter(c => c.vector instanceof Float32Array && c.vector.length > 0);

    if (chunks.length === 0) {
        console.warn(`[RAG] Nenhum embedding válido gerado para ${fileId}. Indexação abortada.`);
        return;
    }

    const index: VectorIndex = {
        fileId,
        contentHash: currentFileHash,
        textHash: currentTextHash,
        model: EMBEDDING_MODEL,
        updatedAt: Date.now(),
        chunks
    };

    await saveVectorIndex(index);
    console.log(`[RAG] Indexação concluída: ${chunks.length} chunks.`);
}

/**
 * Realiza busca semântica no documento.
 * Fallback: se threshold 0.4 eliminar todos os resultados, retorna os topK mais
 * relevantes sem filtro — garante que o Kalaki sempre receba contexto do documento.
 */
export async function semanticSearch(
    fileId: string, 
    query: string, 
    topK: number = 5
): Promise<SearchResult[]> {
    const index = await getVectorIndex(fileId);
    if (!index || !index.chunks.length) {
        console.warn("[RAG] Índice não encontrado ou vazio.");
        return [];
    }

    const [queryVector] = await generateEmbeddings([query]);
    if (!queryVector) return [];

    // Linear scan — rápido para < 10k vetores, adequado para escopo do Lectorium
    const results = index.chunks.map(chunk => ({
        text: chunk.text,
        score: cosineSimilarity(queryVector, chunk.vector),
        page: chunk.page
    }));

    const filtered = results
        .filter(r => r.score > 0.4)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    // Fallback: threshold eliminou tudo — retorna os mais relevantes sem filtro de score
    if (filtered.length === 0) {
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    return filtered;
}
