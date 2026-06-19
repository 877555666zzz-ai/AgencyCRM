import React from "react";
import { createRoot } from "react-dom/client";
import App from "./InsightLabCRM.jsx";
import "./nocturne.css"; // dual-theme tokens + base + components (Nocturne / Daylight)

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
