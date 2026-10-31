import { getI18n } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { ResubBarClient } from "./ResubBarClient";
import { NEWSLETTER_ANCHOR } from "./NewsletterBand";

export const RESUB_DISMISSED_KEY = "bmcc_resub_dismissed";

// "We've moved to a new mailing list" bar. Dismissing it is remembered for the browser session
// (sessionStorage, as in the prototype). The tiny inline script runs before the page paints, so a
// dismissed bar doesn't flash back on the next page.
export async function ResubBar() {
  const { t } = await getI18n();
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem(${JSON.stringify(RESUB_DISMISSED_KEY)})==="1")document.documentElement.setAttribute("data-resub-dismissed","")}catch(e){}`,
        }}
      />
      <ResubBarClient
        storageKey={RESUB_DISMISSED_KEY}
        closeLabel={t.close}
        title={t.resub_title}
        body={t.resub_body}
        placeholder={t.resub_placeholder}
        button={t.resub_button}
        done={t.resub_done}
        // With Constant Contact, the bar's button goes to its form in the "Stay Connected" band on Home.
        signUpHref={env.CONSTANT_CONTACT_ACCOUNT && env.CONSTANT_CONTACT_FORM_ID ? `/#${NEWSLETTER_ANCHOR}` : undefined}
      />
    </>
  );
}
