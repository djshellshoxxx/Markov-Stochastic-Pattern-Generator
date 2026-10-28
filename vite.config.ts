import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: { allowedHosts: true },
  build: { target: "es2022" },
});
