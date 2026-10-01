import { getI18n } from "@/lib/i18n/server";
import { SubscribeForm } from "./SubscribeForm";
import styles from "./mailing-list.module.css";

// "Stay Connected" band at the bottom of Home. Same list and double opt-in as the bar.
export async function NewsletterBand() {
  const { t } = await getI18n();
  return (
    <section className={styles.newsletter} aria-labelledby="newsletter-title">
      <div className={`container ${styles.newsletterInner}`}>
        <div>
          <h2 id="newsletter-title" className={styles.newsletterTitle}>
            {t.newsletter_heading}
          </h2>
          <p className={styles.newsletterText}>{t.newsletter_paragraph}</p>
        </div>
        <SubscribeForm source="newsletter" placeholder={t.newsletter_placeholder} button={t.newsletter_button} done={t.newsletter_thanks} />
      </div>
    </section>
  );
}
