
import { DriveFile, MIME_TYPES } from "../types";
import { getValidDriveToken, signInWithGoogleDrive, saveDriveToken, refreshDriveTokenSilently } from "./authService";

const LIST_PARAMS = "&supportsAllDrives=true&includeItemsFromAllDrives=true";
const WRITE_PARAMS = "&supportsAllDrives=true";

// Constantes de tipos suportados para reutilização em listagem e busca
const SUPPORTED_EXTENSIONS = [
    MIME_TYPES.LEGACY_MINDMAP_EXT, 
    MIME_TYPES.DOCX_EXT,
    MIME_TYPES.LECT_EXT, 
    '.tiff', '.tif', 
    '.heic', '.heif', 
    '.webp', '.dcm', 
    '.txt', '.md',
    '.cbz', '.cbr'
];

const SUPPORTED_MIMES = [
    MIME_TYPES.PDF, 
    MIME_TYPES.FOLDER, 
    MIME_TYPES.DOCX, 
    MIME_TYPES.GOOGLE_DOC,
    MIME_TYPES.LECTORIUM,
    MIME_TYPES.TIFF,
    MIME_TYPES.HEIC,
    MIME_TYPES.HEIF,
    MIME_TYPES.WEBP,
    MIME_TYPES.DICOM,
    MIME_TYPES.CBZ,
    MIME_TYPES.CBR,
    'application/x-cbz',
    'application/x-cbr',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'text/plain',
    'text/markdown'
];

function buildBaseConstraints() {
    const mimeQuery = SUPPORTED_MIMES.map(m => `mimeType='${m}'`).join(' or ');
    const nameQuery = SUPPORTED_EXTENSIONS.map(e => `name contains '${e}'`).join(' or ');
    return `trashed=false and (${mimeQuery} or ${nameQuery})`;
}

/**
 * Interceptador Centralizado de Requisições (Protocolo Auto-Retry v2)
 * 1. Tenta usar o token atual.
 * 2. Se 401, tenta refresh silencioso via GSI (Sessão do Chrome).
 * 3. Se falhar, lança erro para UI disparar popup manual.
 */
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getValidDriveToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(url, { ...options, headers });

  // Se receber 401 (Unauthorized), tenta renovação invisível
  if (response.status === 401) {
    console.warn("[Auto-Retry] Token expirado. Tentando renovação silenciosa via Chrome...");
    
    try {
      // Recurso Pro: Tenta atualizar sem interromper o fluxo de trabalho do usuário
      const newToken = await refreshDriveTokenSilently();
      
      if (newToken) {
        console.log("[Auto-Retry] Token renovado silenciosamente. Retentando...");
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, { ...options, headers });
      } else {
        // Se o silencioso falhar, precisamos de interação humana
        throw new Error("DRIVE_TOKEN_EXPIRED");
      }
    } catch (renewError) {
      console.error("[Auto-Retry] Falha na renovação automática.", renewError);
      throw new Error("DRIVE_TOKEN_EXPIRED");
    }
  }

  return response;
}

export async function listDriveContents(accessToken: string, folderId: string = 'root'): Promise<DriveFile[]> {
  let query = "";
  const baseConstraints = buildBaseConstraints();
  
  if (folderId === 'shared-with-me') {
    query = `sharedWithMe=true and ${baseConstraints}`;
  } else if (folderId === 'starred') {
    query = `starred=true and ${baseConstraints}`;
  } else {
    query = `'${folderId}' in parents and ${baseConstraints}`;
  }

  const fields = "files(id, name, mimeType, thumbnailLink, parents, starred, size, modifiedTime)";
  
  const response = await fetchWithAuth(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=1000&orderBy=folder,name${LIST_PARAMS}`
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Erro na API do Drive");
  }

  const data = await response.json();
  return data.files || [];
}

export async function searchDriveFiles(accessToken: string, queryTerm: string): Promise<DriveFile[]> {
  // Limpeza básica para evitar injeção ou erros na query do Drive
  const safeQuery = queryTerm.replace(/'/g, "\\'");
  const baseConstraints = buildBaseConstraints();
  
  // Busca global por nome contendo o termo
  const query = `name contains '${safeQuery}' and ${baseConstraints}`;
  
  const fields = "files(id, name, mimeType, thumbnailLink, parents, starred, size, modifiedTime)";
  
  // Nota: orderBy 'folder' não funciona bem com busca global, usamos modifiedTime desc para relevância recente
  const response = await fetchWithAuth(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=50&orderBy=modifiedTime desc${LIST_PARAMS}`
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
    throw new Error("Falha na pesquisa");
  }

  const data = await response.json();
  return data.files || [];
}

export async function listDriveFolders(accessToken: string, parentId: string = 'root'): Promise<DriveFile[]> {
  const query = `'${parentId}' in parents and mimeType='${MIME_TYPES.FOLDER}' and trashed=false`;
  const fields = "files(id, name, mimeType, parents)";
  
  const response = await fetchWithAuth(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=1000&orderBy=name${LIST_PARAMS}`
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
    throw new Error("Falha ao listar pastas");
  }

  const data = await response.json();
  return data.files || [];
}

export async function searchMindMaps(accessToken: string): Promise<DriveFile[]> {
  const query = `name contains '${MIME_TYPES.LEGACY_MINDMAP_EXT}' and trashed=false`;
  const fields = "files(id, name, mimeType, thumbnailLink, parents, starred, modifiedTime)";
  
  const response = await fetchWithAuth(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=1000&orderBy=modifiedTime desc${LIST_PARAMS}`
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
    const err = await response.json();
    throw new Error(err.error?.message || "Falha ao buscar mapas mentais");
  }

  const data = await response.json();
  return data.files || [];
}

export async function downloadDriveFile(accessToken: string, driveFileId: string, mimeType?: string): Promise<Blob> {
  let url = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media${WRITE_PARAMS}`;

  if (mimeType === MIME_TYPES.GOOGLE_DOC) {
      url = `https://www.googleapis.com/drive/v3/files/${driveFileId}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`;
  } else if (mimeType === MIME_TYPES.GOOGLE_SHEET) {
      url = `https://www.googleapis.com/drive/v3/files/${driveFileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
  } else if (mimeType === MIME_TYPES.GOOGLE_SLIDES) {
      url = `https://www.googleapis.com/drive/v3/files/${driveFileId}/export?mimeType=application/vnd.openxmlformats-officedocument.presentationml.presentation`;
  }

  const res = await fetchWithAuth(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
    throw new Error("Falha no download do Drive");
  }
  return res.blob();
}

export async function uploadFileToDrive(
  accessToken: string, 
  file: Blob, 
  name: string, 
  parents: string[] = [],
  mimeType: string = MIME_TYPES.PDF
): Promise<{ id: string }> {
  const metadata = {
    name: name,
    mimeType: mimeType,
    parents: parents.length > 0 ? parents : undefined
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetchWithAuth(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart${WRITE_PARAMS}`, {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
    throw new Error("Falha ao fazer upload");
  }
  return res.json();
}

export async function updateDriveFile(
  accessToken: string, 
  fileId: string, 
  file: Blob,
  mimeType: string = MIME_TYPES.PDF
): Promise<{ id: string }> {
  const metadata = { mimeType: mimeType };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetchWithAuth(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart${WRITE_PARAMS}`, {
    method: 'PATCH',
    body: form
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
    throw new Error("Falha ao atualizar arquivo");
  }
  return res.json();
}

export async function moveDriveFile(
  accessToken: string,
  fileId: string,
  previousParents: string[],
  newParentId: string
): Promise<void> {
  const prevParentsStr = previousParents.join(',');
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${prevParentsStr}${WRITE_PARAMS}`;

  const res = await fetchWithAuth(url, {
    method: 'PATCH'
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
    const err = await res.json();
    throw new Error(err.error?.message || "Falha ao mover arquivo");
  }
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'DELETE'
  });
  
  if (!res.ok) {
    if (res.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
  }
}

export async function renameDriveFile(accessToken: string, fileId: string, newName: string): Promise<void> {
  const res = await fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: newName })
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
  }
}
