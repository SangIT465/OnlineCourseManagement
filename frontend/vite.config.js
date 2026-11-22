import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const proxy = {
    "/api": {
      target: env.API_PROXY_TARGET || "http://localhost:5106",
      changeOrigin: true,
    },
    "/swagger": {
      target: env.API_PROXY_TARGET || "http://localhost:5106",
      changeOrigin: true,
    },
  };

  return {
    root,
    server: { host: "localhost", port: 5173, strictPort: true, proxy },
    preview: { host: "localhost", port: 4173, strictPort: true, proxy },
    build: { outDir: "dist", emptyOutDir: true },
  };
});
