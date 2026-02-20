
import React, { createContext, useContext, useRef } from 'react';
import { createStore, useStore as useZustandStore, StoreApi } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ToolType } from '../context/PdfContext'; 

interface PdfUiState {
  // Viewport State
  scale: number;
  rotation: number;
  currentPage: number;
  numPages: number;
  
  // Split View State
  isSplitView: boolean;
  secondaryPage: number;
  activeViewport: 'primary' | 'secondary';
  
  // Layout State (Spread supported within Single View)
  isSpread: boolean;
  spreadSide: 'left' | 'right';
  
  // Dimensions
  pageDimensions: { width: number, height: number } | null;
  pageSizes: { width: number, height: number }[];
  
  // Tools
  activeTool: ToolType;
  
  // Actions
  setScale: (scale: number | ((prev: number) => number)) => void;
  setRotation: (rotation: number) => void;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  setSecondaryPage: (page: number | ((prev: number) => number)) => void;
  setNumPages: (num: number) => void;
  setIsSpread: (isSpread: boolean) => void;
  setSpreadSide: (side: 'left' | 'right') => void;
  setActiveTool: (tool: ToolType) => void;
  setPageDimensions: (dims: { width: number, height: number } | null) => void;
  setPageSizes: (sizes: { width: number, height: number }[]) => void;
  
  // Split Actions
  toggleSplitView: () => void;
  setActiveViewport: (viewport: 'primary' | 'secondary') => void;
  
  // Data Sharing
  currentText: string;
  setCurrentText: (text: string) => void;
  
  // Navigation
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: (containerWidth: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  jumpToPage: (page: number) => void;
}

interface PdfStoreInitProps {
    defaultPage?: number;
    defaultScale?: number;
}

// 1. Factory Function: Cria uma nova store isolada a cada chamada
const createPdfStore = (initProps?: PdfStoreInitProps) => createStore<PdfUiState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    scale: initProps?.defaultScale || 1.0,
    rotation: 0,
    currentPage: initProps?.defaultPage || 1,
    numPages: 0,
    
    // Split View Initial
    isSplitView: false,
    secondaryPage: 1,
    activeViewport: 'primary',
    
    // Data Sharing
    currentText: "",
    
    isSpread: false,
    spreadSide: 'left',
    pageDimensions: null,
    pageSizes: [],
    activeTool: 'cursor',

    // Setters
    setScale: (input) => set((state) => {
        const nextScale = typeof input === 'function' ? input(state.scale) : input;
        return { scale: Math.min(Math.max(0.25, nextScale), 5.0) };
    }),
    
    setRotation: (rotation) => set({ rotation }),
    
    setCurrentText: (text) => set({ currentText: text }),
    
    setCurrentPage: (input) => set((state) => {
        const next = typeof input === 'function' ? input(state.currentPage) : input;
        const max = state.numPages > 0 ? state.numPages : 99999;
        const safePage = Math.max(1, Math.min(next, max));
        return { currentPage: safePage };
    }),

    setSecondaryPage: (input) => set((state) => {
        const next = typeof input === 'function' ? input(state.secondaryPage) : input;
        const max = state.numPages > 0 ? state.numPages : 99999;
        const safePage = Math.max(1, Math.min(next, max));
        return { secondaryPage: safePage };
    }),

    setNumPages: (numPages) => set((state) => {
        const correctedPage = state.currentPage > numPages && numPages > 0 ? numPages : state.currentPage;
        const correctedSecondary = state.secondaryPage > numPages && numPages > 0 ? numPages : state.secondaryPage;
        return { numPages, currentPage: correctedPage, secondaryPage: correctedSecondary };
    }),

    setIsSpread: (isSpread) => set({ isSpread }),
    setSpreadSide: (spreadSide) => set({ spreadSide }),
    setActiveTool: (activeTool) => set({ activeTool }),
    setPageDimensions: (pageDimensions) => set({ pageDimensions }),
    setPageSizes: (pageSizes) => set({ pageSizes }),

    // Split Actions
    toggleSplitView: () => set((state) => {
        const nextState = !state.isSplitView;
        return { 
            isSplitView: nextState,
            // Ao ativar, a segunda página começa igual a atual (ou +1 se preferir, mas igual é melhor para comparar)
            secondaryPage: nextState ? state.currentPage : state.secondaryPage,
            activeViewport: 'primary' 
        };
    }),

    setActiveViewport: (activeViewport) => set({ activeViewport }),

    // Helpers
    zoomIn: () => {
        const { setScale } = get();
        setScale(s => s + 0.25);
    },

    zoomOut: () => {
        const { setScale } = get();
        setScale(s => s - 0.25);
    },

    fitWidth: (containerWidth) => {
        const { pageDimensions, setScale, isSplitView } = get();
        if (!pageDimensions) return;
        
        const padding = containerWidth < 768 ? 20 : 60;
        // Se estiver em split view, a largura disponível é metade
        const effectiveWidth = isSplitView ? (containerWidth / 2) : containerWidth;
        const availableWidth = effectiveWidth - padding;
        const newScale = availableWidth / pageDimensions.width;
        
        setScale(newScale);
    },

    jumpToPage: (page: number) => {
        const { setCurrentPage, setSecondaryPage, activeViewport, isSplitView, setIsSpread, setSpreadSide } = get();
        
        if (isSplitView && activeViewport === 'secondary') {
            setSecondaryPage(page);
        } else {
            setCurrentPage(page);
        }
        
        // Reset spread logic on direct jump
        setIsSpread(false);
        setSpreadSide('left');
    },

    nextPage: () => {
        const { currentPage, secondaryPage, numPages, isSpread, spreadSide, setCurrentPage, setSecondaryPage, setSpreadSide, isSplitView, activeViewport } = get();
        
        // Spread Logic (Optional - only for primary view for now)
        if (!isSplitView && isSpread && spreadSide === 'left') {
            setSpreadSide('right');
            return;
        }
        
        if (isSplitView && activeViewport === 'secondary') {
            if (secondaryPage < numPages) {
                setSecondaryPage(secondaryPage + 1);
            }
        } else {
            if (currentPage < numPages) {
                setCurrentPage(currentPage + 1);
                if (isSpread) setSpreadSide('left');
            }
        }
    },

    prevPage: () => {
        const { currentPage, secondaryPage, isSpread, spreadSide, setCurrentPage, setSecondaryPage, setSpreadSide, isSplitView, activeViewport } = get();
        
        // Spread Logic (Optional)
        if (!isSplitView && isSpread && spreadSide === 'right') {
            setSpreadSide('left');
            return;
        }
        
        if (isSplitView && activeViewport === 'secondary') {
            if (secondaryPage > 1) {
                setSecondaryPage(secondaryPage - 1);
            }
        } else {
            if (currentPage > 1) {
                setCurrentPage(currentPage - 1);
                if (isSpread) setSpreadSide('right');
            }
        }
    }
  }))
);

// 2. Context Definition
const PdfStoreContext = createContext<StoreApi<PdfUiState> | null>(null);

// 3. Provider Component
export const PdfStoreProvider: React.FC<{ children: React.ReactNode, initialPage?: number, initialScale?: number }> = ({ children, initialPage, initialScale }) => {
  const storeRef = useRef<StoreApi<PdfUiState> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createPdfStore({ defaultPage: initialPage, defaultScale: initialScale });
  }

  return React.createElement(PdfStoreContext.Provider, { value: storeRef.current }, children);
};

// 4. Hook Consumer (Mantém a API compatível com o resto do app)
export function usePdfStore<T>(selector: (state: PdfUiState) => T): T {
  const store = useContext(PdfStoreContext);
  if (!store) {
    throw new Error('Missing PdfStoreProvider');
  }
  return useZustandStore(store, selector);
}

// 5. Hook to access store API directly (getState, setState, subscribe)
export function usePdfStoreApi(): StoreApi<PdfUiState> {
  const store = useContext(PdfStoreContext);
  if (!store) {
    throw new Error('Missing PdfStoreProvider');
  }
  return store;
}
