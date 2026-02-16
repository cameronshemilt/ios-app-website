import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { remarkSettings } from "./src/lib/remark-settings";

export default defineConfig({
  output: "static",
  markdown: {
    remarkPlugins: [remarkSettings],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
