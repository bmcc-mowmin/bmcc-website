"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { PublicListing } from "@/lib/directory";
import { mapLinks } from "@/lib/directory/listing";
import styles from "./directory.module.css";

// "View Details" popup. A native modal <dialog>: the rest of the page is inert (focus stays
// inside), Escape closes it, and focus returns to the button that opened it. Clicking the dark
// backdrop or × also closes it.
export function ListingDialog({ listing, onClose, mapsKey }: { listing: PublicListing | null; onClose: () => void; mapsKey?: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (listing && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!listing && dialog.open) {
      dialog.close();
    }
  }, [listing]);

  const handleClose = () => {
    document.body.style.overflow = "";
    (opener.current as HTMLElement | null)?.focus?.();
    onClose();
  };

  const maps = listing ? mapLinks(listing, mapsKey) : null;
  const tel = listing?.phone ? `tel:${listing.phone.replace(/[^0-9+]/g, "")}` : null;
  const subline = listing ? [listing.category, listing.address ?? listing.city].filter(Boolean).join(" · ") : "";

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="listing-title"
      onClose={handleClose}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      {listing && (
        <div className={styles.dialogPanel}>
          <button type="button" className={styles.dialogClose} onClick={() => ref.current?.close()} aria-label={t.close} autoFocus>
            ×
          </button>
          {maps ? (
            <iframe src={maps.embed} title={`${listing.name} — map`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className={styles.map} />
          ) : (
            <div className={styles.noMap}>{t.no_location}</div>
          )}
          <div className={styles.dialogBody}>
            <div className={styles.dialogHead}>
              <h2 id="listing-title" className={styles.dialogTitle}>
                {listing.name}
              </h2>
              <span className={styles.pill}>{listing.parentCategory}</span>
            </div>
            <div className={styles.subline}>{subline}</div>
            <p className={styles.dialogDescription}>{listing.description}</p>
            <div className={styles.facts}>
              {tel && (
                <a href={tel} className={styles.factPhone}>
                  ☎ {listing.phone}
                </a>
              )}
              {listing.email && <a href={`mailto:${listing.email}`}>{listing.email}</a>}
              {listing.city && (
                <span>
                  <strong>{t.city_label}</strong> {listing.city}
                </span>
              )}
              {listing.state && (
                <span>
                  <strong>{t.state_label}</strong> {listing.state}
                </span>
              )}
              {listing.zip && (
                <span>
                  <strong>{t.zip_label}</strong> {listing.zip}
                </span>
              )}
              <span>
                <strong>{t.posted_by}</strong> {listing.author}
              </span>
            </div>
            <div className={styles.dialogActions}>
              {maps && (
                <>
                  <a href={maps.open} target="_blank" rel="noopener" className={styles.btnPrimary}>
                    {t.open_in_maps} ↗
                  </a>
                  <a href={maps.directions} target="_blank" rel="noopener" className={styles.btnOutline}>
                    {t.get_directions}
                  </a>
                </>
              )}
              {listing.website && (
                <a href={listing.website} target="_blank" rel="noopener nofollow ugc" className={styles.btnGhost}>
                  {t.visit_website}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
