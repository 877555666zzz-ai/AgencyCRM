import React from "react";
import { createRoot } from "react-dom/client";
import App from "./InsightLabCRM.jsx";
import "./nocturne.css"; // dual-theme tokens + base + components (Nocturne / Daylight)

// Масштаб интерфейса 80% (по умолчанию)
document.documentElement.style.zoom = "0.8";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);