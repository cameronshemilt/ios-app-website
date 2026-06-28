import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const settingsPath = resolve(process.cwd(), "settings.yaml");

export default defineConfig({
  output: "static",
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: "settings-hot-reload",
        configureServer(server) {
          server.watcher.add(settingsPath);
          server.watcher.on("change", (file) => {
            if (file === settingsPath) {
              server.ws.send({ type: "full-reload" });
            }
          });
        },
      },
    ],
  },
});
