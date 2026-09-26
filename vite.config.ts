/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const bffToken = process.env.LIQUID_BFF_DEMO_TOKEN;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4001",
        changeOrigin: true,
        headers: bffToken ? { Authorization: `Bearer ${bffToken}` } : {},
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.mjs"],
    css: false,
  },
});
