
// services/authService.ts
// GIS puro — sem Firebase. Autenticação via Google Identity Services.

export const DRIVE_TOKEN_EVENT = 'drive_token_changed';
const TOKEN_DATA_KEY = 'drive_access_token_data';
const USER_DATA_KEY = 'gis_user_data';

const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.install";
const CLIENT_ID = "315143132640-m5cr88sfdhs41lh5nbn166ahiom4omum.apps.googleusercontent.com";

// --- Tipos ---
export interface GisUser {
  uid: string;       // campo 'sub' do JWT Google — estável, único por conta
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

// --- Singleton de refresh ---
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
            resolve(null);
          }
        },
        error_callback: () => { refreshPromise = null; resolve(null); }
      });

      if (!client) { refreshPromise = null; resolve(null); return; }

      client.requestToken({
        prompt: '',
        login_hint: user?.email || undefined
      });
    } catch {
      refreshPromise = null;
      resolve(null);
    }
  });

  return refreshPromise;
}

// --- Login ---
export async function signInWithGoogleDrive(): Promise<{ user: GisUser; accessToken: string } | null> {
  return new Promise((resolve, reject) => {
    // Passo 1: Sign In with Google → identidade (uid, nome, email)
    (window as any).google?.accounts?.id?.initialize({
      client_id: CLIENT_ID,
      callback: (response: any) => {
        const user = decodeGoogleJwt(response.credential);
        if (!user) { reject(new Error("Falha ao decodificar identidade Google")); return; }
        saveUser(user);

        // Passo 2: OAuth2 Token Client → access_token para o Drive
        const tokenClient = (window as any).google?.accounts?.oauth2?.initTokenClient({
          client_id: CLIENT_ID,
          scope: DRIVE_SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse.access_token) {
              saveDriveToken(tokenResponse.access_token, tokenResponse.expires_in);
              resolve({ user, accessToken: tokenResponse.access_token });
            } else {
              reject(new Error("Falha ao obter access token do Drive"));
            }
          },
          error_callback: (err: any) => reject(new Error(err?.message || "Erro OAuth")),
        });

        tokenClient.requestToken({ prompt: '' });
      }
    });

    (window as any).google?.accounts?.id?.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap não disponível — abre popup explícito
        (window as any).google?.accounts?.id?.renderButton(
          document.createElement('div'), {}
        );
        // Fallback: força token client direto sem identidade prévia
        const tokenClient = (window as any).google?.accounts?.oauth2?.initTokenClient({
          client_id: CLIENT_ID,
          scope: DRIVE_SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse.access_token) {
              // Sem JWT de identidade nesse caminho — usa usuário armazenado se existir
              const existingUser = getStoredUser();
              if (existingUser) {
                saveDriveToken(tokenResponse.access_token, tokenResponse.expires_in);
                resolve({ user: existingUser, accessToken: tokenResponse.access_token });
              } else {
                reject(new Error("Identidade não disponível. Tente novamente."));
              }
            }
          },
          error_callback: (err: any) => reject(new Error(err?.message || "Erro OAuth")),
        });
        tokenClient.requestToken({ prompt: 'select_account' });
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

// Mantido por compatibilidade — não faz nada com GIS puro
export async function checkRedirectResult() { return null; }
export async function requestPersistentStorage() {
  if (navigator.storage?.persist) {
    return navigator.storage.persist();
  }
  return false;
}
