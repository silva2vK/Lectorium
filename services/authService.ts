
import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,
  GoogleAuthProvider, 
  signOut as firebaseSignOut, 
  setPersistence, 
  browserLocalPersistence 
} from "firebase/auth";
import { auth } from "../firebase";

const TOKEN_DATA_KEY = 'drive_access_token_data';
const REFRESH_TOKEN_KEY = 'drive_refresh_token'; // Chave para o Token Eterno
export const DRIVE_TOKEN_EVENT = 'drive_token_changed';

// --- CONFIGURAÇÃO PARA CENÁRIO C (OFFLINE ACCESS) ---
// O Client Secret é injetado pelo Vite durante o build (process.env.CLIENT_SECRET).
// No Cloudflare Pages, defina a variável de ambiente: CLIENT_SECRET
const CLIENT_ID = "456660035916-p82oql83gqufjkf3vlkun9scf9v18d3p.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || ""; 

// Escopos necessários
const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.install";

// Detecção de ambiente móvel/híbrido
const isMobileOrTablet = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const saveDriveToken = (token: string, expiresIn: number = 3600) => {
  const expiryDate = Date.now() + (expiresIn - 300) * 1000; 
  const tokenData = {
    token,
    expiresAt: expiryDate
  };
  localStorage.setItem(TOKEN_DATA_KEY, JSON.stringify(tokenData));
  window.dispatchEvent(new CustomEvent(DRIVE_TOKEN_EVENT, { detail: { token } }));
};

export const saveRefreshToken = (refreshToken: string) => {
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const getValidDriveToken = (): string | null => {
  const data = localStorage.getItem(TOKEN_DATA_KEY);
  if (!data) return null;
  
  try {
    const { token, expiresAt } = JSON.parse(data);
    // Se expirou (ou está quase), retornamos null para forçar o refresh
    if (Date.now() > expiresAt) {
      return null; 
    }
    return token;
  } catch (e) {
    return null;
  }
};

export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.debug(`[Lectorium Core] Armazenamento persistente: ${isPersisted ? 'ATIVADO' : 'NEGADO'}`);
    return isPersisted;
  }
  return false;
}

export async function checkRedirectResult() {
    try {
        const result = await getRedirectResult(auth);
        if (result) {
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                console.log("[Auth] Recuperado token após redirecionamento");
                saveDriveToken(credential.accessToken);
                return { user: result.user, accessToken: credential.accessToken };
            }
        }
    } catch (error) {
        console.error("[Auth] Erro ao processar redirecionamento:", error);
    }
    return null;
}

/**
 * NOVO: Troca o 'code' pelo par de tokens (Access + Refresh)
 * Esta é a "mágica" do Cenário C.
 */
async function exchangeCodeForTokens(code: string) {
  if (!CLIENT_SECRET) {
    alert("ERRO DE CONFIGURAÇÃO: CLIENT_SECRET não definido nas variáveis de ambiente.");
    throw new Error("Missing Client Secret");
  }

  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', window.location.origin); // Deve coincidir com o Console

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!response.ok) {
    const err = await response.json();
    console.error("Token Exchange Error:", err);
    throw new Error(err.error_description || "Falha na troca de tokens");
  }

  const data = await response.json();
  
  if (data.access_token) {
    saveDriveToken(data.access_token, data.expires_in);
  }
  if (data.refresh_token) {
    saveRefreshToken(data.refresh_token);
    console.log("[Auth] Refresh Token adquirido e salvo com segurança (Local).");
  }
  return data.access_token;
}

/**
 * NOVO: Inicia o fluxo de "Code" para obter acesso Offline (Refresh Token).
 * Isso deve ser chamado se o usuário estiver logado mas sem Refresh Token.
 */
export async function linkDriveOfflineAccess(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const client = (window as any).google?.accounts?.oauth2?.initCodeClient({
        client_id: CLIENT_ID,
        scope: DRIVE_SCOPES,
        ux_mode: 'popup',
        callback: async (response: any) => {
          if (response.code) {
            try {
              await exchangeCodeForTokens(response.code);
              resolve();
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error("Usuário cancelou ou erro no popup"));
          }
        },
      });
      client.requestCode();
    } catch (e) {
      console.error("GSI Init Error", e);
      reject(e);
    }
  });
}

/**
 * NOVO: Renovação ROBUSTA usando Refresh Token (Cenário C).
 * Substitui a renovação silenciosa via iframe.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    console.warn("[Auth] Sem Refresh Token. Impossível renovar sessão.");
    return null;
  }

  if (!CLIENT_SECRET) {
    console.error("[Auth] Client Secret ausente. Impossível renovar.");
    return null;
  }

  try {
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) {
        // Se o refresh token for revogado ou inválido, limpamos para forçar relogin
        if (response.status === 400 || response.status === 401) {
            localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
        throw new Error("Google API recusou refresh");
    }

    const data = await response.json();
    if (data.access_token) {
        console.log("[Auth] Token renovado via Refresh Token (Cenário C)");
        saveDriveToken(data.access_token, data.expires_in);
        return data.access_token;
    }
  } catch (e) {
    console.error("[Auth] Falha crítica no refresh:", e);
  }
  
  return null;
}

// Mantido para compatibilidade, mas agora tenta obter o Refresh Token se possível
export async function signInWithGoogleDrive() {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPES);

  try {
    await setPersistence(auth, browserLocalPersistence);
    await requestPersistentStorage();

    try {
        console.log("[Auth] Iniciando fluxo de Popup Firebase...");
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        
        if (credential?.accessToken) {
           saveDriveToken(credential.accessToken);
        }

        // Check Pós-Login: Temos Refresh Token? Se não, e se tivermos Client Secret, 
        // poderíamos tentar pegar um agora ou deixar o usuário clicar em "Conectar Offline".
        // Para simplificar a UX, apenas logamos. O Dashboard vai avisar se precisar de vínculo offline.
        
        return {
          user: result.user,
          accessToken: credential?.accessToken
        };
    } catch (popupError: any) {
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-popup-request' || isMobileOrTablet()) {
             await signInWithRedirect(auth, provider);
             return { user: null, accessToken: null }; 
        }
        throw popupError;
    }
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
}

export async function logout() {
  localStorage.removeItem(TOKEN_DATA_KEY);
  // Opcional: Manter o refresh token para login rápido futuro? 
  // Por segurança, melhor limpar tudo no logout explícito.
  localStorage.removeItem(REFRESH_TOKEN_KEY); 
  return firebaseSignOut(auth);
}
