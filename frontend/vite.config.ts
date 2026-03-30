import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createServer } from "./server";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Firebase signInWithPopup needs to inspect window.closed on the popup it
    // opened. The default Vite COOP header ("same-origin") blocks that call.
    // "same-origin-allow-popups" preserves cross-origin isolation while still
    // allowing the opener to communicate with popups it spawned.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    fs: {
      allow: ["./client", "./shared", "index.html"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
    // Proxy /api/query to the backend server (port 3001)
    // Other /api/* routes (ping, demo) stay on the frontend express server
    proxy: {
      "/api/query": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      const app = createServer();

      // Return a function so Express is added AFTER Vite's built-in middleware
      // (including the proxy). Without this, express.json() consumes the request
      // body before the proxy can forward it to the backend, causing ECONNABORTED.
      return () => {
        server.middlewares.use(app);
      };
    },
  };
}
