
import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,
  GoogleAuthProvider, 
  signInWithCredential,
  signOut as firebaseSignOut, 
  setPersistence, 
  browserLocalPersistence,
  indexedDBLocalPersistence
} from "firebase/auth";
import { auth } from "../firebase";
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

const TOKEN_DATA_KEY = 'drive_access_token_data';
export const DRIVE_TOKEN_EVENT = 'drive_token_changed';

// Escopos necessários para o Lectorium
const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.install";

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
 * Inicializa o plugin nativo (necessário no primeiro load se estiver no App)
 */
if (Capacitor.isNativePlatform()) {
    GoogleAuth.initialize();
}

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
 * Verifica se houve um retorno de Login via Redirecionamento (Apenas Web Mobile)
 */
export async function checkRedirectResult() {
    // Se for nativo, o login é Promise-based, não redirect-based
    if (Capacitor.isNativePlatform()) return null;

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
  // Em ambiente nativo, usamos o plugin para refresh
  if (Capacitor.isNativePlatform()) {
      try {
          const googleUser = await GoogleAuth.refresh();
          if (googleUser.authentication.accessToken) {
              saveDriveToken(googleUser.authentication.accessToken);
              return googleUser.authentication.accessToken;
          }
      } catch (e) {
          console.warn("[Native Auth] Refresh falhou", e);
      }
      return null;
  }

  // Ambiente Web
  return new Promise((resolve) => {
    try {
      const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: "456660035916-p82oql83gqufjkf3vlkun9scf9v18d3p.apps.googleusercontent.com",
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
  await requestPersistentStorage();

  // MODO NATIVO (APK/IPA)
  if (Capacitor.isNativePlatform()) {
      try {
          // 1. Chama o fluxo nativo do Android
          const googleUser = await GoogleAuth.signIn();
          
          // 2. Cria credencial Firebase com o ID Token nativo
          const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
          
          // 3. Loga no Firebase Auth (Sessão de Usuário)
          // Em nativo, usamos indexedDBLocalPersistence para maior confiabilidade
          await setPersistence(auth, indexedDBLocalPersistence);
          const userCredential = await signInWithCredential(auth, credential);
          
          // 4. Salva o Access Token do Drive (Escopos)
          // O plugin já pediu os escopos configurados no capacitor.config.json
          if (googleUser.authentication.accessToken) {
              saveDriveToken(googleUser.authentication.accessToken);
          }

          return {
              user: userCredential.user,
              accessToken: googleUser.authentication.accessToken
          };

      } catch (error) {
          console.error("Native Login Failed:", error);
          throw error;
      }
  }

  // MODO WEB (Browser/PWA)
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/drive");
  provider.addScope("https://www.googleapis.com/auth/drive.install");

  try {
    await setPersistence(auth, browserLocalPersistence);

    // Mobile Web: Redirect para melhor experiência UX no navegador
    const isMobileWeb = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobileWeb) {
        await signInWithRedirect(auth, provider);
        return { user: null, accessToken: null }; 
    } else {
        // Desktop Web: Popup
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
    console.error("Web Login failed:", error);
    throw error;
  }
}

export async function logout() {
  localStorage.removeItem(TOKEN_DATA_KEY);
  if (Capacitor.isNativePlatform()) {
      await GoogleAuth.signOut();
  }
  return firebaseSignOut(auth);
}