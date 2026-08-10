import Image from "next/image";

/*
 * PRODUCT BAND, "here is the actual thing your child uses".
 *
 * Real screenshots of the real app (the code playground, the parent dashboard), not a mock. Same
 * discipline as the build-log marquee: if there are no real screenshots committed yet, this section
 * renders NOTHING. There is no illustrated placeholder, an invented UI is exactly the template tell
 * the rest of the page avoids.
 *
 * TO POPULATE: capture real screenshots of the seeded app and commit them to
 * `public/marketing/product/`, then add an entry per shot below. Capture at 2x (e.g. 1280x800 CSS ->
 * 2560x1600 device px) so they stay crisp; set `width`/`height` to the captured pixel size so there
 * is no layout shift. Screenshots of product UI are not a minor's PII, so committing them is fine;
 * do NOT capture a screen that shows a real child's name/face without the same consent the landing
 * photos require.
 */
type ProductShot = {
  /** Path under /public, e.g. "/marketing/product/code-playground.png". */
  src: string;
  /** Captured pixel dimensions, so next/image reserves space and never shifts layout. */
  width: number;
  height: number;
  /** What this screen is (screen-reader + caption). Concrete, not marketing fluff. */
  alt: string;
  caption: string;
};

// Real screenshots of the seeded app (captured 2026-08-08), committed under public/marketing/product/.
// Recapture and update the dimensions if the UI changes materially.
const PRODUCT_SHOTS: ProductShot[] = [
  {
    src: "/marketing/product/code-editor.png",
    width: 1936,
    height: 1242,
    alt: "The KAT code playground: a syntax-highlighted code editor with a Run button and a live output panel.",
    caption: "Where they write and run real code, with output right there. No videos to sit through.",
  },
  {
    src: "/marketing/product/parent-dashboard.png",
    width: 2560,
    height: 1720,
    alt: "The KAT parent dashboard showing logins, linked children, classes attended, and quick links to grades and payments.",
    caption: "Your view: your child's logins, classes, grades, and payments, all in one place.",
  },
];

export function ProductBand() {
  if (PRODUCT_SHOTS.length === 0) return null;

  return (
    <section id="product" className="kat-page kat-defer py-16 sm:py-24">
      <div className="max-w-2xl border-l-2 border-[var(--kat-clay)] pl-5">
        <p className="kat-eyebrow">Inside the app</p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[var(--kat-ink)] sm:text-[2.5rem]">
          This is what your child actually uses.
        </h2>
        <p className="mt-4 font-body text-[1.05rem] leading-relaxed text-[var(--kat-muted)]">
          Real screens from the real platform: where they write and run code, and where you watch
          their progress. Nothing here is a mock-up.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        {PRODUCT_SHOTS.map((shot) => (
          <figure key={shot.src}>
            {/* Browser-chrome frame, the same warm, hard-edged card as the hero artifact. */}
            <div className="overflow-hidden rounded-tl-2xl rounded-br-2xl border border-[var(--kat-ink)]/15 bg-[var(--kat-raised)] shadow-kat">
              <div className="flex items-center gap-1.5 border-b border-[var(--kat-border)] px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-[var(--kat-clay)]/60" aria-hidden />
                <span className="size-2.5 rounded-full bg-[var(--kat-sun)]/70" aria-hidden />
                <span className="size-2.5 rounded-full bg-[var(--kat-pine)]/60" aria-hidden />
              </div>
              <Image
                src={shot.src}
                width={shot.width}
                height={shot.height}
                alt={shot.alt}
                className="h-auto w-full"
                sizes="(min-width: 1024px) 40rem, 100vw"
              />
            </div>
            <figcaption className="mt-3 pl-1 font-body text-sm leading-relaxed text-[var(--kat-muted)]">
              {shot.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
