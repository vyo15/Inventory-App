import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { HashRouter } from "react-router-dom"; // jangan pakai BrowserRouter

const THEME_STORAGE_KEY = "ims-bunga-flanel-theme";
const THEME_LIGHT_VALUE = "light";
const THEME_DARK_VALUE = "dark";

const normalizeThemeMode = (themeMode) => {
  return themeMode === THEME_DARK_VALUE ? THEME_DARK_VALUE : THEME_LIGHT_VALUE;
};

const readInitialThemeMode = () => {
  try {
    return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return THEME_LIGHT_VALUE;
  }
};

const applyInitialThemeMode = () => {
  const initialThemeMode = readInitialThemeMode();
  const nextThemeClass = initialThemeMode === THEME_DARK_VALUE ? "app-theme-dark" : "app-theme-light";
  const staleThemeClass = initialThemeMode === THEME_DARK_VALUE ? "app-theme-light" : "app-theme-dark";
  const rootElement = document.documentElement;
  const bodyElement = document.body;

  rootElement.classList.remove(staleThemeClass);
  rootElement.classList.add(nextThemeClass);
  rootElement.setAttribute("data-app-theme", initialThemeMode);

  if (bodyElement) {
    bodyElement.classList.remove(staleThemeClass);
    bodyElement.classList.add(nextThemeClass);
    bodyElement.setAttribute("data-app-theme", initialThemeMode);
  }

  window.__IMS_INITIAL_THEME_MODE__ = initialThemeMode;
};

applyInitialThemeMode();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
