import { LANGS } from "@/lib/i18n/config";
import type { L10n } from "@/lib/i18n/dictionary";
import styles from "./admin.module.css";

// Text stored per language. English is required; the others sit under "Translations" and fall
// back to English on the site when left blank. Field names: `${name}.en`, `${name}.dari`, …
export function L10nField({ name, label, value, required = true }: { name: string; label: string; value?: L10n | null; required?: boolean }) {
  const others = LANGS.filter((l) => l.code !== "en");
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${name}.en`}>
        {label}
      </label>
      <input id={`${name}.en`} name={`${name}.en`} defaultValue={value?.en ?? ""} required={required} className={styles.input} />
      <details className={styles.translations}>
        <summary>Translations</summary>
        {others.map((l) => (
          <label key={l.code} className={styles.translationRow}>
            <span>{l.label}</span>
            <input
              name={`${name}.${l.code}`}
              defaultValue={value?.[l.code] ?? ""}
              lang={l.html}
              dir="auto"
              className={styles.input}
            />
          </label>
        ))}
      </details>
    </div>
  );
}
