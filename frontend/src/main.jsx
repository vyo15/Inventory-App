import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App.jsx";
import { HashRouter } from "react-router-dom"; // jangan pakai BrowserRouter
import { applyDocumentThemeMode, readStoredThemeMode } from "./theme/themeMode";

applyDocumentThemeMode(readStoredThemeMode());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
