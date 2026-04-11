import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/Inventory-App/",
  build: {
    modulePreload: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("react") ||
            id.includes("react-dom") ||
            id.includes("react-router")
          ) {
            return "react-vendor";
          }

          if (id.includes("antd") || id.includes("@ant-design")) {
            return "antd-vendor";
          }

          if (id.includes("firebase")) {
            return "firebase-vendor";
          }

          if (id.includes("xlsx") || id.includes("file-saver")) {
            return "export-vendor";
          }

          if (id.includes("@antv") || id.includes("@ant-design/charts")) {
            return "charts-vendor";
          }

          return "vendor";
        },
      },
    },
  },
});
