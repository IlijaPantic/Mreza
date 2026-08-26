import { TransportProvider } from "@connectrpc/connect-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { App } from "@/App";
import { queryClient } from "@/lib/queryClient";
import { transport } from "@/lib/transport";

import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <TransportProvider transport={transport}>
          <App />
        </TransportProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
