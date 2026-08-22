import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://jotaleutgeb.github.io",
  base: "/gemas-ia/",
  integrations: [sitemap()],
});
