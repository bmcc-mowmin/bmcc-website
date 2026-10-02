// Text normalization for site search, so a query matches however it was typed:
// case, accents (café = cafe), Arabic-script letter variants used in Dari/Pashto/Urdu
// (ي/ی, ك/ک, ة/ه, أ/إ/آ → ا), short vowels and tatweel, and Persian/Arabic digits.
// Pure (no server code) so it can be unit tested.

const LETTERS: Record<string, string> = {
  "ي": "ی",
  "ى": "ی",
  "ئ": "ی",
  "ك": "ک",
  "ة": "ه",
  "ۀ": "ه",
  "ہ": "ه",
  "ھ": "ه",
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ؤ": "و",
};

export function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // accents and Arabic short vowels (harakat)
    .replace(/ـ/g, "") // tatweel
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[يىئكةۀہھأإآٱؤ]/g, (c) => LETTERS[c])
    .replace(/[‌‍‎‏⁦-⁩]/g, "") // joiners and direction marks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export const queryTerms = (q: string) => [...new Set(normalize(q).split(" ").filter((w) => w.length > 0))].slice(0, 8);

// Every term appears somewhere in the text (as a word start, so "pray" finds "prayer" but
// "ray" doesn't).
export function matches(text: string, terms: string[]) {
  if (terms.length === 0) return false;
  const words = ` ${normalize(text)}`;
  return terms.every((t) => words.includes(` ${t}`));
}
