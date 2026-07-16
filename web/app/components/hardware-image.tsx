/**
 * Hardware image — renders a product photo from public/images/hardware/
 * with a category-colored glyph fallback when no image exists.
 *
 * Mirrors the local-ai-web pattern: small object-contain thumbnails, lazy
 * loaded, with SVG glyph fallback for devices without a photo.
 */
import { cn } from "../../lib/utils";

interface HardwareImageProps {
  src?: string;
  category: string;
  alt: string;
  className?: string;
}

/** Category accent colors for the glyph fallback. */
const CATEGORY_COLOR: Record<string, string> = {
  gpu: "var(--hw-gpu)",
  apple: "var(--hw-apple)",
  amd: "var(--hw-amd)",
  memory: "var(--hw-memory)",
};

/** Inline SVG glyph for products without a photo. */
function CategoryGlyph({ category, className }: { category: string; className?: string }) {
  const color = CATEGORY_COLOR[category] ?? "var(--muted-foreground)";
  return (
    <div
      className={cn("flex items-center justify-center rounded-md border border-border/50", className)}
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <svg viewBox="0 0 24 24" className="size-1/2" fill="none" stroke={color} strokeWidth="1.5">
        {category === "gpu" && <path d="M2 9h20v8H2z M6 9V6h12v3 M8 17v2 M16 17v2" />}
        {category === "apple" && <path d="M16 3a4 4 0 0 0-4 4 4 4 0 0 0-4-4 5 5 0 0 0 0 10c2 0 4-1 4-3 0 2 2 3 4 3a5 5 0 0 0 0-10z M8 14v6 M14 14v6" />}
        {category === "amd" && <rect x="4" y="4" width="16" height="16" rx="2" />}
        {category === "memory" && <path d="M3 8h18v8H3z M6 8v3 M10 8v3 M14 8v3 M18 8v3" />}
        {!["gpu", "apple", "amd", "memory"].includes(category) && <circle cx="12" cy="12" r="8" />}
      </svg>
    </div>
  );
}

export function HardwareImage({ src, category, alt, className }: HardwareImageProps) {
  const fallbackClass = cn("shrink-0", className);

  if (!src) {
    return <CategoryGlyph category={category} className={fallbackClass} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 object-contain", className)}
      onError={(e) => {
        // Replace with glyph fallback on load failure
        const target = e.currentTarget;
        target.style.display = "none";
        const parent = target.parentElement;
        if (parent && !parent.querySelector("[data-fallback]")) {
          const fallback = document.createElement("div");
          fallback.setAttribute("data-fallback", "");
          fallback.className = fallbackClass;
          parent.appendChild(fallback);
        }
      }}
    />
  );
}
