// services/authService.ts
// GIS puro — sem Firebase. Autenticação via Google Identity Services.
// Sessão 1 de remoção do Firebase: 2026-03-13 ~15:00 BRT
// Fix 2026-03-14: prompt 'consent' no primeiro login — 'prompt: """ falha silenciosamente
// no Android Chrome quando o scope de Drive ainda não foi autorizado neste browser.

export const DRIVE_TOKEN_EVENT = 'drive_token_changed';
const TOKEN_DATA_KEY = 'drive_access_token_data';
const USER_DATA_KEY = 'gis_user_data';

const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.install";
const CLIENT_ID = "315143132640-m5cr88sfdhs41lh5nbn166ahiom4omum.apps.googleusercontent.com";

// --- Tipos ---
export interface GisUser {
  uid: string;       // campo 'sub' do JWT Google — estável, único por conta Google
  displayName: string;
  email: string;
  photoURL?: string;
}

// --- Token Drive ---
export const saveDriveToken = (token: string, expiresIn: number = 3600) => {
  const expiryDate = Date.now() + (expiresIn - 300) * 1000;
  localStorage.setItem(TOKEN_DATA_KEY, JSON.stringify({ token, expiresAt: expiryDate }));
  window.dispatchEvent(new CustomEvent(DRIVE_TOKEN_EVENT, { detail: { token } }));
};

export const getValidDriveToken = (): string | null => {
  const data = localStorage.getItem(TOKEN_DATA_KEY);
  if (!data) return null;
  try {
    const { token, expiresAt } = JSON.parse(data);
    if (Date.now() > expiresAt) { localStorage.removeItem(TOKEN_DATA_KEY); return null; }
    return token;
  } catch {
    localStorage.removeItem(TOKEN_DATA_KEY);
    return null;
  }
};

// --- Usuário ---
export const saveUser = (user: GisUser) => {
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
};

export const getStoredUser = (): GisUser | null => {
  const data = localStorage.getItem(USER_DATA_KEY);
  if (!data) return null;
  try { return JSON.parse(data); } catch { return null; }
};

/** Decodifica o JWT do Google Sign-In sem biblioteca externa */
function decodeGoogleJwt(credential: string): GisUser | null {
  try {
    const payload = JSON.parse(atob(credential.split('.')[1]));
    return {
      uid: payload.sub,
      displayName: payload.name || payload.email,
      email: payload.email,
      photoURL: payload.picture,
    };
  } catch {
    return null;
  }
}

/** Storage Persistence — mantido por compatibilidade */
export async function requestPersistentStorage() {
  if (navigator.storage?.persist) {
    const isPersisted = await navigator.storage.persist();
    console.debug(`[Lectorium Core] Armazenamento persistente: ${isPersisted ? 'ATIVADO' : 'NEGADO'}`);
    return isPersisted;
  }
  return false;
}

/** Mantido por compatibilidade com App.tsx — GIS não usa redirect */
export async function checkRedirectResult() { return null; }

// --- Singleton de refresh silencioso ---
let refreshPromise: Promise<string | null> | null = null;

export async function refreshDriveTokenSilently(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = new Promise((resolve) => {
    try {
      const user = getStoredUser();
      const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: CLIENT_ID,
        scope: DRIVE_SCOPES,
        callback: (response: any) => {
          refreshPromise = null;
          if (response.access_token) {
            saveDriveToken(response.access_token, response.expires_in);
            resolve(response.access_token);
          } else {
            console.warn("[GSI] Refresh falhou (sem token na resposta). Pode exigir re-login manual.");
            resolve(null);
          }
        },
        error_callback: () => { refreshPromise = null; resolve(null); }
      });

      if (!client) { refreshPromise = null; resolve(null); return; }

      // prompt: '' é correto aqui — refresh silencioso pressupõe consentimento já existente
      client.requestToken({
        prompt: '',
        login_hint: user?.email || undefined
      });
    } catch (e) {
      console.warn("[GSI] Falha no refresh silencioso", e);
      refreshPromise = null;
      resolve(null);
    }
  });

  return refreshPromise;
}

// --- Login principal ---
export async function signInWithGoogleDrive(): Promise<{ user: GisUser; accessToken: string } | null> {
  return new Promise((resolve, reject) => {

    const requestDriveToken = (user: GisUser, promptMode: string) => {
      const tokenClient = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: CLIENT_ID,
        scope: DRIVE_SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse.access_token) {
            saveDriveToken(tokenResponse.access_token, tokenResponse.expires_in);
            saveUser(user);
            resolve({ user, accessToken: tokenResponse.access_token });
          } else {
            reject(new Error("Falha ao obter access token do Drive"));
          }
        },
        error_callback: (err: any) => reject(new Error(err?.message || "Erro OAuth Drive")),
      });
      tokenClient.requestToken({ prompt: promptMode, login_hint: user.email });
    };

    // Passo 1: Sign In with Google → identidade (uid, nome, email)
    (window as any).google?.accounts?.id?.initialize({
      client_id: CLIENT_ID,
      callback: (response: any) => {
        const user = decodeGoogleJwt(response.credential);
        if (!user) { reject(new Error("Falha ao decodificar identidade Google")); return; }
        // Passo 2: OAuth2 Token Client → access_token para o Drive
        // FIX: 'consent' em vez de '' — no Android Chrome, prompt vazio falha silenciosamente
        // na primeira autorização do scope Drive (callback do tokenClient nunca é invocado).
        // Após o primeiro consentimento, o Chrome mantém o grant em cache e futuros refreshes
        // silenciosos (refreshDriveTokenSilently com prompt: '') funcionam normalmente.
        requestDriveToken(user, 'consent');
      }
    });

    (window as any).google?.accounts?.id?.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap não disponível — fallback com usuário já armazenado
        const existingUser = getStoredUser();
        if (existingUser) {
          requestDriveToken(existingUser, 'select_account');
        } else {
          // Nenhum usuário conhecido — rejeita para UI mostrar toast de erro
          reject(new Error("Login necessário. Tente novamente."));
        }
      }
    });
  });
}

export async function logout(): Promise<void> {
  const user = getStoredUser();
  localStorage.removeItem(TOKEN_DATA_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  if (user?.email) {
    (window as any).google?.accounts?.id?.revoke(user.email, () => {});
  }
}
