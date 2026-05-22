import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AppErrorBoundary } from "@/components/ErrorFallback";
import { initTheme } from "@/lib/theme";
import { initGlobalErrorHandlers } from "@/lib/errors/init-global-handlers";

initTheme();
initGlobalErrorHandlers();

/** `.../fass-dailyscrum/` 로 열었을 때 hash 가 없으면 `#/` 로 맞춤 (HashRouter) */
const hash = window.location.hash;
if (!hash || hash === "#") {
  window.location.hash = "/";
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
