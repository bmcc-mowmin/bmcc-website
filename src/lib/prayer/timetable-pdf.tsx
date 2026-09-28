import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatClock } from "./next-prayer";
import type { ResolvedDay } from "./schedule";

// Printable monthly timetable (US Letter, landscape). English only: the PDF's built-in fonts
// cannot render Dari/Urdu/Pashto script. Days an admin changed are marked with "*".

const navy = "#101d33";
const s = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 30, paddingHorizontal: 28, fontSize: 8.4, fontFamily: "Helvetica", color: "#101828" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 },
  org: { fontSize: 9, color: "#2354a6", fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0b1524", marginTop: 3 },
  meta: { fontSize: 8.5, color: "#6b7280", textAlign: "right", lineHeight: 1.4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e5ea", minHeight: 13.6, alignItems: "center" },
  headRow: { flexDirection: "row", backgroundColor: navy, color: "#eef2f8", fontFamily: "Helvetica-Bold" },
  subHeadRow: { flexDirection: "row", backgroundColor: "#1a2c4a", color: "#c5d2e4", fontSize: 7.5 },
  friday: { backgroundColor: "#eaf1fe" },
  cellDate: { width: 44, paddingHorizontal: 5, paddingVertical: 2 },
  cellDay: { width: 34, paddingHorizontal: 5, paddingVertical: 2 },
  cellTime: { width: 50, paddingHorizontal: 5, paddingVertical: 2 },
  cellJumuah: { flex: 1, paddingHorizontal: 5, paddingVertical: 2 },
  prayerHead: { width: 100, paddingHorizontal: 5, paddingVertical: 3 },
  bold: { fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 14, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#98a2b3" },
});

const PRAYERS = [
  ["fajr", "Fajr"],
  ["dhuhr", "Dhuhr"],
  ["asr", "Asr (Hanafi)"],
  ["maghrib", "Maghrib"],
  ["isha", "Isha"],
] as const;

const clock = (hhmm: string) => formatClock(hhmm, "en-US").replace(/\s?(AM|PM)/, (m) => m.trim().toLowerCase());

function Timetable({ month, days, org, generatedAt }: { month: string; days: ResolvedDay[]; org: { name: string; address: string; phone: string; url: string }; generatedAt: string }) {
  const [y, m] = month.split("-").map(Number);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  const anyOverride = days.some((d) => d.overridden.length);
  return (
    <Document title={`BMCC Prayer Timetable — ${monthLabel}`} author={org.name}>
      <Page size="LETTER" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.org}>{org.name}</Text>
            <Text style={s.title}>Prayer Timetable — {monthLabel}</Text>
          </View>
          <Text style={s.meta}>
            {org.address}
            {"\n"}Adhan / Iqamah · Asr: Hanafi method{"\n"}Times in Pacific Time
          </Text>
        </View>

        <View style={s.headRow}>
          <Text style={s.cellDate}>Date</Text>
          <Text style={s.cellDay}>Day</Text>
          {PRAYERS.map(([key, label]) => (
            <Text key={key} style={s.prayerHead}>
              {label}
            </Text>
          ))}
          <Text style={s.cellJumuah}>Jumu&apos;ah (khutbah / iqamah)</Text>
        </View>
        <View style={s.subHeadRow}>
          <Text style={s.cellDate} />
          <Text style={s.cellDay} />
          {PRAYERS.map(([key]) => (
            <View key={key} style={{ flexDirection: "row" }}>
              <Text style={s.cellTime}>Adhan</Text>
              <Text style={s.cellTime}>Iqamah</Text>
            </View>
          ))}
          <Text style={s.cellJumuah} />
        </View>

        {days.map((d) => {
          const [, , dd] = d.date.split("-");
          const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d.date}T12:00:00Z`));
          return (
            <View key={d.date} style={[s.row, ...(d.weekday === 5 ? [s.friday] : [])]} wrap={false}>
              <Text style={[s.cellDate, s.bold]}>
                {Number(dd)}
                {d.overridden.length ? " *" : ""}
              </Text>
              <Text style={s.cellDay}>{weekday}</Text>
              {d.prayers.map((p) => (
                <View key={p.key} style={{ flexDirection: "row" }}>
                  <Text style={s.cellTime}>{clock(p.adhan)}</Text>
                  <Text style={[s.cellTime, s.bold]}>{clock(p.iqamah)}</Text>
                </View>
              ))}
              <Text style={s.cellJumuah}>{d.jumuah.map((j) => `${clock(j.khutbah)} / ${clock(j.iqamah)}`).join("   ·   ")}</Text>
            </View>
          );
        })}

        <View style={s.footer} fixed>
          <Text>
            {org.phone} · {org.url}
            {anyOverride ? "   ·   * adjusted by the masjid" : ""}
          </Text>
          <Text>Generated {generatedAt}. Check the website for last-minute changes.</Text>
        </View>
      </Page>
    </Document>
  );
}

export function renderTimetablePdf(props: Parameters<typeof Timetable>[0]) {
  return renderToBuffer(<Timetable {...props} />);
}
