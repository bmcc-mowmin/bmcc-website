"use client";

import { Fragment, useActionState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { requestCoverageChange, updateHouseholdContact, type FormState } from "../actions";
import styles from "../account.module.css";

function Status({ state }: { state: FormState }) {
  const { t } = useI18n();
  if (state.status === "done") return <p role="status" className={styles.ok}>{state.message}</p>;
  if (state.status === "error") return <p role="alert" className={styles.err}>{state.message || t.form_error_generic}</p>;
  return null;
}

type Contact = Record<"addressLine1" | "addressLine2" | "city" | "state" | "zip" | "phone" | "emergencyName" | "emergencyPhone", string>;

export function ContactForm({ initial }: { initial: Contact }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(updateHouseholdContact, { status: "idle" });
  const values: Record<string, string> = state.status === "error" ? state.values : initial;
  const errors = state.status === "error" ? state.errors : {};
  const field = (name: keyof Contact, label: string, opts: { autoComplete?: string; type?: string; optional?: boolean } = {}) => (
    <div className={styles.field}>
      <label htmlFor={`hh-${name}`} className={styles.label}>
        {label} {opts.optional && <span className={styles.muted}>({t.f_optional})</span>}
      </label>
      <input
        id={`hh-${name}`}
        name={name}
        type={opts.type ?? "text"}
        autoComplete={opts.autoComplete}
        defaultValue={values[name]}
        required={!opts.optional}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `hh-${name}-error` : undefined}
        className={styles.input}
      />
      {errors[name] && (
        <span id={`hh-${name}-error`} className={styles.fieldError}>
          {t[errors[name] as MessageKey] ?? t.form_error_required}
        </span>
      )}
    </div>
  );
  return (
    <form action={action} noValidate>
      <Fragment key={JSON.stringify(state)}>
        <div className={styles.grid2}>
          {field("addressLine1", t.m1_street, { autoComplete: "address-line1" })}
          {field("addressLine2", t.acct_address2, { autoComplete: "address-line2", optional: true })}
          {field("city", t.m1_city, { autoComplete: "address-level2" })}
          {field("state", t.m1_state, { autoComplete: "address-level1" })}
          {field("zip", t.m1_zip, { autoComplete: "postal-code" })}
          {field("phone", t.m1_phone, { autoComplete: "tel", type: "tel" })}
          {field("emergencyName", t.m1_emergency_name, { optional: true })}
          {field("emergencyPhone", t.m1_emergency_phone, { type: "tel", optional: true })}
        </div>
      </Fragment>
      <div className={styles.formFooter}>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? t.f_sending : t.acct_save}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function CoverageRequestForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(requestCoverageChange, { status: "idle" });
  if (state.status === "done") return <p role="status" className={styles.ok}>{state.message}</p>;
  const error = state.status === "error" ? state.errors.message : undefined;
  return (
    <form action={action} noValidate>
      <label htmlFor="coverage-message" className="visually-hidden">
        {t.acct_change_people_title}
      </label>
      <textarea
        key={JSON.stringify(state)}
        id="coverage-message"
        name="message"
        rows={3}
        maxLength={3000}
        required
        defaultValue={state.status === "error" ? state.values.message : ""}
        placeholder={t.acct_change_people_ph}
        aria-invalid={error ? true : undefined}
        className={styles.input}
      />
      <div className={styles.formFooter}>
        <button type="submit" disabled={pending} className="btn btn-dark">
          {pending ? t.f_sending : t.acct_change_people_button}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
