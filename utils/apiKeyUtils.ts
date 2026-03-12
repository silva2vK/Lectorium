
export const API_KEY_STORAGE_KEY = 'lectorium_user_gemini_keys';
export const API_KEY_INDEX_KEY = 'lectorium_user_gemini_key_index';

export const getStoredApiKeys = (): string[] => {
  const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [stored];
  } catch {
    return stored ? [stored] : [];
  }
};

export const getStoredApiKey = (): string | null => {
  const keys = getStoredApiKeys();
  if (keys.length === 0) return null;

  const indexStr = localStorage.getItem(API_KEY_INDEX_KEY);
  let index = indexStr ? parseInt(indexStr, 10) : 0;

  if (isNaN(index) || index >= keys.length) {
    index = 0;
    localStorage.setItem(API_KEY_INDEX_KEY, '0');
  }

  return keys[index];
};

export const getCurrentKeyIndex = (): number => {
  const indexStr = localStorage.getItem(API_KEY_INDEX_KEY);
  const index = indexStr ? parseInt(indexStr, 10) : 0;
  return isNaN(index) ? 0 : index;
};

export const rotateApiKey = (): boolean => {
  const keys = getStoredApiKeys();
  if (keys.length <= 1) return false;

  const current = getCurrentKeyIndex();
  const next = (current + 1) % keys.length;

  localStorage.setItem(API_KEY_INDEX_KEY, next.toString());
  console.warn(`[Key Pool] Rotacionou: chave ${current} → ${next}`);
  return true; // caller controla o limite de tentativas
};

export const saveApiKeys = (keys: string[]): void => {
  const validKeys = keys.map(k => k.trim()).filter(k => k.length > 0);
  localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(validKeys));
  localStorage.setItem(API_KEY_INDEX_KEY, '0');
  window.dispatchEvent(new Event('apikey-changed'));
};

export const saveApiKey = (key: string): void => saveApiKeys([key]);

export const removeApiKey = (): void => {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  localStorage.removeItem(API_KEY_INDEX_KEY);
  window.dispatchEvent(new Event('apikey-changed'));
};

export const hasApiKey = (): boolean => getStoredApiKeys().length > 0;
