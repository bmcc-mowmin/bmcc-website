"use client";

import { useActionState } from "react";
import { mockCancel, mockPay, type MockCheckoutState } from "./actions";
import styles from "./checkout.module.css";

export function MockCheckoutForm(props: { checkoutId: string; amount: string; email: string; name: string; success: string; cancel: string }) {
  const [state, action, pending] = useActionState<MockCheckoutState, FormData>(mockPay, undefined);
  return (
    <>
      <form action={action} className={styles.form}>
        <input type="hidden" name="checkoutId" value={props.checkoutId} />
        <input type="hidden" name="success" value={props.success} />
        {state?.error && (
          <p role="alert" className={styles.error}>
            {state.error}
          </p>
        )}
        <label htmlFor="co-name" className={styles.label}>
          Name
        </label>
        <input id="co-name" name="name" defaultValue={props.name} autoComplete="name" required className={styles.input} />
        <label htmlFor="co-email" className={styles.label}>
          Email (your receipt is sent here)
        </label>
        <input id="co-email" name="email" type="email" defaultValue={props.email} autoComplete="email" required className={styles.input} />
        <div className={styles.cardBox}>
          <strong>Card</strong> — not collected in test mode. In production this page is Stripe Checkout, where the card is
          entered on Stripe&apos;s own secure page.
        </div>
        <button type="submit" name="outcome" value="pay" disabled={pending} className={styles.pay}>
          {pending ? "Processing…" : `Pay ${props.amount} (test)`}
        </button>
        <button type="submit" name="outcome" value="decline" disabled={pending} className={styles.decline}>
          Simulate a declined card
        </button>
      </form>
      <form action={mockCancel}>
        <input type="hidden" name="checkoutId" value={props.checkoutId} />
        <input type="hidden" name="cancel" value={props.cancel} />
        <button type="submit" className={styles.cancel}>
          ← Cancel and go back
        </button>
      </form>
    </>
  );
}
