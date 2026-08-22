import rss from "@astrojs/rss";
import { loadPublishedEditions } from "../lib/ediciones.js";

export async function GET(context) {
  const editions = await loadPublishedEditions();
  return rss({
    title: "Gemas IA — Ediciones semanales",
    description: "Joyas ocultas del mercado de LLMs, movimientos y análisis con datos propios. Un observatorio abierto.",
    site: context.site,
    items: editions.map((edition) => ({
      title: edition.title,
      pubDate: new Date(`${edition.date}T12:00:00Z`),
      description: edition.excerpt,
      link: `/ediciones/${edition.slug}/`,
    })),
    customData: "<language>es-ar</language>",
  });
}
