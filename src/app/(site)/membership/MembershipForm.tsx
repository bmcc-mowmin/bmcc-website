"use client";

import { Fragment, useActionState, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { HoneypotFields } from "@/components/forms/HoneypotFields";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { routes } from "@/lib/routes";
import { PayButtons } from "@/components/payments/PayButtons";
import type { PaymentMethod } from "@/lib/payments/methods";
import { applyForMembership, type MembershipState } from "./actions";
import styles from "./membership.module.css";

const REL = ["SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"] as const;

// `methods`: payment methods offered for dues (from PAYMENT_METHODS), main one first.
export function MembershipForm({ methods }: { methods: PaymentMethod[] }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<MembershipState, FormData>(applyForMembership, undefined);
  const values = state?.values ?? {};
  const errors = state?.errors ?? {};
  // Household rows keep stable ids so removing one doesn't shift the others' typed values.
  const initialRows = [...new Set(Object.keys(values).filter((k) => k.startsWith("dep.")).map((k) => Number(k.split(".")[1])))];
  const [rows, setRows] = useState<number[]>(initialRows);
  const [plan, setPlan] = useState<"MONTHLY" | "YEARLY">((values.plan as "MONTHLY" | "YEARLY") ?? "MONTHLY");
  const err = (name: string) => (errors[name] ? (t[errors[name] as MessageKey] ?? t.form_error_required) : null);

  const input = (name: string, label: string, opts: { type?: string; required?: boolean; placeholder?: string; autoComplete?: string; full?: boolean; small?: boolean } = {}) => {
    const e = err(name);
    const id = `m-${name.replace(/\./g, "-")}`;
    return (
      <div className={`${styles.field} ${opts.full ? styles.full : ""}`}>
        <label htmlFor={id} className={opts.small ? styles.labelSmall : styles.label}>
          {label}
        </label>
        <input
          id={id}
          name={name}
          type={opts.type ?? "text"}
          required={opts.required}
          placeholder={opts.placeholder}
          autoComplete={opts.autoComplete}
          defaultValue={values[name] ?? ""}
          aria-invalid={e ? true : undefined}
          aria-describedby={e ? `${id}-error` : undefined}
          className={`${opts.small ? styles.inputSmall : styles.input} ${e ? styles.invalid : ""}`}
        />
        {e && (
          <span id={`${id}-error`} className={styles.error}>
            {e}
          </span>
        )}
      </div>
    );
  };

  const formKey = state ? JSON.stringify([values, errors]) : "fresh";
  return (
    <form action={action} noValidate className={styles.form}>
      {/* The spam timer stays outside the part that remounts after an error (remounting would restart it). */}
      <HoneypotFields />
      <Fragment key={formKey}>
      {state?.message && (
        <p role="alert" className={styles.formError}>
          {state.message}
        </p>
      )}

      {/* 1. Primary member */}
      <section className={styles.block} aria-labelledby="m1">
        <h2 id="m1" className={styles.h2}>
          {t.m1_title}
        </h2>
        <p className={styles.sub}>{t.m1_sub}</p>
        <div className={styles.grid2}>
          {input("fullName", t.m1_fullname, { required: true, placeholder: t.m1_fullname_ph, autoComplete: "name", full: true })}
          {input("street", t.m1_street, { required: true, autoComplete: "street-address", full: true })}
          <div className={`${styles.full} ${styles.grid3}`}>
            {input("city", t.m1_city, { required: true, autoComplete: "address-level2" })}
            {input("state", t.m1_state, { required: true, autoComplete: "address-level1", placeholder: "CA" })}
            {input("zip", t.m1_zip, { required: true, autoComplete: "postal-code" })}
          </div>
          {input("dob", t.m1_dob, { type: "date", required: true, autoComplete: "bday" })}
          {input("phone", t.m1_phone, { type: "tel", required: true, placeholder: "(925) 555-0100", autoComplete: "tel" })}
          {input("email", t.m1_email, { type: "email", required: true, placeholder: "you@example.com", autoComplete: "email", full: true })}
          {input("emergencyName", t.m1_emergency_name)}
          {input("emergencyPhone", t.m1_emergency_phone, { type: "tel" })}
        </div>
      </section>

      {/* 2. Household & dependents */}
      <section className={styles.block} aria-labelledby="m2">
        <h2 id="m2" className={styles.h2}>
          {t.m2_title}
        </h2>
        <p className={styles.sub}>{t.m2_sub}</p>
        {rows.map((id, index) => {
          const relErr = err(`dep.${id}.relationship`);
          return (
            <fieldset key={id} className={styles.dependent}>
              <legend className="visually-hidden">{t.m2_member_label.replace("{n}", String(index + 1))}</legend>
              <button type="button" className={styles.remove} aria-label={t.m2_remove} onClick={() => setRows((r) => r.filter((x) => x !== id))}>
                ×
              </button>
              <div className={styles.grid2}>
                {input(`dep.${id}.name`, t.m1_fullname, { small: true })}
                <div className={styles.field}>
                  <label htmlFor={`m-dep-${id}-relationship`} className={styles.labelSmall}>
                    {t.m2_relationship}
                  </label>
                  <select
                    id={`m-dep-${id}-relationship`}
                    name={`dep.${id}.relationship`}
                    defaultValue={values[`dep.${id}.relationship`] ?? ""}
                    aria-invalid={relErr ? true : undefined}
                    className={`${styles.inputSmall} ${relErr ? styles.invalid : ""}`}
                  >
                    <option value="">—</option>
                    {REL.map((r) => (
                      <option key={r} value={r}>
                        {t[`m2_rel_${r.toLowerCase()}` as MessageKey]}
                      </option>
                    ))}
                  </select>
                  {relErr && <span className={styles.error}>{relErr}</span>}
                </div>
                {input(`dep.${id}.dob`, t.m1_dob, { type: "date", small: true })}
                {input(`dep.${id}.phone`, t.m1_phone, { type: "tel", placeholder: t.m2_phone_ph, small: true })}
                {input(`dep.${id}.email`, t.m1_email, { type: "email", placeholder: t.m2_email_ph, small: true, full: true })}
              </div>
            </fieldset>
          );
        })}
        <button type="button" className={styles.add} onClick={() => setRows((r) => [...r, (r.at(-1) ?? 0) + 1])}>
          {t.m2_add}
        </button>
      </section>

      {/* 3. Fees */}
      <section className={styles.block} aria-labelledby="m3">
        <h2 id="m3" className={styles.h2}>
          {t.m3_title}
        </h2>
        <p className={styles.sub}>{t.m3_sub}</p>
        <input type="hidden" name="plan" value={plan} />
        <div className={styles.grid2} role="radiogroup" aria-labelledby="m3">
          <button type="button" role="radio" aria-checked={plan === "MONTHLY"} className={`${styles.plan} ${plan === "MONTHLY" ? styles.planSelected : ""}`} onClick={() => setPlan("MONTHLY")}>
            <span className={styles.planName}>{t.m3_monthly}</span>
            <span className={styles.planPrice}>
              $100<span>{t.per_month_short}</span>
            </span>
          </button>
          <button type="button" role="radio" aria-checked={plan === "YEARLY"} className={`${styles.plan} ${plan === "YEARLY" ? styles.planSelected : ""}`} onClick={() => setPlan("YEARLY")}>
            <span className={styles.planName}>
              {t.m3_yearly} <span className={styles.save}>{t.m3_save}</span>
            </span>
            <span className={styles.planPrice}>
              $1,000<span>{t.per_year_short}</span>
            </span>
          </button>
        </div>
      </section>

      {/* 4. Funeral benefit (information) */}
      <section className={styles.benefit} aria-labelledby="m4">
        <h3 id="m4" className={styles.benefitTitle}>
          {t.m4_title}
        </h3>
        <p className={styles.benefitText}>
          {t.m4_text_prefix}{" "}
          <a href={routes.funeral} target="_blank" rel="noopener">
            {t.m4_link}
          </a>{" "}
          {t.m4_text_suffix}
        </p>
      </section>

      {/* 5. Declaration */}
      <section className={styles.block} aria-labelledby="m5">
        <h2 id="m5" className={styles.h2} style={{ marginBottom: 14 }}>
          {t.m5_title}
        </h2>
        <label className={styles.declaration}>
          <input type="checkbox" name="declaration" defaultChecked={values.declaration === "on"} aria-invalid={errors.declaration ? true : undefined} aria-describedby={errors.declaration ? "declaration-error" : undefined} />
          <span>{t.m5_text}</span>
        </label>
        {errors.declaration && (
          <span id="declaration-error" className={styles.error}>
            {t.m_error_declaration}
          </span>
        )}
      </section>

      <PayButtons
        methods={methods}
        disabled={pending}
        className={styles.submit}
        label={(m) => (pending ? t.f_sending : methods.length < 2 ? t.submit_application : m === "paypal" ? t.m_submit_paypal : t.m_submit_card)}
      />
      <p className={styles.note}>{t.m_payment_note}</p>
      <p className={styles.note}>{t.confirm_note}</p>
      </Fragment>
    </form>
  );
}
