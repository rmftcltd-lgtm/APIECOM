/**
 * Lightweight taxonomy map for common handmade/vintage shop categories.
 * Replace or extend with live Etsy GET /seller-taxonomy/nodes results for production.
 */
export const TAXONOMY_GUESSES: Array<{ pattern: RegExp; id: number; label: string }> = [
  { pattern: /women.?s?\s*dress|dress/i, id: 10915, label: "Clothing > Women's clothing > Dresses" },
  { pattern: /women.?s?\s*(top|blouse|shirt)/i, id: 10919, label: "Clothing > Women's clothing > Tops & tees" },
  { pattern: /jacket|coat|blazer/i, id: 10912, label: "Clothing > Women's clothing > Jackets & coats" },
  { pattern: /necklace/i, id: 1202, label: "Jewelry > Necklaces" },
  { pattern: /earring/i, id: 1201, label: "Jewelry > Earrings" },
  { pattern: /ring(?!er)/i, id: 1203, label: "Jewelry > Rings" },
  { pattern: /bag|handbag|tote/i, id: 1230, label: "Bags & purses" },
  { pattern: /vase|pottery|ceramic/i, id: 891, label: "Home & living > Home décor" },
  { pattern: /candle/i, id: 8914, label: "Home & living > Home fragrance > Candles" },
  { pattern: /print|poster|art/i, id: 2078, label: "Art & collectibles > Prints" },
  { pattern: /scarf/i, id: 1229, label: "Accessories > Scarves & wraps" },
  { pattern: /hat|beanie|cap/i, id: 1225, label: "Accessories > Hats & caps" },
];

export function guessTaxonomy(categoryGuess: string, title: string): {
  taxonomyId: number | null;
  label: string;
} {
  const haystack = `${categoryGuess} ${title}`;
  for (const entry of TAXONOMY_GUESSES) {
    if (entry.pattern.test(haystack)) {
      return { taxonomyId: entry.id, label: entry.label };
    }
  }
  return { taxonomyId: null, label: categoryGuess || "Uncategorized" };
}
