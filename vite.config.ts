import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/@firebase/firestore") || id.includes("/firebase/firestore"))
            return "vendor-firestore";
          if (id.includes("/@firebase/auth") || id.includes("/firebase/auth"))
            return "vendor-firebase-auth";
          if (id.includes("/firebase/") || id.includes("/@firebase/"))
            return "vendor-firebase-core";
          if (
            id.includes("/@mui/") ||
            id.includes("/@emotion/") ||
            id.includes("/react-transition-group/")
          )
            return "vendor-ui";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/scheduler/")
          )
            return "vendor-react";
          if (id.includes("/xlsx/") || id.includes("/cfb/") || id.includes("/ssf/"))
            return "vendor-excel";
        },
      },
    },
  },
});
