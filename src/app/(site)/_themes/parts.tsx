import { useId } from "react";

// Small pieces shared by the concept-theme Home layouts.

export function Photo({ photo, className }: { photo: { url: string; alt: string }; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo
  return <img src={photo.url} alt={photo.alt} className={className} />;
}

// Eight-point star tiling, used where a photo would go but none fits (e.g. the New BMCC panel:
// land photos stay on the project page). Colour comes from the theme via `color`.
export function Pattern({ className }: { className?: string }) {
  const id = `star-${useId().replace(/:/g, "")}`;
  return (
    <div className={className} aria-hidden>
      <svg width="100%" height="100%">
        <defs>
          <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="16" y="16" width="24" height="24" />
              <rect x="16" y="16" width="24" height="24" transform="rotate(45 28 28)" />
              <circle cx="28" cy="28" r="4" />
              <path d="M0 0l8 8M56 0l-8 8M0 56l8-8M56 56l-8-8" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

export function Ornament({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="10" y="10" width="24" height="24" />
      <rect x="10" y="10" width="24" height="24" transform="rotate(45 22 22)" />
      <circle cx="22" cy="22" r="4" />
    </svg>
  );
}
