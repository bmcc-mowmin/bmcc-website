"use client";

import { Fragment, useActionState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { HoneypotFields } from "@/components/forms/HoneypotFields";
import { CONTACT_TOPICS, isContactTopic } from "@/lib/contact/topics";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { sendContactMessage, type ContactState } from "./actions";
import styles from "./about.module.css";

// Saves a ContactMessage (Admin → Messages) and emails CONTACT_INBOX; the visitor gets a short
// acknowledgement. `topic` comes from ?topic= (links on Services, Assistance and Home).
export function ContactForm({ topic }: { topic?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactMessage, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className={styles.formCard} role="status">
        <h2 className={styles.formTitle}>{t.contact_done_title}</h2>
        <p className={styles.doneText}>{t.contact_done_text}</p>
        {/* A full reload gives a fresh, empty form. */}
        <a href="/about#contact" className={styles.again}>
          {t.contact_send_another}
        </a>
      </div>
    );
  }

  const values = state.status === "error" ? state.values : { topic: isContactTopic(topic) ? topic : "" };
  const errors = state.status === "error" ? state.errors : {};
  const errorFor = (name: string) =>
    errors[name] ? (
      <span id={`contact-${name}-error`} className={styles.fieldError}>
        {t[errors[name] as MessageKey] ?? t.form_error_required}
      </span>
    ) : null;
  const invalid = (name: string) => (errors[name] ? { "aria-invalid": true, "aria-describedby": `contact-${name}-error` } : {});

  return (
    <form action={action} className={styles.formCard} aria-labelledby="contact-form-title">
      <h2 id="contact-form-title" className={styles.formTitle}>
        {t.send_message}
      </h2>
      {/* The spam timer stays outside the part that remounts after an error (remounting would restart it). */}
      <HoneypotFields />
      {/* Remount the fields after an error so they show what the person typed. */}
      <Fragment key={JSON.stringify(state)}>
        <div className={styles.formFields}>
          {state.status === "error" && (
            <p role="alert" className={styles.formError}>
              {state.message}
            </p>
          )}
          <div className={styles.fieldStack}>
            <label htmlFor="contact-topic" className={styles.fieldLabel}>
              {t.contact_topic_label}
            </label>
            <select id="contact-topic" name="topic" defaultValue={values.topic ?? ""} className={styles.input}>
              <option value="">{t.contact_topic_general}</option>
              {Object.entries(CONTACT_TOPICS).map(([id, key]) => (
                <option key={id} value={id}>
                  {t[key]}
                </option>
              ))}
            </select>
          </div>
          <label className="visually-hidden" htmlFor="contact-name">
            {t.contact_name_ph}
          </label>
          <input id="contact-name" name="name" autoComplete="name" required maxLength={120} defaultValue={values.name} placeholder={t.contact_name_ph} className={styles.input} {...invalid("name")} />
          {errorFor("name")}
          <label className="visually-hidden" htmlFor="contact-email">
            {t.contact_email_ph}
          </label>
          <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={200} defaultValue={values.email} placeholder={t.contact_email_ph} className={styles.input} {...invalid("email")} />
          {errorFor("email")}
          <label className="visually-hidden" htmlFor="contact-message">
            {t.contact_help_ph}
          </label>
          <textarea id="contact-message" name="message" rows={4} required maxLength={5000} defaultValue={values.message} placeholder={t.contact_help_ph} className={`${styles.input} ${styles.textarea}`} {...invalid("message")} />
          {errorFor("message")}
          <button type="submit" disabled={pending} className={`btn btn-primary ${styles.submit}`}>
            {pending ? t.f_sending : t.send_button}
          </button>
        </div>
      </Fragment>
    </form>
  );
}
