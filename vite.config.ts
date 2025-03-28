import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath } from "url";
import tailwind from "@tailwindcss/vite";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwind(), cloudflare()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
