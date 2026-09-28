import Link from "next/link";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/footer/SiteFooter";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container section-y" style={{ minHeight: "40vh" }}>
        <div className="eyebrow">404</div>
        <h1 className="page-h1">Page not found</h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          The page you are looking for does not exist or has moved.
        </p>
        <Link href="/" className="btn btn-primary">
          Back to Home
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
