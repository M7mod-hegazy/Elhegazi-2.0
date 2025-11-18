import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent multiple React copies (fixes Invalid hook call / useRef null issues)
    dedupe: ["react", "react-dom"],
  },
  // Ensure optimized deps use the same React instance and pre-bundle Radix tooltip
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "@radix-ui/react-tooltip",
    ],
  },
}));
