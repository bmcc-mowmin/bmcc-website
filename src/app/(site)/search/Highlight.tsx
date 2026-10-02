import { normalize } from "@/lib/search/normalize";

// Marks the words that match the search (compared the same normalized way the search matches).
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return text;
  const parts = text.split(/(\s+)/);
  return parts.map((part, i) => {
    const n = normalize(part);
    return n && terms.some((t) => n.split(" ").some((w) => w.startsWith(t))) ? <mark key={i}>{part}</mark> : part;
  });
}
