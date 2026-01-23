
import React, { useState, useRef } from 'react';
import { drawSmoothStroke } from '../utils/pdfRenderUtils';
import { Annotation } from '../types';
import { screenToWorld } from '../utils/geometry';

interface UsePdfInputProps {
    pageNumber: number;
    scale: number;
    activeTool: string;
    settings: any;
    pageContainerRef: React.RefObject<HTMLDivElement>;
    activeInkCanvasRef: React.RefObject<HTMLCanvasElement>;
    pageDimensions: { width: number, height: number } | null;
    addAnnotation: (ann: Annotation) => void;
    removeAnnotation: (ann: Annotation) => void;
    annotations: Annotation[];
    onSmartTap: (target: HTMLElement) => void;
}

export const usePdfInput = ({
    pageNumber, scale, activeTool, settings, pageContainerRef, activeInkCanvasRef, addAnnotation, removeAnnotation, annotations, onSmartTap
}: UsePdfInputProps) => {
    const isDrawing = useRef(false);
    const currentPointsRef = useRef<number[][]>([]);
    const isBrushingRef = useRef(false);
    const isErasingRef = useRef(false);
    const cursorStartRef = useRef<{ x: number, y: number } | null>(null);
    const [brushSelection, setBrushSelection] = useState<{ start: { x: number, y: number }, current: { x: number, y: number } } | null>(null);

    // Inicializa contexto otimizado (Chrome Low Latency Ink)
    const getContext = () => {
        const canvas = activeInkCanvasRef.current;
        if (!canvas) return null;
        
        // 'desynchronized: true' remove o canvas do fluxo de composição do browser.
        // Isso permite escrever diretamente no buffer de tela, eliminando latência de V-Sync.
        return canvas.getContext('2d', { 
            desynchronized: true, 
            willReadFrequently: false,
            alpha: true
        });
    };

    const getCoords = (e: React.PointerEvent) => {
        if (!pageContainerRef.current) return { x: 0, y: 0 };
        return screenToWorld(e.clientX, e.clientY, pageContainerRef.current.getBoundingClientRect(), scale);
    };

    // Lógica da Borracha (Colisão Espacial)
    const processEraser = (x: number, y: number) => {
        // Raio da borracha visualmente constante (ex: 20px), convertido para escala do mundo
        const eraserRadius = 20 / scale;

        const toRemove = annotations.filter(ann => {
            if (ann.page !== pageNumber) return false;
            if (ann.isBurned) return false; // Não apaga anotações queimadas no PDF

            // 1. Apagar Destaques (Highlight) - Colisão Ponto em Retângulo
            if (ann.type === 'highlight') {
                const [bx, by, bw, bh] = ann.bbox;
                return (
                    x >= bx && x <= bx + bw &&
                    y >= by && y <= by + bh
                );
            }

            // 2. Apagar Tinta (Ink) - Proximidade do Ponto
            if (ann.type === 'ink' && ann.points) {
                // Verifica se algum ponto do traço está dentro do raio da borracha
                // Otimização: Checa bounding box rápido antes de iterar pontos
                // Mas aqui faremos direto para simplicidade e precisão
                for (const p of ann.points) {
                    const dist = Math.hypot(p[0] - x, p[1] - y);
                    if (dist < eraserRadius) return true;
                }
            }

            return false;
        });

        toRemove.forEach(ann => removeAnnotation(ann));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const { x, y } = getCoords(e);
        
        if (activeTool === 'cursor') {
            cursorStartRef.current = { x, y };
            return;
        }
        if (activeTool === 'brush') {
            isBrushingRef.current = true;
            cursorStartRef.current = { x, y };
            setBrushSelection({ start: { x, y }, current: { x, y } });
            return;
        }
        if (activeTool === 'eraser') {
            isErasingRef.current = true;
            processEraser(x, y); // Apaga no clique inicial também
            return;
        }
        if (activeTool === 'note') {
            // CRIAÇÃO IMEDIATA: Pula o estágio de rascunho amarelo.
            // O NoteMarker detectará que é novo (pelo timestamp) e abrirá o modal automaticamente.
            addAnnotation({
                id: `note-${Date.now()}`,
                page: pageNumber,
                bbox: [x, y, 0, 0],
                type: 'note',
                text: '', // Texto vazio para iniciar
                color: '#fef9c3',
                createdAt: new Date().toISOString()
            });
            return;
        }
        if (activeTool === 'ink') {
            isDrawing.current = true;
            currentPointsRef.current = [[x, y]];
            e.currentTarget.setPointerCapture(e.pointerId);
            
            // Início imediato do traço (Reduz sensação de lag inicial)
            const ctx = getContext();
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(x * scale, y * scale);
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        // Coalesced Events: Chrome agrupa eventos de alta frequência (120hz+).
        const events = (e as any).getCoalescedEvents ? (e as any).getCoalescedEvents() : [e];

        if (isBrushingRef.current) {
            const { x, y } = getCoords(e);
            setBrushSelection(prev => prev ? { ...prev, current: { x, y } } : null);
            return;
        }

        if (isErasingRef.current) {
            // Processa borracha para todos os eventos agrupados para não pular traços rápidos
            for (const ev of events) {
                const { x, y } = getCoords(ev);
                processEraser(x, y);
            }
            return;
        }

        if (isDrawing.current) {
            const ctx = getContext();
            if (!ctx) return;

            ctx.lineWidth = (settings.inkStrokeWidth / 5) * scale;
            ctx.strokeStyle = settings.inkColor;
            ctx.globalAlpha = settings.inkOpacity;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Processa todos os pontos intermediários (High Precision Ink)
            for (const ev of events) {
                const { x, y } = getCoords(ev);
                currentPointsRef.current.push([x, y]);
                
                const len = currentPointsRef.current.length;
                if (len > 1) {
                    const p1 = currentPointsRef.current[len - 2];
                    const p2 = currentPointsRef.current[len - 1];
                    
                    ctx.beginPath();
                    ctx.moveTo(p1[0] * scale, p1[1] * scale);
                    const midX = (p1[0] + p2[0]) / 2;
                    const midY = (p1[1] + p2[1]) / 2;
                    ctx.quadraticCurveTo(midX * scale, midY * scale, p2[0] * scale, p2[1] * scale);
                    ctx.stroke();
                }
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (activeTool === 'cursor' && cursorStartRef.current) {
            const { x, y } = getCoords(e);
            if (Math.hypot(x - cursorStartRef.current.x, y - cursorStartRef.current.y) < 5) onSmartTap(e.target as HTMLElement);
            cursorStartRef.current = null;
        }
        
        if (isBrushingRef.current) {
            const { x, y } = getCoords(e);
            const x0 = Math.min(cursorStartRef.current!.x, x), y0 = Math.min(cursorStartRef.current!.y, y);
            const w = Math.abs(x - cursorStartRef.current!.x), h = Math.abs(y - cursorStartRef.current!.y);
            
            // Extract text from brushed area
            let extractedText = '';
            if (pageContainerRef.current) {
                const bLeft = x0 * scale;
                const bTop = y0 * scale;
                const bRight = (x0 + w) * scale;
                const bBottom = (y0 + h) * scale;

                const spans = Array.from(pageContainerRef.current.querySelectorAll('.textLayer span, .ocr-word-span'));
                const selectedSpans: { el: Element, top: number, left: number }[] = [];

                spans.forEach((span) => {
                    const el = span as HTMLElement;
                    const sLeft = parseFloat(el.dataset.pdfX || el.style.left) || 0;
                    const sTop = parseFloat(el.dataset.pdfTop || el.style.top) || 0;
                    const sWidth = parseFloat(el.dataset.pdfWidth || el.style.width) || 0;
                    const sHeight = parseFloat(el.dataset.pdfHeight || el.style.fontSize) || 12;

                    const sRight = sLeft + sWidth;
                    const sBottom = sTop + sHeight;

                    const intersects = !(bLeft > sRight || bRight < sLeft || bTop > sBottom || bBottom < sTop);
                    
                    if (intersects) {
                        selectedSpans.push({ el, top: sTop, left: sLeft });
                    }
                });

                selectedSpans.sort((a, b) => {
                    const diffY = a.top - b.top;
                    if (Math.abs(diffY) < 10) return a.left - b.left;
                    return diffY;
                });

                if (selectedSpans.length > 0) {
                    extractedText = selectedSpans.map(s => s.el.textContent).join(' ').replace(/\s+/g, ' ').trim();
                }
            }

            if (w > 5) {
                addAnnotation({ 
                    id: `hl-${Date.now()}`, 
                    page: pageNumber, 
                    bbox: [x0, y0, w, h], 
                    type: 'highlight', 
                    text: extractedText, 
                    color: settings.highlightColor, 
                    opacity: settings.highlightOpacity 
                });
            }
            isBrushingRef.current = false;
            setBrushSelection(null);
        }

        if (isDrawing.current) {
            isDrawing.current = false;
            if (currentPointsRef.current.length > 1) addAnnotation({ id: `ink-${Date.now()}`, page: pageNumber, bbox: [0, 0, 0, 0], type: 'ink', points: [...currentPointsRef.current], color: settings.inkColor, strokeWidth: settings.inkStrokeWidth / 5, opacity: settings.inkOpacity });
            currentPointsRef.current = [];
            activeInkCanvasRef.current?.getContext('2d')?.clearRect(0, 0, activeInkCanvasRef.current.width, activeInkCanvasRef.current.height);
        }

        if (isErasingRef.current) {
            isErasingRef.current = false;
        }
    };

    return { handlePointerDown, handlePointerMove, handlePointerUp, brushSelection };
};
