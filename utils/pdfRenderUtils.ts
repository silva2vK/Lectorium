
const attemptedFonts = new Set<string>();

export const tryAutoDownloadFont = async (rawFontName: string) => {
  if (!navigator.onLine) return;
  let cleanName = rawFontName.replace(/['"]/g, '').trim();
  if (cleanName.includes('+')) cleanName = cleanName.split('+')[1];
  const familyName = cleanName.split('-')[0];
  const skipList = ['Arial', 'Helvetica', 'Times', 'Courier', 'Verdana', 'Georgia', 'sans-serif', 'serif', 'monospace'];
  
  if (attemptedFonts.has(familyName) || skipList.some(s => familyName.toLowerCase().includes(s.toLowerCase()))) return;

  attemptedFonts.add(familyName);
  try {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familyName)}:wght@400;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      await document.fonts.load(`12px "${familyName}"`);
  } catch (e) {}
};

/**
 * Algoritmo "White River V3" (Multi-Channel Topology)
 * Detecta múltiplos "rios" (calhas verticais vazias) para suportar tabelas e layouts de N colunas.
 * Retorna um array de coordenadas X onde ocorrem as divisões.
 */
function detectColumnSplits(items: any[], viewportWidth: number, viewportHeight: number): number[] {
    const splits: number[] = [];
    
    // 1. Filtragem Inteligente (De-noising)
    // Ignora cabeçalhos/rodapés extremos e elementos full-width que cortam a página
    const safeTop = viewportHeight * 0.08;
    const safeBottom = viewportHeight * 0.92;
    
    const layoutItems = items.filter(item => {
        // Ignora verticais extremos
        if (item.y < safeTop || item.y > safeBottom) return false;
        // Ignora itens muito pequenos (ruído de OCR)
        if (item.width < 4) return false;
        // CRÍTICO: Ignora itens que ocupam quase toda a largura (ex: Títulos/Linhas que cruzam colunas)
        // Se ocupar mais de 85% da largura, provavelmente é um elemento de layout global, não conteúdo de coluna.
        if (item.width > (viewportWidth * 0.85)) return false;
        
        return true;
    });

    if (layoutItems.length < 15) return []; // Poucos itens para determinar colunas

    // 2. Histograma de Ocupação Horizontal (Resolução fina)
    const bucketSize = 4; // 4px de precisão
    const numBuckets = Math.ceil(viewportWidth / bucketSize);
    const densityMap = new Int16Array(numBuckets).fill(0);

    for (const item of layoutItems) {
        const startBucket = Math.floor(item.x / bucketSize);
        const endBucket = Math.floor((item.x + item.width) / bucketSize);
        
        // Incrementa peso nos buckets ocupados
        for (let i = startBucket; i <= endBucket; i++) {
            if (i >= 0 && i < numBuckets) densityMap[i]++;
        }
    }

    // 3. Varredura Linear por Vales (Gaps)
    // Procuramos sequências de zeros (ou quase zeros) que indicam um rio.
    const searchStart = Math.floor((viewportWidth * 0.05) / bucketSize); // Ignora 5% das bordas
    const searchEnd = Math.floor((viewportWidth * 0.95) / bucketSize);
    
    const MIN_GAP_WIDTH_PX = 14; // Largura mínima visual para considerar uma coluna (calha)
    const NOISE_TOLERANCE = 1; // Permite 1 pixel perdido/ruído no caminho

    let currentGapStart = -1;

    for (let i = searchStart; i <= searchEnd; i++) {
        const isEmpty = densityMap[i] <= NOISE_TOLERANCE;

        if (isEmpty) {
            if (currentGapStart === -1) currentGapStart = i;
        } else {
            if (currentGapStart !== -1) {
                // Fim de um gap potencial
                const gapWidthPx = (i - currentGapStart) * bucketSize;
                
                if (gapWidthPx >= MIN_GAP_WIDTH_PX) {
                    // Gap válido encontrado! Calcula o centro.
                    const gapCenterPx = (currentGapStart * bucketSize) + (gapWidthPx / 2);
                    splits.push(gapCenterPx);
                }
                currentGapStart = -1;
            }
        }
    }

    return splits;
}

export const renderCustomTextLayer = (textContent: any, container: HTMLElement, viewport: any, forceDetectColumns: boolean) => {
  container.innerHTML = '';
  const rawItems: any[] = [];
  
  // 1. Extração e Normalização
  textContent.items.forEach((item: any) => {
    const tx = item.transform;
    const fontHeight = Math.sqrt(tx[3] * tx[3] + tx[2] * tx[2]);
    const fontWidth = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
    const [x, y] = viewport.convertToViewportPoint(tx[4], tx[5]);
    const fontSize = fontHeight * viewport.scale;
    const text = item.str;

    if (!text || text.trim().length === 0) return;

    if (text.length > 1 && /\s/.test(text)) {
        const parts = text.split(/(\s+)/);
        const totalW = item.width ? item.width * viewport.scale : (text.length * fontSize * 0.5);
        const charW = totalW / text.length;
        let curX = 0;

        parts.forEach((part: string) => {
            if (part.length === 0) return;
            const pW = part.length * charW;
            rawItems.push({
                str: part, x: x + curX, y, width: pW, fontSize, fontName: item.fontName, scaleX: fontHeight > 0 ? (fontWidth/fontHeight) : 1
            });
            curX += pW;
        });
    } else {
        rawItems.push({
            str: text, x, y, width: item.width * viewport.scale, fontSize, fontName: item.fontName, scaleX: fontHeight > 0 ? (fontWidth/fontHeight) : 1
        });
    }
  });

  // 2. Detecção de Layout (Multi-Colunas)
  let splits: number[] = [];
  
  if (forceDetectColumns) {
      // Força divisão ao meio se solicitado explicitamente (modo livro)
      splits = [viewport.width / 2];
  } else {
      // Detecção algorítmica automática
      splits = detectColumnSplits(rawItems, viewport.width, viewport.height);
  }

  // 3. Ordenação Topológica Avançada
  rawItems.sort((a, b) => {
    if (splits.length > 0) {
        // Função auxiliar para determinar em qual "bucket" (coluna) o item cai
        const getColumnIndex = (item: any) => {
            const midX = item.x + (item.width / 2);
            let colIndex = 0;
            // Verifica em qual intervalo entre splits o item está
            for (const splitX of splits) {
                if (midX < splitX) {
                    return colIndex;
                }
                colIndex++;
            }
            return colIndex; // Última coluna
        };

        const colA = getColumnIndex(a);
        const colB = getColumnIndex(b);

        // Se estiverem em colunas diferentes, a coluna dita a ordem
        if (colA !== colB) {
            return colA - colB;
        }
    }

    // Se estiverem na mesma coluna (ou se não houver colunas), ordena por Y visual
    // Agrupamento por Linha Visual: Tolerância de 40% da altura da fonte
    const yDiff = a.y - b.y;
    const lineHeight = Math.min(a.fontSize, b.fontSize);
    
    if (Math.abs(yDiff) < (lineHeight * 0.4)) {
        // Mesma linha visual -> ordena por X
        return a.x - b.x;
    }
    // Linhas diferentes -> ordena por Y
    return yDiff;
  });

  // 4. Renderização DOM
  const frag = document.createDocumentFragment();
  
  rawItems.forEach((part) => {
    const span = document.createElement('span');
    span.textContent = part.str;
    const calculatedTop = part.y - (part.fontSize * 0.85);
    const hPadding = part.fontSize * 0.1; 

    span.style.cssText = `
        left: ${part.x}px;
        top: ${calculatedTop}px;
        font-size: ${part.fontSize}px;
        position: absolute;
        transform: scaleX(${part.scaleX});
        transform-origin: 0% 0%;
        white-space: pre;
        color: transparent;
        cursor: text;
        padding: 0 ${hPadding}px;
    `;
    
    span.dataset.pdfX = part.x.toString();
    span.dataset.pdfTop = calculatedTop.toString();
    span.dataset.pdfWidth = part.width.toString();
    span.dataset.pdfHeight = part.fontSize.toString();

    frag.appendChild(span);
  });
  
  container.appendChild(frag);
};

export const drawSmoothStroke = (ctx: CanvasRenderingContext2D, points: number[][], scale: number) => {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0] * scale, points[0][1] * scale);
    for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i][0] + points[i+1][0]) / 2;
        const midY = (points[i][1] + points[i+1][1]) / 2;
        ctx.quadraticCurveTo(points[i][0] * scale, points[i][1] * scale, midX * scale, midY * scale);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last[0] * scale, last[1] * scale);
    ctx.stroke();
};
