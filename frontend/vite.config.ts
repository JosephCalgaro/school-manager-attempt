import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  server: {
    allowedHosts: true,
    proxy: {
      "/admin": {
        target: "http://localhost:3333",
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:3333",
        changeOrigin: true,
      },
      "/students": "http://localhost:3333",
      "/student": "http://localhost:3333",
      "/users": "http://localhost:3333",
      "/classes": "http://localhost:3333",
      "/assignments": "http://localhost:3333",
      "/teacher": "http://localhost:3333",
      "/secretary": "http://localhost:3333",
      "/responsible": "http://localhost:3333",
      "/responsibles": "http://localhost:3333",
      "/uploads": "http://localhost:3333",
      "/attendance": "http://localhost:3333",
      "/ping": "http://localhost:3333",
      "/saas": {
        target: "http://localhost:3333",
        changeOrigin: true,
      },
    },
  },
});