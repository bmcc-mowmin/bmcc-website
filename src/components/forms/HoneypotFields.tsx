"use client";

import { useState } from "react";

// Hidden from people (and screen readers); bots that fill every field reveal themselves.
// Field names match src/lib/security/honeypot.ts.
export function HoneypotFields() {
  const [started] = useState(() => Date.now());
  return (
    <>
      {/* Clipped to nothing rather than moved off-screen (an off-screen position makes right-to-left pages scroll sideways). */}
      <div aria-hidden="true" data-honeypot="" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap", opacity: 0, pointerEvents: "none" }}>
        <label>
          Leave this empty
          <input type="text" name="company_fax" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {/* The server-rendered time (when the form was shown) is kept on hydration. */}
      <input type="hidden" name="form_started" value={started} suppressHydrationWarning />
    </>
  );
}
