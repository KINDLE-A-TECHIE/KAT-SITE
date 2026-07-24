import "server-only";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatJoinCode } from "@/lib/join-code";

/**
 * Printable pupil sign-in cards (Option B). A page of cut-out cards, each with the child's name, the
 * class join code, the pupil's PIN, and where to go.
 *
 * Rendered SERVER-SIDE with renderToBuffer (like cv-pdf and school-report-pdf), NOT in the browser:
 * the endpoint that mints the PINs already holds them, so it renders here and streams a PDF back.
 * That keeps @react-pdf/renderer (a heavy dependency) out of the client bundle, and makes PIN
 * generation + rendering one server round-trip.
 *
 * Warm register, palette only, Helvetica (@react-pdf has no access to the webfonts).
 */

const CLAY = "#B2401D";
const INK = "#1A1714";
const MUTED = "#6E6459";
const LINE = "#E0D5C3";
const FAINT = "#F7F2E8";

const s = StyleSheet.create({
  page: { padding: 34, fontFamily: "Helvetica", color: INK, fontSize: 10 },

  // Signature: a single thin clay rule across the top, the sheet's one flourish.
  topRule: { height: 2, backgroundColor: CLAY, marginBottom: 12 },

  // Masthead: the sheet is issued BY the school, so it leads with the school's mark and name.
  masthead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  logo: { width: 28, height: 28, borderRadius: 6, marginRight: 9 },
  schoolName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK },
  kicker: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 2 },
  rule: { borderBottomWidth: 1, borderBottomColor: LINE, marginTop: 10, marginBottom: 11 },

  // Subhead + instructions
  subhead: { flexDirection: "row", alignItems: "baseline", marginBottom: 5 },
  className: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  classMeta: { fontSize: 9, color: MUTED, marginLeft: 8 },
  instructions: { fontSize: 8.5, color: MUTED, lineHeight: 1.45, marginBottom: 16 },
  link: { color: CLAY },

  // Cards: dashed cut-out tiles, one per child. PIN is the hero (the per-child secret).
  grid: { flexDirection: "row", flexWrap: "wrap" },
  card: {
    width: "47%", margin: "1.5%", padding: 14,
    borderWidth: 1, borderColor: LINE, borderStyle: "dashed", borderRadius: 8,
  },
  cardName: { fontSize: 13.5, fontFamily: "Helvetica-Bold" },
  divider: { borderBottomWidth: 1, borderBottomColor: LINE, marginTop: 9, marginBottom: 10 },
  credRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  pinBlock: { alignItems: "flex-end", backgroundColor: FAINT, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  label: { fontSize: 6.5, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  codeVal: { fontSize: 12, fontFamily: "Courier-Bold", letterSpacing: 1, color: INK, paddingVertical: 4 },
  pinVal: { fontSize: 18, fontFamily: "Courier-Bold", letterSpacing: 2, color: CLAY },
  url: { fontSize: 7.5, color: MUTED, marginTop: 12 },
});

export type LoginCard = { name: string; pin: string };

function LoginCardsDocument({
  schoolName,
  schoolLogo,
  className,
  joinCode,
  pupils,
  origin,
}: {
  schoolName: string;
  schoolLogo: string | null;
  className: string;
  joinCode: string;
  pupils: LoginCard[];
  origin: string;
}) {
  const url = `${origin.replace(/^https?:\/\//, "")}/student-login`;
  const displayCode = formatJoinCode(joinCode);
  const pupilWord = pupils.length === 1 ? "pupil" : "pupils";
  return (
    <Document title={`${schoolName}, ${className} sign-in cards`} author={schoolName}>
      <Page size="A4" style={s.page}>
        <View style={s.topRule} />

        <View style={s.masthead}>
          <View style={s.brandRow}>
            {schoolLogo ? <Image src={schoolLogo} style={s.logo} /> : null}
            <Text style={s.schoolName}>{schoolName}</Text>
          </View>
          <Text style={s.kicker}>SIGN-IN CARDS</Text>
        </View>

        <View style={s.rule} />

        <View style={s.subhead}>
          <Text style={s.className}>{className}</Text>
          <Text style={s.classMeta}>Class code {displayCode}  {"·"}  {pupils.length} {pupilWord}</Text>
        </View>
        <Text style={s.instructions}>
          Give each child their own card. They go to <Text style={s.link}>{url}</Text>, enter the class
          code, pick their name, and type their PIN. These PINs are new, so any earlier cards for this
          class no longer work. Keep them private.
        </Text>

        <View style={s.grid}>
          {pupils.map((p, i) => (
            <View key={`${p.name}-${i}`} style={s.card} wrap={false}>
              <Text style={s.cardName}>{p.name}</Text>
              <View style={s.divider} />
              <View style={s.credRow}>
                <View>
                  <Text style={s.label}>Class code</Text>
                  <Text style={s.codeVal}>{displayCode}</Text>
                </View>
                <View style={s.pinBlock}>
                  <Text style={s.label}>PIN</Text>
                  <Text style={s.pinVal}>{p.pin}</Text>
                </View>
              </View>
              <Text style={s.url}>{url}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export function renderLoginCardsPdf(data: {
  schoolName: string;
  schoolLogo: string | null;
  className: string;
  joinCode: string;
  pupils: LoginCard[];
  origin: string;
}): Promise<Buffer> {
  return renderToBuffer(<LoginCardsDocument {...data} />);
}
