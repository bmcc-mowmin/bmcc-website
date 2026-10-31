"use client";

import { useEffect } from "react";

// Constant Contact's inline sign-up form (Sign-up Forms → Inline). The form submits straight to
// Constant Contact, which handles confirmation (Confirmed Opt-In), reCAPTCHA and unsubscribes.
//
// It needs Constant Contact's "Universal Code" on the page: the account id in `_ctct_m` and their
// widget script, which fills every `.ctct-inline-form` it finds. The script is loaded here (only on
// pages that show the form). When the visitor arrives by in-site navigation the script may already
// be on the page, so it is reloaded to make it render this form.
const SCRIPT_ID = "signupScript";
const SCRIPT_SRC = "https://static.ctctcdn.com/js/signup-form-widget/current/signup-form-widget.min.js";

declare global {
  interface Window {
    _ctct_m?: string;
  }
}

export function ConstantContactForm({ accountId, formId }: { accountId: string; formId: string }) {
  useEffect(() => {
    window._ctct_m = accountId;
    document.getElementById(SCRIPT_ID)?.remove();
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  }, [accountId, formId]);

  return <div className="ctct-inline-form" data-form-id={formId} />;
}
