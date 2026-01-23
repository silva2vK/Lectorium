
// Worker para Projeção DOM (V3.0 - Ultra Light)
// Remove dependência de OffscreenCanvas para máxima compatibilidade e velocidade.

interface OcrTaskData {
    segments: any[];
    width: number;
    height: number;
    scale: number;
}

self.onmessage = (e: MessageEvent<OcrTaskData>) => {
    const { segments, width, height, scale } = e.data;
    try {
        const mappedWords = processSegments(segments, width, height, scale);
        const markdown = segments.map(s => s.t || "").join('\n\n');
        self.postMessage({ success: true, data: mappedWords, markdown });
    } catch (err: any) {
        self.postMessage({ success: false, error: err.message });
    }
};

function processSegments(segments: any[], w: number, h: number, scale: number) {
    const mappedWords: any[] = [];
    const originalW = w / scale;
    const originalH = h / scale;

    for (const seg of segments) {
        const box = seg.b;
        const fullText = seg.t;
        const column = seg.c || 0;

        if (!box || box.length !== 4 || !fullText) continue;
        
        const [ymin, xmin, ymax, xmax] = box;
        
        const bX0 = (xmin / 1000) * originalW;
        const bY0 = (ymin / 1000) * originalH;
        const bX1 = (xmax / 1000) * originalW;
        const bY1 = (ymax / 1000) * originalH;
        
        const bWidth = bX1 - bX0;
        const bHeight = bY1 - bY0;

        const lines = fullText.split('\n').filter(l => l.trim().length > 0);
        const estimatedLineHeight = bHeight / lines.length;

        lines.forEach((lineText, lineIdx) => {
            const lineY0 = bY0 + (lineIdx * estimatedLineHeight);
            const lineY1 = lineY0 + estimatedLineHeight;
            
            const words = lineText.trim().split(/(\s+)/);
            const totalCharsInLine = lineText.length;
            
            let currentX = bX0;

            // Distribuição Geométrica por Densidade (Instantânea)
            for (const word of words) {
                if (word.length === 0) continue;
                
                // Calcula largura proporcional ao número de caracteres
                const wordWidth = (word.length / totalCharsInLine) * bWidth;
                
                if (!/^\s+$/.test(word)) {
                    mappedWords.push({
                        text: word,
                        confidence: 99,
                        bbox: { 
                            x0: currentX, 
                            y0: lineY0, 
                            x1: currentX + wordWidth, 
                            y1: lineY1 
                        },
                        column,
                        isRefined: true
                    });
                }
                currentX += wordWidth;
            }
        });
    }
    return mappedWords;
}
