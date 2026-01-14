
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
 * Algoritmo "White River" para detecção de colunas.
 * Cria um histograma de ocupação horizontal e busca vales (espaços vazios) no centro da página.
 */
function calculateSplitPoint(items: any[], viewportWidth: number, viewportHeight: number): number | null {
    // 1. Definição da Área de Interesse (ROI)
    // Ignora cabeçalhos (top 15%) e rodapés (bottom 15%) para evitar falsos negativos
    const safeTop = viewportHeight * 0.15;
    const safeBottom = viewportHeight * 0.85;
    
    // Focamos a busca da calha no terço central da largura (33% a 66%)
    const searchStart = Math.floor(viewportWidth * 0.33);
    const searchEnd = Math.floor(viewportWidth * 0.66);
    
    // Histograma de densidade (Resolução de 2px para performance)
    const bucketSize = 2;
    const numBuckets = Math.ceil(viewportWidth / bucketSize);
    const densityMap = new Int16Array(numBuckets).fill(0);

    // 2. Preenchimento do Histograma
    let contentCount = 0;
    for (const item of items) {
        // Ignora itens fora da zona vertical segura
        if (item.y < safeTop || item.y > safeBottom) continue;
        // Ignora itens muito pequenos (ruído/pontuação)
        if (item.width < 5) continue;

        const startBucket = Math.floor(item.x / bucketSize);
        const endBucket = Math.floor((item.x + item.width) / bucketSize);
        
        for (let i = startBucket; i <= endBucket; i++) {
            if (i >= 0 && i < numBuckets) {
                densityMap[i]++;
            }
        }
        contentCount++;
    }

    // Se não há conteúdo suficiente na zona segura, não tenta dividir
    if (contentCount < 10) return null;

    // 3. Detecção do "Rio Branco" (Maior sequência de zeros na zona de busca)
    let maxGapSize = 0;
    let currentGapSize = 0;
    let maxGapCenter = 0;
    let currentGapStart = 0;

    const startBucketIdx = Math.floor(searchStart / bucketSize);
    const endBucketIdx = Math.floor(searchEnd / bucketSize);

    for (let i = startBucketIdx; i <= endBucketIdx; i++) {
        if (densityMap[i] === 0) {
            if (currentGapSize === 0) currentGapStart = i;
            currentGapSize++;
        } else {
            if (currentGapSize > maxGapSize) {
                maxGapSize = currentGapSize;
                // Centro do gap em pixels
                maxGapCenter = (currentGapStart + (currentGapSize / 2)) * bucketSize;
            }
            currentGapSize = 0;
        }
    }

    // Verifica o último gap se o loop terminar
    if (currentGapSize > maxGapSize) {
        maxGapSize = currentGapSize;
        maxGapCenter = (currentGapStart + (currentGapSize / 2)) * bucketSize;
    }

    // 4. Validação
    // A calha deve ter pelo menos 10px de largura para ser considerada uma divisão de coluna real
    if (maxGapSize * bucketSize > 10) {
        return maxGapCenter;
    }

    return null;
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

  // 2. Detecção Inteligente de Colunas
  let splitX: number | null = null;
  
  if (forceDetectColumns) {
      splitX = viewport.width / 2; // Fallback manual forçado (corte seco)
  } else {
      // Tenta detectar automaticamente
      splitX = calculateSplitPoint(rawItems, viewport.width, viewport.height);
  }

  // 3. Ordenação Topológica (Leitura em N)
  rawItems.sort((a, b) => {
    // Se detectamos uma coluna, a prioridade máxima é a posição da coluna
    if (splitX !== null) {
        // Determina a coluna (0 = Esquerda, 1 = Direita)
        // Se um item cruza a linha de corte (ex: título centralizado), consideramos "Coluna -1" (Topo) ou baseado no centro
        const centerA = a.x + (a.width / 2);
        const centerB = b.x + (b.width / 2);
        
        // Tolerância de cruzamento: se o item cruza a linha de split significativamente, 
        // ele é um elemento de layout "full width".
        // Para simplificar: classificamos pelo centro de massa do texto.
        const colA = centerA < splitX ? 0 : 1;
        const colB = centerB < splitX ? 0 : 1;

        if (colA !== colB) {
            return colA - colB;
        }
    }

    // Dentro da mesma coluna (ou se for layout simples), ordena por Y
    const yDiff = a.y - b.y;
    // Pequena tolerância vertical para alinhar textos na mesma linha visualmente
    if (Math.abs(yDiff) < (a.fontSize * 0.5)) {
        return a.x - b.x;
    }
    return yDiff;
  });

  // 4. Renderização DOM
  rawItems.forEach((part) => {
    const span = document.createElement('span');
    span.textContent = part.str;
    const calculatedTop = part.y - (part.fontSize * 0.85);
    const hPadding = part.fontSize * 0.2;

    span.style.left = `${part.x - hPadding}px`;
    span.style.top = `${calculatedTop}px`;
    span.style.fontSize = `${part.fontSize}px`;
    span.style.position = 'absolute';
    span.style.transform = `scaleX(${part.scaleX})`;
    span.style.transformOrigin = '0% 0%';
    span.style.whiteSpace = 'pre';
    span.style.color = 'transparent';
    span.style.pointerEvents = 'all';
    span.style.padding = `0 ${hPadding}px`;
    
    // Debug visual da coluna (opcional, pode ser ativado via classe CSS)
    if (splitX !== null) {
        span.dataset.column = (part.x + (part.width/2)) < splitX ? "left" : "right";
    }

    span.dataset.pdfX = part.x.toString();
    span.dataset.pdfTop = calculatedTop.toString();
    span.dataset.pdfWidth = part.width.toString();
    span.dataset.pdfHeight = part.fontSize.toString();

    container.appendChild(span);
  });
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
