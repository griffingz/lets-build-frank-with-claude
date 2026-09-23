import "@cloudscape-design/global-styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { createFrankClient } from "./frank/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App client={createFrankClient()} />
  </StrictMode>,
);
