import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

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
const PAPER = "#F4EEE2";

const s = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", color: INK },
  bar: { height: 4, backgroundColor: CLAY, marginBottom: 12 },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: MUTED, marginTop: 3, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  card: { width: "48%", margin: "1%", borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 12 },
  name: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  label: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  code: { fontSize: 15, fontFamily: "Courier-Bold", letterSpacing: 1, marginTop: 1 },
  url: { fontSize: 7.5, color: CLAY, marginTop: 10 },
  wellNote: { fontSize: 8, color: MUTED, backgroundColor: PAPER, padding: 6, borderRadius: 3, marginBottom: 12 },
});

export type LoginCard = { name: string; pin: string };

function LoginCardsDocument({
  className,
  joinCode,
  pupils,
  origin,
}: {
  className: string;
  joinCode: string;
  pupils: LoginCard[];
  origin: string;
}) {
  const url = `${origin.replace(/^https?:\/\//, "")}/student-login`;
  return (
    <Document title={`${className} sign-in cards`} author="KAT for Schools">
      <Page size="A4" style={s.page}>
        <View style={s.bar} />
        <Text style={s.h1}>{className}, sign-in cards</Text>
        <Text style={s.meta}>Class code {joinCode} {"·"} {pupils.length} pupils {"·"} keep private, hand to each child</Text>
        <Text style={s.wellNote}>
          Pupils go to {url}, enter the class code, pick their name, and type their PIN. These PINs are new;
          any earlier cards for this class no longer work.
        </Text>
        <View style={s.grid}>
          {pupils.map((p, i) => (
            <View key={`${p.name}-${i}`} style={s.card} wrap={false}>
              <Text style={s.name}>{p.name}</Text>
              <View style={s.row}>
                <View>
                  <Text style={s.label}>Class code</Text>
                  <Text style={s.code}>{joinCode}</Text>
                </View>
                <View>
                  <Text style={s.label}>PIN</Text>
                  <Text style={s.code}>{p.pin}</Text>
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
  className: string;
  joinCode: string;
  pupils: LoginCard[];
  origin: string;
}): Promise<Buffer> {
  return renderToBuffer(<LoginCardsDocument {...data} />);
}
