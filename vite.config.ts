import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    // Code-splitting: razdvajamo vendor chunkove tako da menjanje app koda
    // ne invalidira ceo bundle (browser cache friendly).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router")) return "router";
          if (id.includes("/react/") || id.includes("react-dom") || id.includes("scheduler")) return "react";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("@connectrpc") || id.includes("@bufbuild")) return "connect";
          if (id.includes("@protobuf-ts") || id.includes("google-protobuf")) return "connect";
          return "vendor";
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      "/mreza.v1.SurveyService": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/mreza.v1.AdminService": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
