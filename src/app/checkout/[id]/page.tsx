import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isMockPayments } from "@/lib/payments/provider";
import { FUND_LABELS, isFund, usd } from "@/lib/payments/catalog";
import { MockCheckoutForm } from "./MockCheckoutForm";
import styles from "./checkout.module.css";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false } };

// Stand-in for Stripe Checkout while PAYMENT_PROVIDER=mock. Doesn't exist otherwise.
export default async function MockCheckoutPage({ params, searchParams }: PageProps<"/checkout/[id]">) {
  if (!isMockPayments()) notFound();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const session = await db.checkoutSession.findUnique({
    where: { id },
    include: { membership: { include: { household: { include: { members: { where: { relationship: "SELF" } } } } } } },
  });
  if (!session || session.provider !== "mock") notFound();

  const recurring = session.frequency === "MONTHLY" ? " / month" : session.frequency === "YEARLY" ? " / year" : "";
  const what =
    session.kind === "DUES"
      ? `BMCC membership dues (${session.frequency === "YEARLY" ? "yearly" : "monthly"})`
      : `Donation — ${isFund(session.fund) ? FUND_LABELS[session.fund] : "General"}${session.frequency === "MONTHLY" ? " (monthly)" : ""}`;
  const household = session.membership?.household;
  const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

  return (
    <main className={styles.page} lang="en" dir="ltr">
      <div className={styles.banner} role="note">
        TEST MODE — no money moves. In production this step is Stripe Checkout.
      </div>
      <div className={styles.card}>
        <div className={styles.org}>Brentwood Muslim Community Center</div>
        <h1 className={styles.what}>{what}</h1>
        <div className={styles.amount}>
          {usd(session.amountCents)}
          <span>{recurring}</span>
        </div>
        {session.status !== "OPEN" || session.expiresAt < new Date() ? (
          <p className={styles.error}>This checkout has expired or was already completed. Go back and start again.</p>
        ) : (
          <MockCheckoutForm
            checkoutId={session.id}
            amount={`${usd(session.amountCents)}${recurring}`}
            email={session.email ?? household?.email ?? ""}
            name={session.name ?? household?.members[0]?.fullName ?? ""}
            success={str(query.success, "/")}
            cancel={str(query.cancel, "/")}
          />
        )}
      </div>
    </main>
  );
}
