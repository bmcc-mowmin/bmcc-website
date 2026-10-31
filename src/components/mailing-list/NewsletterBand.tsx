import { getI18n } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { SubscribeForm } from "./SubscribeForm";
import { ConstantContactForm } from "./ConstantContactForm";
import styles from "./mailing-list.module.css";

// Where the re-subscribe bar's button scrolls to.
export const NEWSLETTER_ANCHOR = "stay-connected";

// "Stay Connected" band at the bottom of Home. With CONSTANT_CONTACT_ACCOUNT and _FORM_ID set it
// shows Constant Contact's sign-up form; otherwise the site's own form (same list and double
// opt-in as the bar).
export async function NewsletterBand() {
  const { t } = await getI18n();
  const cc = env.CONSTANT_CONTACT_ACCOUNT && env.CONSTANT_CONTACT_FORM_ID ? { accountId: env.CONSTANT_CONTACT_ACCOUNT, formId: env.CONSTANT_CONTACT_FORM_ID } : null;
  return (
    <section id={NEWSLETTER_ANCHOR} className={styles.newsletter} aria-labelledby="newsletter-title">
      <div className={`container ${styles.newsletterInner}`}>
        <div>
          <h2 id="newsletter-title" className={styles.newsletterTitle}>
            {t.newsletter_heading}
          </h2>
          <p className={styles.newsletterText}>{t.newsletter_paragraph}</p>
        </div>
        {cc ? (
          <div className={styles.ctct}>
            <ConstantContactForm {...cc} />
          </div>
        ) : (
          <SubscribeForm source="newsletter" placeholder={t.newsletter_placeholder} button={t.newsletter_button} done={t.newsletter_thanks} />
        )}
      </div>
    </section>
  );
}
