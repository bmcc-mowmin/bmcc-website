"use client";

import { useActionState, useEffect, useRef } from "react";
import styles from "./admin.module.css";

export type ActionResult = { ok: boolean; message: string } | undefined;
type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

// A form bound to a server action that shows the action's success/error message inline.
export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  resetOnSuccess = false,
  confirm,
  variant = "primary",
}: {
  action: Action;
  children?: React.ReactNode;
  submitLabel: string;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  variant?: "primary" | "danger" | "secondary";
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className={styles.formFooter}>
        <button type="submit" disabled={pending} className={`${styles.btn} ${styles[variant]}`}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state && (
          <span role="status" className={state.ok ? styles.ok : styles.err}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
