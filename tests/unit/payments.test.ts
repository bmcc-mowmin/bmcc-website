import { test } from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { parsePaymentMethods, paymentTypeFor, DEFAULT_PAYMENT_METHODS } from "../../src/lib/payments/methods";
import { accountsInUse, parseStripeAccountMap, stripeAccountFor, stripeKeyVar, stripeWebhookVar } from "../../src/lib/payments/stripe-accounts";
import { firstPaymentId, paypalOrderEvent, paypalSubscriptionStartEvent, stripeBillingEvent, stripeSessionEvent } from "../../src/lib/payments/mappers";

// ── Settings ──────────────────────────────────────────────────────────────────

test("PAYMENT_METHODS maps each payment type to its methods, in order", () => {
  const r = parsePaymentMethods("donation:stripe,paypal; donation_monthly:stripe ;dues: paypal , stripe");
  assert.ok(r.ok);
  assert.deepEqual(r.map, { donation: ["stripe", "paypal"], donation_monthly: ["stripe"], dues: ["paypal", "stripe"] });
  assert.ok(parsePaymentMethods(DEFAULT_PAYMENT_METHODS).ok);
});

test("PAYMENT_METHODS rejects unknown types and methods, empty and missing types", () => {
  const r = parsePaymentMethods("donation:stripe,venmo;dues:;gifts:paypal");
  assert.ok(!r.ok);
  const all = r.errors.join(" | ");
  assert.match(all, /unknown payment method "venmo"/);
  assert.match(all, /no payment method for dues/);
  assert.match(all, /unknown payment type "gifts"/);
  assert.match(all, /missing payment type donation_monthly/);
});

test("the payment type follows what the person chose on the page", () => {
  assert.equal(paymentTypeFor("DONATION", false), "donation");
  assert.equal(paymentTypeFor("DONATION", true), "donation_monthly");
  assert.equal(paymentTypeFor("DUES", true), "dues");
});

// ── Stripe ────────────────────────────────────────────────────────────────────

const session = (over: Partial<Stripe.Checkout.Session>) =>
  ({
    id: "cs_test_1",
    object: "checkout.session",
    client_reference_id: "chk_1",
    metadata: { checkoutId: "chk_1" },
    status: "complete",
    payment_status: "paid",
    customer_details: { email: "donor@example.com", name: "Amina Khan" },
    customer_email: null,
    customer: "cus_1",
    payment_intent: "pi_1",
    invoice: null,
    subscription: null,
    created: 1_800_000_000,
    ...over,
  }) as unknown as Stripe.Checkout.Session;

test("Stripe: a paid one-time session becomes checkout.completed with the payment intent", () => {
  const { checkoutId, event } = stripeSessionEvent(session({}));
  assert.equal(checkoutId, "chk_1");
  assert.equal(event?.type, "checkout.completed");
  if (event?.type !== "checkout.completed") return;
  assert.equal(event.eventId, "stripe_checkout_cs_test_1");
  assert.equal(event.providerPaymentId, "pi_1");
  assert.equal(event.email, "donor@example.com");
  assert.equal(event.name, "Amina Khan");
  assert.equal(event.providerSubscriptionId, undefined);
});

test("Stripe: a subscription session uses the first invoice and the period end", () => {
  const { event } = stripeSessionEvent(
    session({
      payment_intent: null,
      invoice: "in_1",
      subscription: { id: "sub_1", items: { data: [{ current_period_end: 1_802_592_000 }] } } as unknown as Stripe.Subscription,
    }),
  );
  if (event?.type !== "checkout.completed") return assert.fail("expected checkout.completed");
  assert.equal(event.providerPaymentId, "in_1");
  assert.equal(event.providerSubscriptionId, "sub_1");
  assert.equal(event.currentPeriodEnd?.toISOString(), new Date(1_802_592_000 * 1000).toISOString());
});

test("Stripe: an unpaid or open session is not recorded yet", () => {
  assert.equal(stripeSessionEvent(session({ payment_status: "unpaid" })).event, null);
  assert.equal(stripeSessionEvent(session({ status: "open" })).event, null);
});

const invoiceEvent = (type: string, invoice: Record<string, unknown>) =>
  ({ id: "evt_1", type, data: { object: { id: "in_2", created: 1_802_000_000, ...invoice } } }) as unknown as Stripe.Event;

test("Stripe: renewals are recorded; the first invoice is left to the checkout", () => {
  const parent = { subscription_details: { subscription: "sub_1" } };
  assert.equal(stripeBillingEvent(invoiceEvent("invoice.paid", { billing_reason: "subscription_create", parent })), null);
  const renewal = stripeBillingEvent(
    invoiceEvent("invoice.paid", { billing_reason: "subscription_cycle", parent, lines: { data: [{ period: { end: 1_805_000_000 } }] }, status_transitions: { paid_at: 1_802_100_000 } }),
  );
  assert.deepEqual(renewal, {
    type: "invoice.paid",
    eventId: "evt_1",
    providerSubscriptionId: "sub_1",
    providerPaymentId: "in_2",
    paidAt: new Date(1_802_100_000 * 1000),
    currentPeriodEnd: new Date(1_805_000_000 * 1000),
  });
  const failed = stripeBillingEvent(invoiceEvent("invoice.payment_failed", { parent }));
  assert.equal(failed?.type, "invoice.failed");
  assert.equal(stripeBillingEvent(invoiceEvent("customer.subscription.deleted", {}))?.type, "subscription.canceled");
  assert.equal(stripeBillingEvent(invoiceEvent("charge.succeeded", {})), null);
});

// ── PayPal ────────────────────────────────────────────────────────────────────

test("PayPal: a captured order becomes checkout.completed with the capture id", () => {
  const { event } = paypalOrderEvent({
    id: "ORDER1",
    status: "COMPLETED",
    payer: { email_address: "payer@example.com", name: { given_name: "Omar", surname: "Ali" } },
    purchase_units: [{ custom_id: "chk_2", payments: { captures: [{ id: "CAP1", status: "COMPLETED", create_time: "2026-10-28T10:00:00Z" }] } }],
  });
  if (event?.type !== "checkout.completed") return assert.fail("expected checkout.completed");
  assert.equal(event.eventId, "paypal_capture_CAP1");
  assert.equal(event.checkoutId, "chk_2");
  assert.equal(event.name, "Omar Ali");
  assert.equal(event.paidAt.toISOString(), "2026-10-28T10:00:00.000Z");
});

test("PayPal: an order without a completed capture is not recorded", () => {
  const { event } = paypalOrderEvent({ id: "ORDER2", status: "APPROVED", payer: { email_address: "p@example.com" }, purchase_units: [{ custom_id: "chk_3" }] });
  assert.equal(event, null);
});

test("PayPal: an active subscription with its first payment starts the checkout", () => {
  const sub = {
    id: "I-SUB1",
    status: "ACTIVE",
    custom_id: "chk_4",
    subscriber: { email_address: "member@example.com", name: { given_name: "Sara", surname: "Noor" }, payer_id: "PAYER1" },
    billing_info: { next_billing_time: "2026-11-28T10:00:00Z", last_payment: { time: "2026-10-28T10:00:00Z", amount: { value: "100.00" } } },
  };
  const { event } = paypalSubscriptionStartEvent(sub);
  if (event?.type !== "checkout.completed") return assert.fail("expected checkout.completed");
  assert.equal(event.eventId, "paypal_sub_start_I-SUB1");
  assert.equal(event.providerPaymentId, firstPaymentId("I-SUB1"));
  assert.equal(event.providerSubscriptionId, "I-SUB1");
  assert.equal(event.currentPeriodEnd?.toISOString(), "2026-11-28T10:00:00.000Z");
  // From the sale webhook: the real sale id, same event id (so it's processed once).
  const fromSale = paypalSubscriptionStartEvent(sub, "SALE1").event;
  assert.equal(fromSale?.type === "checkout.completed" && fromSale.providerPaymentId, "SALE1");
  assert.equal(fromSale?.eventId, "paypal_sub_start_I-SUB1");
});

test("PayPal: an approved-but-not-active subscription waits for the webhook", () => {
  assert.equal(paypalSubscriptionStartEvent({ id: "I-SUB2", status: "APPROVED", custom_id: "chk_5", subscriber: { email_address: "m@example.com" } }).event, null);
  assert.equal(paypalSubscriptionStartEvent({ id: "I-SUB3", status: "ACTIVE", custom_id: "chk_6", subscriber: { email_address: "m@example.com" } }).event, null);
});

// ── Stripe accounts per fund ──────────────────────────────────────────────────


const BMCC_MAP = "dues:operations;masjid-membership:operations;sadaqah-zakat:zakah;zakat-fitr:zakah;new-bmcc:construction;construct-run:building";

test("Stripe accounts: dues and each fund go to their account", () => {
  const r = parseStripeAccountMap(BMCC_MAP);
  assert.ok(r.ok);
  assert.equal(stripeAccountFor(r.map, "DUES"), "operations");
  assert.equal(stripeAccountFor(r.map, "DONATION", "masjid-membership"), "operations");
  assert.equal(stripeAccountFor(r.map, "DONATION", "sadaqah-zakat"), "zakah");
  assert.equal(stripeAccountFor(r.map, "DONATION", "zakat-fitr"), "zakah");
  assert.equal(stripeAccountFor(r.map, "DONATION", "new-bmcc"), "construction");
  assert.equal(stripeAccountFor(r.map, "DONATION", "construct-run"), "building");
  assert.deepEqual(accountsInUse(r.map).sort(), ["building", "construction", "operations", "zakah"]);
});

test("Stripe accounts: unmapped payments use the default account; no map = one account", () => {
  const partial = parseStripeAccountMap("sadaqah-zakat:zakah");
  assert.ok(partial.ok);
  assert.equal(stripeAccountFor(partial.map, "DONATION", "new-bmcc"), "default");
  assert.deepEqual(accountsInUse(partial.map).sort(), ["default", "zakah"]);
  const withDefault = parseStripeAccountMap("default:operations;sadaqah-zakat:zakah");
  assert.ok(withDefault.ok);
  assert.equal(stripeAccountFor(withDefault.map, "DUES"), "operations");
  const none = parseStripeAccountMap(undefined);
  assert.ok(none.ok);
  assert.deepEqual(accountsInUse(none.map), ["default"]);
});

test("Stripe accounts: bad keys and names are rejected; variable names per account", () => {
  const r = parseStripeAccountMap("school-fees:school;dues:Bad Name");
  assert.ok(!r.ok);
  assert.match(r.errors.join(" | "), /unknown payment "school-fees"/);
  assert.match(r.errors.join(" | "), /bad account name/);
  assert.equal(stripeKeyVar("zakah"), "STRIPE_SECRET_KEY_ZAKAH");
  assert.equal(stripeWebhookVar("default"), "STRIPE_WEBHOOK_SECRET");
});
