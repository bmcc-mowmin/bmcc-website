"use client";

import { Fragment, useActionState, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { HoneypotFields } from "@/components/forms/HoneypotFields";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { CATEGORIES, IMPACTS, MAX_ATTACHMENTS } from "@/lib/bugs/rules";
import { submitBugReport, type ReportState } from "./actions";
import styles from "./report.module.css";

// The public "Report a problem" form. Files a BugReport (Admin → Bugs) and emails the triagers;
// the reporter gets a reference number. `from` is the page the visitor came from (footer link).
export function ReportForm({ from, signedIn }: { from: string; signedIn: { name: string; email: string } | null }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ReportState, FormData>(submitBugReport, { status: "idle" });
  const [viewport, setViewport] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  useEffect(() => setViewport(`${window.innerWidth}×${window.innerHeight}`), []);

  if (state.status === "done") {
    return (
      <div className={styles.done} role="status">
        <h2>{t.bug_done_title}</h2>
        {state.ref && (
          <p>
            {t.bug_done_ref} <span className={styles.ref}>{state.ref}</span>
          </p>
        )}
        <p>{state.emailed ? t.bug_done_emailed : t.bug_done_no_email}</p>
        <div className={styles.doneLinks}>
          <a href={from || "/"}>{t.bug_done_back}</a>
          <a href={`/report-a-problem${from ? `?from=${encodeURIComponent(from)}` : ""}`}>{t.bug_done_another}</a>
        </div>
      </div>
    );
  }

  const values: Record<string, string> = state.status === "error" ? state.values : { pageUrl: from, name: signedIn?.name ?? "", email: signedIn?.email ?? "" };
  const errors = state.status === "error" ? state.errors : {};
  const formKey = state.status === "error" ? JSON.stringify([values, errors]) : "fresh";

  const describedBy = (name: string, hint?: boolean) => [hint && `${name}-hint`, errors[name] && `${name}-error`].filter(Boolean).join(" ") || undefined;
  const errorFor = (name: string) =>
    errors[name] && (
      <span id={`${name}-error`} className={styles.error}>
        {t[errors[name] as MessageKey] ?? t.form_error_required}
      </span>
    );
  const label = (name: string, text: string, required: boolean) => (
    <label htmlFor={`b-${name}`} className={styles.label}>
      {text} {!required && <span className={styles.optional}>({t.f_optional})</span>}
    </label>
  );
  const input = (name: string, text: string, opts: { required?: boolean; hint?: string; type?: string; autoComplete?: string; textarea?: boolean; maxLength: number }) => (
    <div className={styles.field}>
      {label(name, text, !!opts.required)}
      {opts.textarea ? (
        <textarea
          id={`b-${name}`}
          name={name}
          rows={4}
          required={opts.required}
          maxLength={opts.maxLength}
          defaultValue={values[name] ?? ""}
          aria-invalid={errors[name] ? true : undefined}
          aria-describedby={describedBy(name, !!opts.hint)}
          className={`${styles.input} ${errors[name] ? styles.invalid : ""}`}
        />
      ) : (
        <input
          id={`b-${name}`}
          name={name}
          type={opts.type ?? "text"}
          required={opts.required}
          maxLength={opts.maxLength}
          autoComplete={opts.autoComplete}
          defaultValue={values[name] ?? ""}
          aria-invalid={errors[name] ? true : undefined}
          aria-describedby={describedBy(name, !!opts.hint)}
          className={`${styles.input} ${errors[name] ? styles.invalid : ""}`}
        />
      )}
      {opts.hint && (
        <span id={`${name}-hint`} className={styles.hint}>
          {opts.hint}
        </span>
      )}
      {errorFor(name)}
    </div>
  );

  return (
    <form action={action} className={styles.form} noValidate encType="multipart/form-data">
      {/* The spam timer stays outside the part that remounts after an error (remounting would restart it). */}
      <HoneypotFields />
      <input type="hidden" name="viewport" value={viewport} />
      <Fragment key={formKey}>
        {state.status === "error" && (
          <p role="alert" className={styles.formError}>
            {state.message}
          </p>
        )}

        {input("title", t.bug_f_title, { required: true, hint: t.bug_f_title_hint, maxLength: 150 })}

        <div className={styles.field}>
          {label("category", t.bug_f_category, true)}
          <select
            id="b-category"
            name="category"
            required
            defaultValue={values.category ?? ""}
            aria-invalid={errors.category ? true : undefined}
            aria-describedby={describedBy("category")}
            className={`${styles.input} ${errors.category ? styles.invalid : ""}`}
          >
            <option value="" disabled>
              —
            </option>
            {Object.entries(CATEGORIES).map(([id, key]) => (
              <option key={id} value={id}>
                {t[key]}
              </option>
            ))}
          </select>
          {errorFor("category")}
        </div>

        {input("pageUrl", t.bug_f_page, { hint: t.bug_f_page_hint, maxLength: 500 })}
        {input("description", t.bug_f_description, { required: true, textarea: true, hint: t.bug_f_description_hint, maxLength: 5000 })}
        {input("steps", t.bug_f_steps, { textarea: true, hint: t.bug_f_steps_hint, maxLength: 3000 })}
        {input("expected", t.bug_f_expected, { textarea: true, maxLength: 2000 })}

        <fieldset className={styles.fieldset} aria-describedby={errors.impact ? "impact-error" : undefined}>
          <legend className={styles.label}>{t.bug_f_impact}</legend>
          <div className={styles.radiosStack}>
            {Object.entries(IMPACTS).map(([id, key]) => (
              <label key={id}>
                <input type="radio" name="impact" value={id} required defaultChecked={values.impact === id} /> {t[key]}
              </label>
            ))}
          </div>
          {errorFor("impact")}
        </fieldset>

        <div className={styles.field}>
          {label("files", t.bug_f_files, false)}
          <input
            id="b-files"
            name="files"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-describedby={describedBy("files", true)}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))}
            className={styles.input}
          />
          <span id="files-hint" className={styles.hint}>
            {t.bug_files_hint.replace("{n}", String(MAX_ATTACHMENTS))}
            {state.status === "error" && ` ${t.bug_files_again}`}
          </span>
          {files.length > 0 && (
            <ul className={styles.fileList}>
              {files.map((f) => (
                <li key={f}>
                  <bdi>{f}</bdi>
                </li>
              ))}
            </ul>
          )}
          {errorFor("files")}
        </div>

        <div className={styles.divider} />
        <div className={styles.row}>
          {input("name", t.bug_f_name, { autoComplete: "name", maxLength: 120 })}
          {input("email", t.bug_f_email, { type: "email", autoComplete: "email", hint: t.bug_f_email_hint, maxLength: 200 })}
        </div>
        <p className={styles.privacy}>{t.bug_privacy}</p>
        <button type="submit" disabled={pending} className={styles.submit}>
          {pending ? t.f_sending : t.bug_submit}
        </button>
      </Fragment>
    </form>
  );
}
