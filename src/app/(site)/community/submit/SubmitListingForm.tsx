"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { HoneypotFields } from "@/components/forms/HoneypotFields";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { submitListing, type SubmitState } from "./actions";
import styles from "./submit.module.css";

export function SubmitListingForm({ parents }: { parents: string[] }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitListing, { status: "idle" });
  const values = state.status === "error" ? state.values : {};
  const errors = state.status === "error" ? state.errors : {};
  const [parent, setParent] = useState(values.parentCategory ?? "");
  // Remount the fields after an error so they show what the person typed.
  const formKey = state.status === "error" ? JSON.stringify([values, errors]) : "fresh";

  if (state.status === "done") {
    return (
      <div className={styles.done} role="status">
        <h2>{t.submit_done_heading}</h2>
        <p>{t.submit_done_text}</p>
        <div className={styles.doneLinks}>
          <Link href="/community">{t.back_to_directory}</Link>
          <a href="/community/submit">{t.submit_another}</a>
        </div>
      </div>
    );
  }

  const field = (name: string, label: string, opts: { type?: string; required?: boolean; hint?: string; placeholder?: string; autoComplete?: string; textarea?: boolean } = {}) => {
    const err = errors[name];
    const describedBy = [opts.hint && `${name}-hint`, err && `${name}-error`].filter(Boolean).join(" ") || undefined;
    const common = {
      id: `f-${name}`,
      name,
      defaultValue: values[name] ?? "",
      required: opts.required,
      placeholder: opts.placeholder,
      autoComplete: opts.autoComplete,
      "aria-invalid": err ? true : undefined,
      "aria-describedby": describedBy,
      className: `${styles.input} ${err ? styles.invalid : ""}`,
    };
    return (
      <div className={styles.field}>
        <label htmlFor={`f-${name}`} className={styles.label}>
          {label} {!opts.required && <span className={styles.optional}>({t.f_optional})</span>}
        </label>
        {opts.textarea ? <textarea rows={5} {...common} /> : <input type={opts.type ?? "text"} {...common} />}
        {opts.hint && (
          <span id={`${name}-hint`} className={styles.hint}>
            {opts.hint}
          </span>
        )}
        {err && (
          <span id={`${name}-error`} className={styles.error}>
            {t[err as MessageKey] ?? t.form_error_required}
          </span>
        )}
      </div>
    );
  };

  return (
    <form action={action} className={styles.form} key={formKey} noValidate>
      {state.status === "error" && (
        <p role="alert" className={styles.formError}>
          {state.message}
        </p>
      )}
      <HoneypotFields />

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>{t.f_listing_type}</legend>
        <div className={styles.radios}>
          <label>
            <input type="radio" name="listingType" value="BUSINESS" defaultChecked={(values.listingType ?? "BUSINESS") === "BUSINESS"} /> {t.f_type_business}
          </label>
          <label>
            <input type="radio" name="listingType" value="INDIVIDUAL" defaultChecked={values.listingType === "INDIVIDUAL"} /> {t.f_type_individual}
          </label>
        </div>
      </fieldset>

      {field("name", t.f_name, { required: true, autoComplete: "organization" })}

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="f-parentCategory" className={styles.label}>
            {t.f_parent_category}
          </label>
          <select
            id="f-parentCategory"
            name="parentCategory"
            required
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            aria-invalid={errors.parentCategory ? true : undefined}
            className={`${styles.input} ${errors.parentCategory ? styles.invalid : ""}`}
          >
            <option value="" disabled>
              —
            </option>
            {parents.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="__other">{t.f_parent_other}</option>
          </select>
          {errors.parentCategory && parent !== "__other" && <span className={styles.error}>{t.form_error_required}</span>}
        </div>
        {field("category", t.f_category, { required: true, placeholder: t.f_category_ph })}
      </div>
      {parent === "__other" && field("parentCategoryNew", t.f_parent_new, { required: true })}

      {field("description", t.f_description, { required: true, textarea: true })}
      {field("tags", t.f_tags, { hint: t.f_tags_hint })}

      <div className={styles.row}>
        {field("author", t.f_author, { required: true, autoComplete: "name" })}
        {field("phone", t.f_phone, { type: "tel", autoComplete: "tel" })}
      </div>
      <div className={styles.row}>
        {field("email", t.f_email, { type: "email" })}
        {field("website", t.f_website, { type: "text", placeholder: "example.com", autoComplete: "url" })}
      </div>
      {field("address", t.f_address, { autoComplete: "street-address" })}
      <div className={styles.row3}>
        {field("city", t.f_city, { autoComplete: "address-level2" })}
        {field("state", t.f_state, { autoComplete: "address-level1", placeholder: "CA" })}
        {field("zip", t.f_zip, { autoComplete: "postal-code" })}
      </div>

      <div className={styles.divider} />
      {field("submitterEmail", t.f_submitter_email, { type: "email", required: true, hint: t.f_submitter_hint, autoComplete: "email" })}

      <div className={styles.field}>
        <label className={styles.consent}>
          <input type="checkbox" name="consent" defaultChecked={values.consent === "on"} aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? "consent-error" : undefined} />
          <span>{t.f_consent}</span>
        </label>
        {errors.consent && (
          <span id="consent-error" className={styles.error}>
            {t.form_error_consent}
          </span>
        )}
      </div>

      <button type="submit" disabled={pending} className={styles.submit}>
        {pending ? t.f_sending : t.f_submit}
      </button>
    </form>
  );
}
