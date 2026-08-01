import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * THE REGRESSION THIS EXISTS TO CATCH
 *
 * The schools landing page shipped written entirely against warm tokens (--kat-clay,
 * --kat-paper, --kat-ink…) that were never declared anywhere. In CSS an undefined custom
 * property is not an error: `bg-[var(--kat-clay)]` simply resolves to nothing, the element
 * paints transparent, and text falls back to default black. There is no build failure, no
 * console warning, no red squiggle. The page just quietly renders as if the design had
 * never been applied, which is exactly what happened, on production, unnoticed.
 *
 * A type system cannot catch this (CSS vars are strings) and neither can a linter. So the
 * check is here: every --kat-* variable READ anywhere in src/ must be DECLARED in the
 * :root block of globals.css. It is cheap, and it is the only thing standing between us
 * and a silent second occurrence.
 */

const SRC = join(process.cwd(), "src");
const GLOBALS = join(SRC, "app", "globals.css");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    // Skip the test tree: this file necessarily *names* tokens (and retired blue hexes)
    // in its own assertions and prose, and would otherwise flag itself.
    if (entry === "__tests__") continue;

    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx?|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Every `--kat-foo` declared (i.e. `--kat-foo:` …) in globals.css. */
function declaredTokens(): Set<string> {
  const css = readFileSync(GLOBALS, "utf8");
  const declared = new Set<string>();
  for (const m of css.matchAll(/(--kat-[a-z0-9-]+)\s*:/g)) {
    declared.add(m[1]);
  }
  return declared;
}

/** Every `--kat-foo` read via var(--kat-foo) across the source tree. */
function referencedTokens(): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/var\((--kat-[a-z0-9-]+)/g)) {
      const token = m[1];
      const where = refs.get(token) ?? [];
      where.push(file.replace(process.cwd(), "").replace(/\\/g, "/"));
      refs.set(token, where);
    }
  }
  return refs;
}

describe("KAT design tokens", () => {
  it("declares every --kat-* variable that any component reads", () => {
    const declared = declaredTokens();
    const referenced = referencedTokens();

    const undeclared = [...referenced.entries()]
      .filter(([token]) => !declared.has(token))
      .map(([token, files]) => `${token} (read in ${[...new Set(files)].join(", ")})`);

    expect(
      undeclared,
      "These CSS variables are used by a component but declared nowhere in globals.css. " +
        "They will silently render as transparent/inherited, NOT as an error. " +
        "Declare them in the :root block.",
    ).toEqual([]);
  });

  it("finds the five brand anchors, so a bad merge cannot quietly empty the palette", () => {
    const declared = declaredTokens();
    for (const anchor of ["--kat-ink", "--kat-clay", "--kat-sun", "--kat-paper", "--kat-pine"]) {
      expect(declared, `${anchor} is missing from globals.css :root`).toContain(anchor);
    }
  });

  it("keeps the marketing surface off the retired blue palette", () => {
    // The landing was rebuilt on the warm palette. If a blue hex or a legacy blue token
    // name reappears in src/components/marketing, someone has reverted a section, which
    // is precisely how the B2C page drifted back to the old design once already.
    const marketing = walk(join(SRC, "components", "marketing"));
    const offenders: string[] = [];

    for (const file of marketing) {
      const text = readFileSync(file, "utf8");
      const hits = [
        ...text.matchAll(/#(1E5FAF|4DB3E6|132B5E|0D1F45)|--kat-(primary-blue|accent-sky|deep-navy)/gi),
      ];
      if (hits.length > 0) {
        offenders.push(
          `${file.replace(process.cwd(), "").replace(/\\/g, "/")}: ${hits.map((h) => h[0]).join(", ")}`,
        );
      }
    }

    expect(
      offenders,
      "Retired trust-blue found in the marketing surface. The brand colour is --kat-clay.",
    ).toEqual([]);
  });

  it("keeps the ENTIRE app off trust-blue, decorative hues, and slate neutrals", () => {
    // The master design retired trust-blue app-wide (dashboards, auth, email, everything),
    // uses stone neutrals, and warm orange/clay accents. Semantic STATE colours are allowed
    // and deliberately not forbidden here: emerald/green = success, amber = warning,
    // rose/red = danger. This walks all of src (walk() already skips __tests__ and .bak) and
    // fails the build on any regression, so "no blue anywhere" is enforced, not a convention.
    const FORBIDDEN = [
      { re: /#(1E5FAF|1A52A0|1A4F8F|132B5E|0D1F45|4DB3E6|1E3A8A)/gi, what: "trust-blue hex" },
      { re: /\b(blue|sky|cyan|indigo|violet|purple|fuchsia|teal)-\d/g, what: "non-warm hue class" },
      { re: /\bslate-\d|prose-slate\b/g, what: "slate neutral (use stone-*)" },
    ];
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const { re, what } of FORBIDDEN) {
        const hits = [...text.matchAll(re)];
        if (hits.length > 0) {
          const rel = file.replace(process.cwd(), "").replace(/\\/g, "/");
          offenders.push(`${rel}: ${what}: ${[...new Set(hits.map((h) => h[0]))].join(", ")}`);
        }
      }
    }
    expect(
      offenders,
      "Trust-blue / non-warm hue / slate found outside the allowed semantic states. " +
        "Brand accent is --kat-clay or orange-*; neutrals are stone-*; success/warning/danger " +
        "may use emerald/amber/rose.",
    ).toEqual([]);
  });

  it("loads the three brand faces via next/font (self-hosted), not a bare font-family string", () => {
    // globals.css used to merely NAME "Manrope"/"Space Grotesk" in a font stack without ever
    // fetching them, so the whole app silently fell back to Segoe/Arial. The faces must be loaded
    // in layout.tsx for the --font-* vars to resolve. They are self-hosted via next/font/local
    // (variable woff2 files in src/app/fonts), so there is no build-time Google Fonts fetch that
    // could time out on a slow network and drop the app back to the fallback stack.
    const layout = readFileSync(join(SRC, "app", "layout.tsx"), "utf8");

    expect(layout).toMatch(/from\s+["']next\/font\/local["']/);
    for (const face of ["bricolage.woff2", "fraunces.woff2", "jetbrains.woff2"]) {
      expect(layout, `${face} is not loaded via next/font/local in layout.tsx`).toContain(face);
    }
    for (const cssVar of ["--font-bricolage", "--font-fraunces", "--font-jetbrains"]) {
      expect(layout, `${cssVar} is not emitted in layout.tsx`).toContain(cssVar);
    }
  });
});
