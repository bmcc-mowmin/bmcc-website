import { getI18n } from "@/lib/i18n/server";
import { ResubBarClient } from "./ResubBarClient";

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
      <ResubBarClient storageKey={RESUB_DISMISSED_KEY} closeLabel={t.close} title={t.resub_title} body={t.resub_body} placeholder={t.resub_placeholder} button={t.resub_button} done={t.resub_done} />
    </>
  );
}
