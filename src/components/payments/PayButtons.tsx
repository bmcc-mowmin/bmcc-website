import type { PaymentMethod } from "@/lib/payments/methods";
import styles from "./PayButtons.module.css";

// One submit button per payment method offered (name="method"), main method first. The server
// checks the pressed method is offered for that payment. PayPal gets PayPal's own button colours.
export function PayButtons({
  methods,
  label,
  className,
  disabled,
}: {
  methods: PaymentMethod[];
  label: (method: PaymentMethod) => string;
  className: string;
  disabled?: boolean;
}) {
  return (
    <div className={styles.group}>
      {methods.map((m) => (
        <button key={m} type="submit" name="method" value={m} disabled={disabled} className={`${className} ${m === "paypal" ? styles.paypal : ""}`}>
          {label(m)}
        </button>
      ))}
    </div>
  );
}
