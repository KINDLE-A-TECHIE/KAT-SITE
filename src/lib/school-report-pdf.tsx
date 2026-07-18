import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { SchoolReport, SchoolReportSection } from "./school-report-data";

/**
 * Server-rendered PDF of the termly progress & NERDC-coverage report. Uses @react-pdf/renderer
 * (pure JS, no headless browser) so it runs in the Node route handler, unlike a Puppeteer render.
 * The data is already authorized and schoolId-scoped by the caller (see getSchoolReport).
 */

const CLAY = "#B2401D";
const INK = "#1A1714";
const MUTED = "#6E6459";
const LINE = "#E0D5C3";
const PAPER = "#F4EEE2";

const s = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 54, paddingHorizontal: 42, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  bar: { height: 4, backgroundColor: CLAY, marginBottom: 14 },
  brand: { fontSize: 8, letterSpacing: 2, color: CLAY, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 4 },
  meta: { fontSize: 9, color: MUTED, marginTop: 4 },
  classBlock: { marginTop: 18, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 12 },
  className: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  classMeta: { fontSize: 8, color: MUTED, marginTop: 2 },
  sectionLabel: { fontSize: 8, letterSpacing: 1, color: MUTED, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginTop: 12, marginBottom: 5 },
  statRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  stat: { flex: 1, backgroundColor: PAPER, borderColor: LINE, borderWidth: 1, borderRadius: 3, padding: 6 },
  statLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 },
  tHead: { flexDirection: "row", backgroundColor: INK, color: PAPER, paddingVertical: 4, paddingHorizontal: 4 },
  tRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 3, paddingHorizontal: 4 },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  td: { fontSize: 8 },
  cName: { flex: 3 },
  cNum: { flex: 1.2, textAlign: "right" },
  empty: { fontSize: 8, color: MUTED, fontStyle: "italic", marginTop: 4 },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
});

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);

function ClassSection({ section }: { section: SchoolReportSection }) {
  const { summary, coverage } = section;
  const t = coverage.totals;
  return (
    <View style={s.classBlock} wrap={false}>
      <Text style={s.className}>{summary.class.name}</Text>
      <Text style={s.classMeta}>
        {summary.class.nerdcLevel.replace(/_/g, " ")} {"·"} {summary.class.term} {"·"} {summary.studentCount} students
        {summary.course ? ` · ${summary.course.name}` : ""}
      </Text>

      <Text style={s.sectionLabel}>NERDC coverage</Text>
      <View style={s.statRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>Units on platform</Text>
          <Text style={s.statValue}>{t.unitsOnPlatform}{t.unitsInScheme != null ? ` / ${t.unitsInScheme}` : ""}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>Scheme coverage</Text>
          <Text style={s.statValue}>{pct(t.schemeCoveragePct)}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>Units delivered</Text>
          <Text style={s.statValue}>{t.unitsDelivered}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>First-hand</Text>
          <Text style={s.statValue}>{t.unitsFirstHand}</Text>
        </View>
      </View>
      {!coverage.matchedCrosswalk ? (
        <Text style={s.empty}>This class&apos;s course is not one of the NERDC crosswalk courses, so scheme coverage is not measured.</Text>
      ) : null}

      <Text style={s.sectionLabel}>Students &amp; mastery</Text>
      <View style={s.tHead}>
        <Text style={[s.th, s.cName]}>Student</Text>
        <Text style={[s.th, s.cNum]}>Lessons</Text>
        <Text style={[s.th, s.cNum]}>Gates</Text>
        <Text style={[s.th, s.cNum]}>Assess.</Text>
        <Text style={[s.th, s.cNum]}>Avg</Text>
      </View>
      {summary.students.length === 0 ? (
        <Text style={s.empty}>No students on this roster yet.</Text>
      ) : (
        summary.students.map((st) => (
          <View style={s.tRow} key={st.userId}>
            <Text style={[s.td, s.cName]}>{st.firstName} {st.lastName}</Text>
            <Text style={[s.td, s.cNum]}>{st.lessonsCompleted}</Text>
            <Text style={[s.td, s.cNum]}>{st.gatesPassed}</Text>
            <Text style={[s.td, s.cNum]}>{st.assessmentsTaken}</Text>
            <Text style={[s.td, s.cNum]}>{pct(st.avgScorePct)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function ReportDocument({ report }: { report: SchoolReport }) {
  const generated = new Date(report.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <Document title={`${report.school.name} report`} author="KAT for Schools">
      <Page size="A4" style={s.page}>
        <View style={s.bar} />
        <Text style={s.brand}>KAT for Schools</Text>
        <Text style={s.title}>Progress &amp; NERDC Coverage</Text>
        <Text style={s.meta}>
          {report.school.name}
          {report.term ? ` · ${report.term}` : ""}
          {"  ·  "}
          {report.scope === "class" ? "Single class" : "Whole school"}
          {"  ·  Generated "}{generated}
        </Text>

        {report.classes.length === 0 ? (
          <Text style={s.empty}>No classes match this term.</Text>
        ) : (
          report.classes.map((section) => (
            <ClassSection key={section.summary.class.id} section={section} />
          ))
        )}

        <View style={s.footer} fixed>
          <Text>{report.school.name} {"·"} Confidential</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderSchoolReportPdf(report: SchoolReport): Promise<Buffer> {
  return renderToBuffer(<ReportDocument report={report} />);
}
