import { LANGS } from "@/lib/i18n/config";
import type { L10n } from "@/lib/i18n/dictionary";
import styles from "./admin.module.css";

// Text stored per language. English is required; the others sit under "Translations" and fall
// back to English on the site when left blank. Field names: `${name}.en`, `${name}.dari`, …
export function L10nField({
  name,
  label,
  value,
  required = true,
  multiline = false,
  idPrefix,
}: {
  name: string;
  label: string;
  value?: L10n | null;
  required?: boolean;
  multiline?: boolean;
  // Needed when several forms on one page have the same field names (ids must be unique).
  idPrefix?: string;
}) {
  const id = `${idPrefix ? `${idPrefix}-` : ""}${name}`;
  const others = LANGS.filter((l) => l.code !== "en");
  const input = (props: React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
    multiline ? <textarea rows={4} {...props} /> : <input {...props} />;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}.en`}>
        {label}
      </label>
      {input({ id: `${id}.en`, name: `${name}.en`, defaultValue: value?.en ?? "", required, className: styles.input })}
      <details className={styles.translations}>
        <summary>Translations</summary>
        {others.map((l) => (
          <label key={l.code} className={styles.translationRow}>
            <span>{l.label}</span>
            {input({ name: `${name}.${l.code}`, defaultValue: value?.[l.code] ?? "", lang: l.html, dir: "auto", className: styles.input })}
          </label>
        ))}
      </details>
    </div>
  );
}
