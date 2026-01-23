
import React, { useRef, useEffect } from 'react';
import { Annotation } from '../../../types';
import { drawSmoothStroke } from '../../../utils/pdfRenderUtils';

interface PdfInkLayerProps {
    annotations: Annotation[];
    pageNumber: number;
    scale: number;
    width: number;
    height: number;
}

export const PdfInkLayer: React.FC<PdfInkLayerProps> = React.memo(({
    annotations, pageNumber, scale, width, height
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const pageInks = annotations.filter(a => a.page === pageNumber && a.type === 'ink' && !a.isBurned);
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        pageInks.forEach(ann => {
            if (!ann.points || ann.points.length < 2) return;
            
            ctx.lineWidth = (ann.strokeWidth || 3) * scale;
            ctx.strokeStyle = ann.color || '#ff0000';
            ctx.globalAlpha = ann.opacity || 1;

            drawSmoothStroke(ctx, ann.points, scale);
        });
    }, [annotations, pageNumber, scale, width, height]);

    return (
        <canvas 
            ref={canvasRef} 
            className="select-none absolute top-0 left-0 pointer-events-none" 
            style={{ zIndex: 35, display: 'block', width: `${width}px`, height: `${height}px` }} 
        />
    );
});
