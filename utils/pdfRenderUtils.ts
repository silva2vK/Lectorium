
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

export const renderCustomTextLayer = (textContent: any, container: HTMLElement, viewport: any, detectColumns: boolean) => {
  container.innerHTML = '';
  const rawItems: any[] = [];
  
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

  rawItems.sort((a, b) => {
    if (detectColumns) {
      const mid = viewport.width / 2;
      const isLeftA = (a.x + a.width/2) < mid;
      const isLeftB = (b.x + b.width/2) < mid;
      if (isLeftA !== isLeftB) return isLeftA ? -1 : 1;
    }
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) < (a.fontSize * 0.4)) return a.x - b.x;
    return yDiff;
  });

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