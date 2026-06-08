export const THEME_STORAGE_KEY = "ims-bunga-flanel-theme";
export const THEME_LIGHT_VALUE = "light";
export const THEME_DARK_VALUE = "dark";

const THEME_CLASS_BY_MODE = Object.freeze({
  [THEME_LIGHT_VALUE]: "app-theme-light",
  [THEME_DARK_VALUE]: "app-theme-dark",
});

export const normalizeThemeMode = (themeMode) => {
  return themeMode === THEME_DARK_VALUE ? THEME_DARK_VALUE : THEME_LIGHT_VALUE;
};

export const readStoredThemeMode = () => {
  if (typeof window === "undefined") return THEME_LIGHT_VALUE;

  try {
    return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return THEME_LIGHT_VALUE;
  }
};

export const persistThemeMode = (themeMode) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizeThemeMode(themeMode));
  } catch {
    // Theme persistence is best-effort only. UI state still follows the active React state.
  }
};

export const getInitialThemeMode = () => {
  if (typeof window !== "undefined") {
    const bootstrappedTheme = window.__IMS_INITIAL_THEME_MODE__;

    if (bootstrappedTheme === THEME_LIGHT_VALUE || bootstrappedTheme === THEME_DARK_VALUE) {
      return bootstrappedTheme;
    }
  }

  return readStoredThemeMode();
};

export const applyDocumentThemeMode = (themeMode) => {
  const normalizedThemeMode = normalizeThemeMode(themeMode);
  const nextThemeClass = THEME_CLASS_BY_MODE[normalizedThemeMode];
  const staleThemeClass = normalizedThemeMode === THEME_DARK_VALUE
    ? THEME_CLASS_BY_MODE[THEME_LIGHT_VALUE]
    : THEME_CLASS_BY_MODE[THEME_DARK_VALUE];

  if (typeof document !== "undefined") {
    const rootElement = document.documentElement;
    const bodyElement = document.body;

    rootElement.classList.remove(staleThemeClass);
    rootElement.classList.add(nextThemeClass);
    rootElement.setAttribute("data-app-theme", normalizedThemeMode);

    if (bodyElement) {
      bodyElement.classList.remove(staleThemeClass);
      bodyElement.classList.add(nextThemeClass);
      bodyElement.setAttribute("data-app-theme", normalizedThemeMode);
    }
  }

  if (typeof window !== "undefined") {
    window.__IMS_INITIAL_THEME_MODE__ = normalizedThemeMode;
  }

  return normalizedThemeMode;
};
