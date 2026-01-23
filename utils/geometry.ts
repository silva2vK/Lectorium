
/**
 * Utilitários de Geometria e Coordenadas
 * Centraliza a matemática de conversão entre Espaço de Tela (DOM) e Espaço do Mundo (PDF/Canvas).
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Converte coordenadas da tela (evento do mouse/touch) para coordenadas do mundo (PDF).
 * @param clientX Coordenada X do evento
 * @param clientY Coordenada Y do evento
 * @param elementRect O boundingClientRect do elemento container
 * @param scale Escala atual de visualização
 */
export function screenToWorld(clientX: number, clientY: number, elementRect: Rect, scale: number): Point {
  return {
    x: (clientX - elementRect.left) / scale,
    y: (clientY - elementRect.top) / scale
  };
}

/**
 * Converte coordenadas do mundo (PDF) para coordenadas da tela (CSS pixels relativos ao container).
 */
export function worldToScreen(worldX: number, worldY: number, scale: number): Point {
  return {
    x: worldX * scale,
    y: worldY * scale
  };
}

/**
 * Calcula a distância euclidiana entre dois pontos.
 */
export function getDistance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Calcula o ponto médio entre dois pontos.
 */
export function getMidPoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
}

/**
 * Normaliza um valor entre um mínimo e máximo.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
