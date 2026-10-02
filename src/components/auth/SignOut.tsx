import { SignOutButton } from "@clerk/nextjs";
import { env } from "@/lib/env";

// "Sign out": ends the Clerk session (AUTH_PROVIDER=clerk) or the local dev session (`action`).
export function SignOut({ label, className, action, redirectUrl = "/" }: { label: string; className?: string; action: (form: FormData) => Promise<void>; redirectUrl?: string }) {
  if (env.AUTH_PROVIDER === "clerk") {
    return (
      <SignOutButton redirectUrl={redirectUrl}>
        <button type="button" className={className}>
          {label}
        </button>
      </SignOutButton>
    );
  }
  return (
    <form action={action}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
