
import { User } from "firebase/auth";

export const MIME_TYPES = {
  PDF: 'application/pdf',
  FOLDER: 'application/vnd.google-apps.folder',
  GOOGLE_DOC: 'application/vnd.google-apps.document',
  GOOGLE_SHEET: 'application/vnd.google-apps.spreadsheet',
  GOOGLE_SLIDES: 'application/vnd.google-apps.presentation',
  MINDMAP: 'application/json',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TIFF: 'image/tiff',
  HEIC: 'image/heic',
  HEIF: 'image/heif',
  WEBP: 'image/webp',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  BMP: 'image/bmp',
  GIF: 'image/gif',
  DICOM: 'application/dicom',
  CBZ: 'application/vnd.comicbook+zip',
  CBR: 'application/vnd.comicbook-rar',
  PLAIN_TEXT: 'text/plain',
  MARKDOWN: 'text/markdown',
  LEGACY_MINDMAP_EXT: '.mindmap',
  DOCX_EXT: '.docx',
  LECTORIUM: 'application/vnd.lectorium',
  LECT_EXT: '.lect'
} as const;

export type LoadingStatus = 'init' | 'downloading' | 'converting' | 'layout' | 'ready' | 'error';

export interface OcrMetrics {
  uploadAndQueueTime: number;
  processingTime: number;
  totalTime: number;
  timestamp: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  parents?: string[];
  blob?: Blob;
  starred?: boolean;
  pinned?: boolean;
  size?: string;
  modifiedTime?: string;
  handle?: any;
}

export interface Annotation {
  id?: string;
  page: number;
  bbox: [number, number, number, number];
  text?: string;
  type: 'highlight' | 'note' | 'ink';
  points?: number[][];
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  isBurned?: boolean;
}

export interface PdfMetadataV2 {
  lectorium_v: string;
  last_sync: string;
  pageCount: number;
  pageOffset?: number;
  annotations: Annotation[];
  semanticData?: Record<number, string>;
}

export interface AuditRecord {
  fileId: string;
  contentHash: string;
  lastModified: number;
  annotationCount: number;
}

export interface EmbeddingChunk {
  text: string;
  vector: Float32Array;
  page?: number;
}

export interface VectorIndex {
  fileId: string;
  contentHash: string;
  textHash?: string;
  model: string;
  updatedAt: number;
  chunks: EmbeddingChunk[];
}

export interface SearchResult {
  text: string;
  score: number;
  page?: number;
}

export interface SemanticLensData {
  markdown: string;
  processedAt: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface SyncStatus {
  active: boolean;
  message: string | null;
}

export interface EditorStats {
  words: number;
  chars: number;
  charsNoSpace: number;
  readTime: number;
}

export type ReferenceType = 'book' | 'article' | 'website';

export interface Reference {
  id: string;
  type: ReferenceType;
  title: string;
  authors: { firstName: string; lastName: string }[];
  year: string;
  publisher?: string;
  city?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  accessDate?: string;
}

export type NodeShape = 'rectangle' | 'circle' | 'sticky' | 'pill' | 'hexagon';

export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  parentId?: string;
  isRoot?: boolean;
  fontSize?: number;
  shape?: NodeShape;
  imageUrl?: string;
  imageScale?: number;
  scale?: number; // Added to fix property not found error
}

export interface MindMapEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed';
}

export interface MindMapViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  viewport: MindMapViewport;
}

export interface SyncQueueItem {
  id: string;
  fileId: string;
  action: 'create' | 'update';
  blob: Blob;
  name: string;
  mimeType: string;
  parents?: string[];
  createdAt?: number;
}
