// Reads emails from the local Mailpit inbox (http://localhost:8025) in tests.
const API = process.env.MAILPIT_API_URL ?? "http://localhost:8025";

type Summary = { ID: string; Subject: string; To: { Address: string }[]; Created: string };

// The newest email to `to` received after `since`, waiting up to `timeoutMs`.
export async function waitForEmail(to: string, since: Date, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${API}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: Summary[] };
    const fresh = messages.find((m) => new Date(m.Created) >= new Date(since.getTime() - 1000));
    if (fresh) {
      const full = await (await fetch(`${API}/api/v1/message/${fresh.ID}`)).json();
      return { subject: fresh.Subject, text: full.Text as string, html: full.HTML as string };
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No email to ${to} within ${timeoutMs}ms`);
}

export function firstLink(text: string, contains: string) {
  const link = text.match(/https?:\/\/\S+/g)?.find((l) => l.includes(contains));
  if (!link) throw new Error(`No link containing "${contains}" in the email`);
  return link;
}
