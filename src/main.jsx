import React from "react";
import { createRoot } from "react-dom/client";
import App from "./InsightLabCRM.jsx";
import "./nocturne.css"; // dual-theme tokens + base + components (Nocturne / Daylight)

// фон body всегда совпадает с фоном приложения (без светлых полос внизу)
document.documentElement.style.minHeight = "100%";
document.body.style.minHeight = "100vh";
document.body.style.background = "var(--c-bg)";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);