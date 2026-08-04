import { reactive, watch } from 'vue';

export type InterfaceLanguage = 'zh-CN' | 'en-US';
export type InterfaceTheme = 'light' | 'dark';

interface UiPreferences {
  language: InterfaceLanguage;
  theme: InterfaceTheme;
  mapProvider: 'amap';
  mapApiKey: string;
}

const storageKey = 'interview-os:ui-preferences';

function loadPreferences(): UiPreferences {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Partial<UiPreferences>;
    return {
      language: saved.language === 'en-US' ? 'en-US' : 'zh-CN',
      theme: saved.theme === 'dark' ? 'dark' : 'light',
      mapProvider: 'amap',
      mapApiKey: typeof saved.mapApiKey === 'string' ? saved.mapApiKey : ''
    };
  } catch {
    return { language: 'zh-CN', theme: 'light', mapProvider: 'amap', mapApiKey: '' };
  }
}

const preferences = reactive<UiPreferences>(loadPreferences());

function applyPreferences(): void {
  document.documentElement.lang = preferences.language;
  document.documentElement.dataset.theme = preferences.theme;
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}

watch(preferences, applyPreferences, { deep: true, immediate: true });

export function useUiPreferences() {
  return { preferences };
}
