
import { signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth } from "../firebase";

const TOKEN_DATA_KEY = 'drive_access_token_data';
export const DRIVE_TOKEN_EVENT = 'drive_token_changed';

// ID do Cliente (Público)
const GOOGLE_CLIENT_ID = "456660035916-p82oql83gqufjkf3vlkun9scf9v18d3p.apps.googleusercontent.com";
const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.install";

export const saveDriveToken = (token: string, expiresIn: number = 3600) => {
  const expiryDate = Date.now() + (expiresIn - 60) * 1000; // Margem de segurança de 1 min
  const tokenData = {
    token,
    expiresAt: expiryDate
  };
  localStorage.setItem(TOKEN_DATA_KEY, JSON.stringify(tokenData));
  window.dispatchEvent(new CustomEvent(DRIVE_TOKEN_EVENT, { detail: { token } }));
};

export const getValidDriveToken = (): string | null => {
  const data = localStorage.getItem(TOKEN_DATA_KEY);
  if (!data) return null;
  
  try {
    const { token, expiresAt } = JSON.parse(data);
    // Se estiver expirado, retornamos null para forçar o refresh via BFF
    if (Date.now() > expiresAt) {
      return null; 
    }
    return token;
  } catch (e) {
    return null;
  }
};

/**
 * BFF FLOW: Refresh Token via Cloudflare Functions
 * Chama nosso backend seguro para pegar um novo token usando o cookie HttpOnly.
 */
export async function refreshDriveTokenBFF(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/refresh', { method: 'POST' });
    
    if (response.ok) {
      const data = await response.json();
      if (data.access_token) {
        saveDriveToken(data.access_token, data.expires_in);
        return data.access_token;
      }
    }
    console.warn("[Auth] Falha ao renovar token via BFF:", response.status);
    return null;
  } catch (e) {
    console.error("[Auth] Erro de rede no refresh BFF", e);
    return null;
  }
}

/**
 * BFF FLOW: Login Inicial com Code Flow
 * Em vez de pegar o token direto, pegamos um CODE e trocamos no servidor.
 */
export async function authorizeDriveAccess(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const client = (window as any).google?.accounts?.oauth2?.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPES,
        ux_mode: 'popup',
        callback: async (response: any) => {
          if (response.code) {
            // Envia o código para o Cloudflare trocar por tokens e setar o cookie
            try {
              const exchangeRes = await fetch('/api/auth/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  code: response.code,
                  redirect_uri: window.location.origin // Importante para validação
                })
              });

              const data = await exchangeRes.json();
              
              if (exchangeRes.ok && data.access_token) {
                saveDriveToken(data.access_token, data.expires_in);
                resolve(data.access_token);
              } else {
                reject(new Error("Falha na troca de token no servidor"));
              }
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error("Usuário cancelou ou erro no Google"));
          }
        },
      });

      client.requestCode();
    } catch (e) {
      reject(e);
    }
  });
}

// Mantém o login do Firebase para Identidade visual (Avatar/Nome),
// mas a autorização do Drive agora é separada via Code Flow.
export async function signInWithGoogleDrive() {
  const provider = new GoogleAuthProvider();
  // Removemos addScope daqui pois vamos pedir permissão via Code Flow separado
  // para garantir o Refresh Token.

  try {
    await setPersistence(auth, browserLocalPersistence);
    
    // 1. Login de Identidade (Firebase)
    const result = await signInWithPopup(auth, provider);
    
    // 2. Login de Dados (Drive - Code Flow para BFF)
    // Isso abrirá um segundo popup se não tivermos permissão offline ainda,
    // mas garante o Refresh Token eterno no servidor.
    const driveToken = await authorizeDriveAccess();

    return {
      user: result.user,
      accessToken: driveToken
    };
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
}

export async function logout() {
  localStorage.removeItem(TOKEN_DATA_KEY);
  // Opcional: Chamar endpoint para limpar cookie no servidor se desejado
  return firebaseSignOut(auth);
}
