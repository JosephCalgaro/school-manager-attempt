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
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  server: {
    allowedHosts: true,
    proxy: {
    "/admin": "http://localhost:3333",
    "/auth": "http://localhost:3333",
    "/students": "http://localhost:3333",
    "/users": "http://localhost:3333",
    "/classes": "http://localhost:3333",
    "/assignments": "http://localhost:3333",
    "/teacher": "http://localhost:3333",
    "/uploads": "http://localhost:3333",
    "/attendance": "http://localhost:3333",
    "/ping": "http://localhost:3333",
    },
  },
});
