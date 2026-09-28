"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import styles from "./about.module.css";

// PHASE 1: layout only. Phase 6 connects it to a server action (honeypot, rate limit,
// stores a ContactMessage and emails CONTACT_INBOX through the mail service).
export function ContactForm({ topic }: { topic?: string }) {
  const { t } = useI18n();
  return (
    <form className={styles.formCard} onSubmit={(e) => e.preventDefault()} aria-labelledby="contact-form-title">
      <h2 id="contact-form-title" className={styles.formTitle}>
        {t.send_message}
      </h2>
      <div className={styles.formFields}>
        <input type="hidden" name="topic" value={topic ?? ""} />
        <label className="visually-hidden" htmlFor="contact-name">
          {t.contact_name_ph}
        </label>
        <input id="contact-name" name="name" autoComplete="name" required placeholder={t.contact_name_ph} className={styles.input} />
        <label className="visually-hidden" htmlFor="contact-email">
          {t.contact_email_ph}
        </label>
        <input id="contact-email" name="email" type="email" autoComplete="email" required placeholder={t.contact_email_ph} className={styles.input} />
        <label className="visually-hidden" htmlFor="contact-message">
          {t.contact_help_ph}
        </label>
        <textarea id="contact-message" name="message" rows={4} required placeholder={t.contact_help_ph} className={`${styles.input} ${styles.textarea}`} />
        <button type="submit" className={`btn btn-primary ${styles.submit}`}>
          {t.send_button}
        </button>
      </div>
    </form>
  );
}
