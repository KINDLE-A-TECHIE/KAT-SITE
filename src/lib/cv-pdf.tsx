import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CvData } from "./cv-data";

/**
 * Server-rendered CV PDF, same stack and register as school-report-pdf.tsx:
 * @react-pdf/renderer (pure JS, no headless browser), warm palette, Helvetica.
 *
 * Layout: identity header, then only the sections that have data, in the order
 * an employer reads a CV: summary, skills, experience, education, then the KAT
 * record (programmes, certificates, badges, projects). Certificates and
 * projects print their public URLs, so every KAT claim on the page can be
 * checked by the reader. Empty sections are omitted entirely.
 */

const CLAY = "#B2401D";
const INK = "#1A1714";
const MUTED = "#6E6459";
const LINE = "#E0D5C3";
const PAPER = "#F4EEE2";

const s = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 54, paddingHorizontal: 46, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  bar: { height: 4, backgroundColor: CLAY, marginBottom: 14 },

  name: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  headline: { fontSize: 10, color: CLAY, marginTop: 3 },
  contactRow: { fontSize: 8, color: MUTED, marginTop: 6 },
  linkText: { fontSize: 8, color: CLAY, textDecoration: "none" },

  section: { marginTop: 14, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 10 },
  sectionLabel: { fontSize: 8, letterSpacing: 1.5, color: MUTED, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 6 },

  body: { fontSize: 9, lineHeight: 1.45 },

  entry: { marginBottom: 7 },
  entryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  entryTitle: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  entryWhere: { fontSize: 9, color: MUTED, marginTop: 1 },
  entryDates: { fontSize: 8, color: MUTED },
  entryDesc: { fontSize: 8.5, lineHeight: 1.4, marginTop: 2 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: { fontSize: 8, backgroundColor: PAPER, borderWidth: 1, borderColor: LINE, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6 },

  credRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 4 },
  credName: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 2 },
  credMeta: { fontSize: 8, color: MUTED, flex: 1, textAlign: "right" },
  credUrl: { fontSize: 7, color: CLAY, marginTop: 1 },

  footer: { position: "absolute", bottom: 24, left: 46, right: 46, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
});

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function dateRange(start: Date | null, end: Date | null, isCurrent: boolean): string {
  const from = fmtDate(start);
  const to = isCurrent ? "present" : fmtDate(end);
  if (!from && !to) return "";
  return `${from || "?"} – ${to || "?"}`;
}

/** Section wrapper that renders nothing when it has no content. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function CvDocument({ cv }: { cv: CvData }) {
  const { identity } = cv;
  const contact = [identity.email, identity.phone, identity.location].filter(Boolean).join("  ·  ");
  const links = [identity.githubUrl, identity.linkedinUrl, identity.websiteUrl].filter(
    (u): u is string => Boolean(u),
  );
  const generated = cv.generatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const completed = cv.programmes.filter((p) => p.status === "COMPLETED");
  const active = cv.programmes.filter((p) => p.status === "ACTIVE");

  return (
    <Document title={`${identity.fullName} CV`} author={identity.fullName}>
      <Page size="A4" style={s.page}>
        <View style={s.bar} />

        {/* Identity */}
        <Text style={s.name}>{identity.fullName}</Text>
        {identity.headline ? <Text style={s.headline}>{identity.headline}</Text> : null}
        {contact ? <Text style={s.contactRow}>{contact}</Text> : null}
        {links.length > 0 ? (
          <View style={[s.contactRow, { flexDirection: "row", gap: 10 }]}>
            {links.map((url) => (
              <Link key={url} src={url} style={s.linkText}>
                {url.replace(/^https?:\/\//, "")}
              </Link>
            ))}
          </View>
        ) : null}

        {identity.bio ? (
          <Section label="Summary">
            <Text style={s.body}>{identity.bio}</Text>
          </Section>
        ) : null}

        {cv.skills.length > 0 ? (
          <Section label="Skills">
            <View style={s.chipRow}>
              {cv.skills.map((sk) => (
                <Text key={sk.name} style={s.chip}>
                  {sk.name}
                  {sk.yearsOfExperience ? ` (${sk.yearsOfExperience} yr${sk.yearsOfExperience === 1 ? "" : "s"})` : ""}
                </Text>
              ))}
            </View>
          </Section>
        ) : null}

        {cv.experience.length > 0 ? (
          <Section label="Experience">
            {cv.experience.map((e, i) => (
              <View key={`${e.company}-${i}`} style={s.entry} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{e.title}</Text>
                  <Text style={s.entryDates}>{dateRange(e.startDate, e.endDate, e.isCurrent)}</Text>
                </View>
                <Text style={s.entryWhere}>{e.company}</Text>
                {e.description ? <Text style={s.entryDesc}>{e.description}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {cv.education.length > 0 ? (
          <Section label="Education">
            {cv.education.map((e, i) => (
              <View key={`${e.school}-${i}`} style={s.entry} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{e.degree}{e.fieldOfStudy ? `, ${e.fieldOfStudy}` : ""}</Text>
                  <Text style={s.entryDates}>{dateRange(e.startDate, e.endDate, e.isCurrent)}</Text>
                </View>
                <Text style={s.entryWhere}>{e.school}</Text>
                {e.description ? <Text style={s.entryDesc}>{e.description}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {cv.programmes.length > 0 ? (
          <Section label="KAT Learning programmes">
            {completed.map((p) => (
              <View key={p.name} style={s.credRow} wrap={false}>
                <Text style={s.credName}>{p.name}</Text>
                <Text style={s.credMeta}>Completed{p.completedAt ? ` ${fmtDate(p.completedAt)}` : ""}</Text>
              </View>
            ))}
            {active.map((p) => (
              <View key={p.name} style={s.credRow} wrap={false}>
                <Text style={s.credName}>{p.name}</Text>
                <Text style={s.credMeta}>In progress</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {cv.certificates.length > 0 ? (
          <Section label="Certificates (verifiable)">
            {cv.certificates.map((c) => (
              <View key={c.verifyUrl} style={{ marginBottom: 6 }} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{c.programName}</Text>
                  <Text style={s.entryDates}>{fmtDate(c.issuedAt)}</Text>
                </View>
                <Link src={c.verifyUrl} style={s.credUrl}>
                  Verify: {c.verifyUrl.replace(/^https?:\/\//, "")}
                </Link>
              </View>
            ))}
          </Section>
        ) : null}

        {cv.projects.length > 0 ? (
          <Section label="Projects">
            {cv.projects.map((p) => (
              <View key={p.showcaseUrl} style={s.entry} wrap={false}>
                <Text style={s.entryTitle}>{p.title}</Text>
                {p.description ? <Text style={s.entryDesc}>{p.description}</Text> : null}
                {p.tags.length > 0 ? (
                  <Text style={[s.entryDesc, { color: MUTED }]}>{p.tags.join(" · ")}</Text>
                ) : null}
                <Link src={p.showcaseUrl} style={s.credUrl}>
                  {p.showcaseUrl.replace(/^https?:\/\//, "")}
                </Link>
                {p.deployedUrl ? (
                  <Link src={p.deployedUrl} style={s.credUrl}>
                    Live: {p.deployedUrl.replace(/^https?:\/\//, "")}
                  </Link>
                ) : null}
              </View>
            ))}
          </Section>
        ) : null}

        {cv.badges.length > 0 ? (
          <Section label="Module badges">
            <View style={s.chipRow}>
              {cv.badges.map((b) => (
                <Text key={`${b.name}-${b.earnedAt.toISOString()}`} style={s.chip}>
                  {b.name} · {b.moduleTitle}
                </Text>
              ))}
            </View>
          </Section>
        ) : null}

        <View style={s.footer} fixed>
          <Text>Generated from the KAT Learning profile of {identity.fullName} on {generated}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderCvPdf(cv: CvData): Promise<Buffer> {
  return renderToBuffer(<CvDocument cv={cv} />);
}
