import Image from "next/image";

/*
 * PARTNER / PILOT-SCHOOL LOGO STRIP for the schools landing.
 *
 * Real logos of schools actually piloting or partnered, nothing else. Same rule as everywhere on
 * this site: if there are no real logos committed, this strip renders NOTHING. No invented crest,
 * no "trusted by 500 schools" with imaginary marks, a fake logo on a page selling to head teachers
 * is the fastest way to lose one.
 *
 * TO POPULATE: get written permission to use each school's mark, commit the files to
 * `public/marketing/partners/`, and add an entry below. Prefer simple monochrome/SVG marks; they
 * are rendered small and desaturated so a busy full-colour crest still sits calmly in the row.
 */
type PartnerLogo = {
  /** Path under /public, e.g. "/marketing/partners/greenfield.svg". */
  src: string;
  /** School name (screen-reader label + hover title). */
  name: string;
  width: number;
  height: number;
};

// Empty until real, permissioned logos are committed. The strip hides itself while empty.
const PARTNER_LOGOS: PartnerLogo[] = [];

export function PartnerLogos() {
  if (PARTNER_LOGOS.length === 0) return null;

  return (
    <section className="border-y border-[var(--kat-line)] bg-white/40 py-10">
      <div className="kat-page">
        <p className="text-center font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[var(--kat-text-2)]">
          Piloting with
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {PARTNER_LOGOS.map((logo) => (
            <li key={logo.src}>
              <Image
                src={logo.src}
                alt={logo.name}
                title={logo.name}
                width={logo.width}
                height={logo.height}
                className="h-8 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 sm:h-9"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
