
export const API_KEY_STORAGE_KEY = 'lectorium_user_gemini_keys';
export const API_KEY_INDEX_KEY = 'lectorium_user_gemini_key_index';

export const getStoredApiKeys = (): string[] => {
  const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Fallback for old single key storage
      return [stored];
    }
  }
  return [];
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

export const rotateApiKey = (): boolean => {
  const keys = getStoredApiKeys();
  if (keys.length <= 1) return false; // Can't rotate if 0 or 1 key

  const indexStr = localStorage.getItem(API_KEY_INDEX_KEY);
  let index = indexStr ? parseInt(indexStr, 10) : 0;
  
  index = (index + 1) % keys.length;
  localStorage.setItem(API_KEY_INDEX_KEY, index.toString());
  console.log(`[Key Pool] Rotated to key index ${index}`);
  return true;
};

export const saveApiKeys = (keys: string[]) => {
  const validKeys = keys.map(k => k.trim()).filter(k => k.length > 0);
  localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(validKeys));
  localStorage.setItem(API_KEY_INDEX_KEY, '0'); // Reset index on new keys
  window.dispatchEvent(new Event('apikey-changed'));
};

// Legacy support for single key save
export const saveApiKey = (key: string) => {
  saveApiKeys([key]);
};

export const removeApiKey = () => {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  localStorage.removeItem(API_KEY_INDEX_KEY);
  window.dispatchEvent(new Event('apikey-changed'));
};

export const hasApiKey = (): boolean => {
  return getStoredApiKeys().length > 0 || !!process.env.API_KEY;
};
