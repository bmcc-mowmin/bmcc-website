"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { HoneypotFields } from "@/components/forms/HoneypotFields";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { DEFAULT_AMOUNT, FUNDS, MAX_DONATION, MIN_DONATION, PRESET_AMOUNTS, type FundId } from "@/lib/payments/catalog";
import { startDonation, type DonateState } from "./actions";
import styles from "./donate.module.css";

export function DonateForm({ defaultFrequency, initialFund }: { defaultFrequency: "monthly" | "one-time"; initialFund: FundId }) {
  const { t } = useI18n();
  const [fund, setFund] = useState<FundId>(initialFund);
  const [frequency, setFrequency] = useState(defaultFrequency);
  const [amount, setAmount] = useState<number | null>(DEFAULT_AMOUNT);
  const [custom, setCustom] = useState("");
  const [state, action, pending] = useActionState<DonateState, FormData>(startDonation, undefined);

  const chosen = custom ? Number(custom) : amount;
  const valid = !!chosen && chosen >= MIN_DONATION && chosen <= MAX_DONATION;
  const monthly = frequency === "monthly";
  const fundName = t[FUNDS.find((f) => f.id === fund)!.nameKey as MessageKey];
  const label = `${t.donate_button_prefix} $${chosen && Number.isFinite(chosen) ? chosen.toLocaleString("en-US") : "—"} ${monthly ? t.donate_suffix_monthly : t.donate_suffix_once} ${t.donate_button_to} ${fundName}`;

  return (
    <form action={action} className={styles.card}>
      <HoneypotFields />
      <input type="hidden" name="fund" value={fund} />
      <input type="hidden" name="frequency" value={frequency} />
      <input type="hidden" name="amount" value={chosen ?? ""} />

      <h2 className={styles.cardTitle}>{t.donate_make_title}</h2>
      <p className={styles.cardSub}>{t.donate_make_sub}</p>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>{t.donate_choose_fund}</legend>
        <div className={styles.funds}>
          {FUNDS.map((f) => (
            <label key={f.id} className={`${styles.fund} ${fund === f.id ? styles.fundSelected : ""}`}>
              <input type="radio" name="fund-choice" value={f.id} checked={fund === f.id} onChange={() => setFund(f.id)} className="visually-hidden" />
              <span className={styles.fundName}>{t[f.nameKey as MessageKey]}</span>
              <span className={styles.fundDesc}>{t[f.descKey as MessageKey]}</span>
            </label>
          ))}
        </div>
        {fund === "new-bmcc" && (
          <Link href="/new-bmcc" className={styles.projectLink}>
            {t.nb_about_project} →
          </Link>
        )}
      </fieldset>

      <div className={styles.segmented} role="radiogroup" aria-label={t.donate_choose_fund}>
        {(["one-time", "monthly"] as const).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={frequency === f} className={frequency === f ? styles.segActive : ""} onClick={() => setFrequency(f)}>
            {f === "monthly" ? t.donate_monthly : t.donate_one_time}
          </button>
        ))}
      </div>

      <div className={styles.amounts} role="radiogroup" aria-label={t.donate_amount_label}>
        {PRESET_AMOUNTS.map((v) => {
          const selected = !custom && amount === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`${styles.amount} ${selected ? styles.amountSelected : ""}`}
              onClick={() => {
                setAmount(v);
                setCustom("");
              }}
            >
              ${v}
            </button>
          );
        })}
      </div>
      <div className={styles.customWrap}>
        <label htmlFor="custom-amount" className={styles.label}>
          {t.donate_other_amount}
        </label>
        <div className={styles.customInput}>
          <span aria-hidden>$</span>
          <input
            id="custom-amount"
            inputMode="decimal"
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={String(DEFAULT_AMOUNT)}
            aria-describedby="amount-help"
          />
        </div>
        <span id="amount-help" className={styles.help}>
          {chosen && chosen > MAX_DONATION ? t.donate_max_error : chosen !== null && chosen < MIN_DONATION ? t.donate_min_error : ""}
        </span>
      </div>

      {state?.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={!valid || pending} className={styles.donateButton}>
        {label} →
      </button>
      <p className={styles.note}>{t.donate_receipts_note}</p>
    </form>
  );
}
