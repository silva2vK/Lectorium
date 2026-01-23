
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
export const DRIVE_TOKEN_EVENT = 'drive_token_changed';

// Escopos necessários para o Lectorium
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

export const getValidDriveToken = (): string | null => {
  const data = localStorage.getItem(TOKEN_DATA_KEY);
  if (!data) return null;
  
  try {
    const { token, expiresAt } = JSON.parse(data);
    if (Date.now() > expiresAt) {
      return null; 
    }
    return token;
  } catch (e) {
    return null;
  }
};

/**
 * Recurso Chrome: Storage Persistence
 */
export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.debug(`[Lectorium Core] Armazenamento persistente: ${isPersisted ? 'ATIVADO' : 'NEGADO'}`);
    return isPersisted;
  }
  return false;
}

/**
 * Verifica se houve um retorno de Login via Redirecionamento (Mobile)
 * Deve ser chamado na inicialização do App.
 */
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
 * Protocolo de Refresh Silencioso via GSI
 */
export async function refreshDriveTokenSilently(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: "456660035916-p82oql83gqufjkf3vlkun9scf9v18d3p.apps.googleusercontent.com", // ID extraído da config
        scope: DRIVE_SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            saveDriveToken(response.access_token, response.expires_in);
            resolve(response.access_token);
          } else {
            resolve(null);
          }
        },
      });

      // prompt: '' instrui o Google a não mostrar UI se o usuário já consentiu
      client.requestToken({ prompt: '' });
    } catch (e) {
      console.warn("[GSI] Falha no refresh silencioso", e);
      resolve(null);
    }
  });
}

export async function signInWithGoogleDrive() {
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/drive");
  provider.addScope("https://www.googleapis.com/auth/drive.install");

  try {
    await setPersistence(auth, browserLocalPersistence);
    await requestPersistentStorage();

    // ESTRATÉGIA HÍBRIDA:
    // Mobile/WebView: Usa Redirect (mais compatível com navegadores externos)
    // Desktop: Usa Popup (melhor UX)
    if (isMobileOrTablet()) {
        await signInWithRedirect(auth, provider);
        // O código vai parar aqui enquanto o navegador redireciona.
        // O retorno será tratado por `checkRedirectResult` no App.tsx
        return { user: null, accessToken: null }; 
    } else {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        
        if (!credential?.accessToken) {
          throw new Error("No access token returned from Google");
        }

        return {
          user: result.user,
          accessToken: credential.accessToken
        };
    }
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
}

export async function logout() {
  localStorage.removeItem(TOKEN_DATA_KEY);
  return firebaseSignOut(auth);
}
