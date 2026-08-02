import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

/** Copy `assets/` into the build output so CSS/JS string paths keep working. */
function copyGameAssets() {
  return {
    name: "copy-game-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] || "";
        if (!url.startsWith("/assets/")) return next();
        const file = path.join(process.cwd(), url);
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const src = path.join(process.cwd(), "assets");
      const dest = path.join(process.cwd(), "www", "assets");
      if (!fs.existsSync(src)) return;
      fs.cpSync(src, dest, { recursive: true });
    },
  };
}

export default defineConfig({
  // Relative base works for Capacitor `www/` and GitHub project Pages.
  base: "./",
  plugins: [react(), copyGameAssets()],
  build: {
    outDir: "www",
    emptyOutDir: true,
    sourcemap: true,
  },
});
