import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/rcm-prototype/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  optimizeDeps: { include: ["sql.js/dist/sql-wasm.js"] },
  server: {
    port: 5180,
    host: true,
    // Vite 6 blocks unrecognised Host headers — open it so the same server
    // works behind ngrok / Cloudflared / LAN IP without per-tunnel configs.
    allowedHosts: true,
    // Permit any origin to load dev assets (HMR client, sql.js wasm).
    cors: true,
  },
  preview: {
    port: 5180,
    host: true,
    allowedHosts: true,
    cors: true,
  },
});
