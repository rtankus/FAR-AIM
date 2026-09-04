import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { Collapsible } from "../components/Collapsible";
import { CgEnvelopeChart } from "../components/CgEnvelopeChart";
import { getProfile } from "../../performance/store";
import { computeWeightAndBalance } from "../../performance/calculations";
import type { AircraftProfile, ChartBracket, WeatherLegInputs } from "../../performance/types";

type Props = NativeStackScreenProps<RootStackParamList, "WeightAndBalance">;

function useNum(initial = 0) {
  const [text, setText] = useState(initial ? String(initial) : "");
  const n = parseFloat(text);
  return { text, setText, value: Number.isFinite(n) ? n : 0 };
}
type NumInput = ReturnType<typeof useNum>;

function useLegInputs() {
  return {
    tempC: useNum(15),
    altimeterInHg: useNum(29.92),
    elevationFt: useNum(0),
    runwayWindAngleDeg: useNum(0),
    windSpeedKt: useNum(0),
  };
}
type LegInputs = ReturnType<typeof useLegInputs>;

function legValues(leg: LegInputs): WeatherLegInputs {
  return {
    tempC: leg.tempC.value,
    altimeterInHg: leg.altimeterInHg.value,
    elevationFt: leg.elevationFt.value,
    runwayWindAngleDeg: leg.runwayWindAngleDeg.value,
    windSpeedKt: leg.windSpeedKt.value,
  };
}

function useBracketInputs() {
  return { row1Col1: useNum(), row1Col2: useNum(), row2Col1: useNum(), row2Col2: useNum() };
}
type BracketInputs = ReturnType<typeof useBracketInputs>;

function bracketValues(b: BracketInputs): ChartBracket {
  return {
    row1Col1: b.row1Col1.value,
    row1Col2: b.row1Col2.value,
    row2Col1: b.row2Col1.value,
    row2Col2: b.row2Col2.value,
  };
}

export default function WeightAndBalanceScreen({ route }: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [profile, setProfile] = useState<AircraftProfile | null>(null);

  useEffect(() => {
    getProfile(userDb, route.params.profileId).then(setProfile);
  }, [userDb, route.params.profileId]);

  const front = useNum();
  const rear = useNum();
  const baggage = useNum();
  const fuelGal = useNum();
  const flightHours = useNum();
  const fuelBurn = useNum();

  const departure = useLegInputs();
  const destination = useLegInputs();
  const takeoffGroundRoll = useBracketInputs();
  const takeoffObstacle = useBracketInputs();
  const landingGroundRoll = useBracketInputs();
  const landingObstacle = useBracketInputs();

  const result = useMemo(() => {
    if (!profile) return null;
    return computeWeightAndBalance(profile, {
      frontWeight: front.value,
      rearWeight: rear.value,
      baggageWeight: baggage.value,
      fuelGal: fuelGal.value,
      flightHours: flightHours.value,
      fuelBurnGalPerHr: fuelBurn.value,
      departure: legValues(departure),
      destination: legValues(destination),
      takeoffGroundRoll: bracketValues(takeoffGroundRoll),
      takeoffObstacle: bracketValues(takeoffObstacle),
      landingGroundRoll: bracketValues(landingGroundRoll),
      landingObstacle: bracketValues(landingObstacle),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profile,
    front.value,
    rear.value,
    baggage.value,
    fuelGal.value,
    flightHours.value,
    fuelBurn.value,
    departure.tempC.value,
    departure.altimeterInHg.value,
    departure.elevationFt.value,
    departure.runwayWindAngleDeg.value,
    departure.windSpeedKt.value,
    destination.tempC.value,
    destination.altimeterInHg.value,
    destination.elevationFt.value,
    destination.runwayWindAngleDeg.value,
    destination.windSpeedKt.value,
    takeoffGroundRoll.row1Col1.value,
    takeoffGroundRoll.row1Col2.value,
    takeoffGroundRoll.row2Col1.value,
    takeoffGroundRoll.row2Col2.value,
    takeoffObstacle.row1Col1.value,
    takeoffObstacle.row1Col2.value,
    takeoffObstacle.row2Col1.value,
    takeoffObstacle.row2Col2.value,
    landingGroundRoll.row1Col1.value,
    landingGroundRoll.row1Col2.value,
    landingGroundRoll.row2Col1.value,
    landingGroundRoll.row2Col2.value,
    landingObstacle.row1Col1.value,
    landingObstacle.row1Col2.value,
    landingObstacle.row2Col1.value,
    landingObstacle.row2Col2.value,
  ]);

  if (!profile) return null;
  const u = profile.weightUnit;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{profile.name}</Text>

      {result ? (
        <View style={styles.resultCard}>
          <ResultRow label="ZFW" weight={result.zfw.weight} arm={result.zfw.arm} unit={u} />
          <ResultRow label="Ramp weight" weight={result.rampWeight.weight} unit={u} />
          <ResultRow
            label="Takeoff weight"
            weight={result.takeoffWeight.weight}
            arm={result.takeoffWeight.arm}
            unit={u}
            warn={!result.withinMaxGross}
          />
          <ResultRow label="Landing weight" weight={result.landingWeight.weight} arm={result.landingWeight.arm} unit={u} />
          {!result.withinMaxGross ? (
            <Text style={styles.warnText}>⚠ Over max gross weight ({profile.maxGrossWeight} {u})</Text>
          ) : null}
          {result.envelopeCheck ? (
            <Text style={[styles.warnText, result.envelopeCheck.takeoffInside && result.envelopeCheck.landingInside && styles.okText]}>
              {result.envelopeCheck.takeoffInside && result.envelopeCheck.landingInside
                ? "✓ Takeoff and landing CG within envelope"
                : `⚠ ${!result.envelopeCheck.takeoffInside ? "Takeoff" : "Landing"} CG outside envelope`}
            </Text>
          ) : null}

          <View style={styles.divider} />
          <ResultLine label="Va (takeoff)" value={`${result.vaTakeoff.toFixed(1)} kt`} />
          <ResultLine label="Va (landing)" value={`${result.vaLanding.toFixed(1)} kt`} />

          <View style={styles.divider} />
          <ResultLine label="Departure PA / DA" value={`${Math.round(result.departure.pressureAltitude)} / ${Math.round(result.departure.densityAltitude)} ft`} />
          <ResultLine label="Destination PA / DA" value={`${Math.round(result.destination.pressureAltitude)} / ${Math.round(result.destination.densityAltitude)} ft`} />

          <View style={styles.divider} />
          <ResultLine label="Takeoff ground roll" value={`${Math.round(result.takeoffGroundRollFt)} ft`} />
          <ResultLine label="Takeoff 50ft obstacle" value={`${Math.round(result.takeoffObstacleFt)} ft`} />
          <ResultLine label="Landing ground roll" value={`${Math.round(result.landingGroundRollFt)} ft`} />
          <ResultLine label="Landing 50ft obstacle" value={`${Math.round(result.landingObstacleFt)} ft`} />
        </View>
      ) : null}

      {profile.envelopePoints && result ? (
        <View style={{ marginTop: spacing(2) }}>
          <Text style={styles.sectionTitle}>CG Envelope</Text>
          <CgEnvelopeChart
            envelope={profile.envelopePoints}
            points={[
              { label: "ZFW", weight: result.zfw.weight, arm: result.zfw.arm, color: colors.textMuted },
              { label: "T/O", weight: result.takeoffWeight.weight, arm: result.takeoffWeight.arm, color: colors.primary },
              { label: "LDG", weight: result.landingWeight.weight, arm: result.landingWeight.arm, color: colors.danger },
            ]}
          />
        </View>
      ) : null}

      <Collapsible title="Loading" defaultExpanded>
        <Row>
          <Field label={`Front seats (${u})`} input={front} />
          <Field label={`Rear seats (${u})`} input={rear} />
        </Row>
        <Row>
          <Field label={`Baggage (${u})`} input={baggage} />
          <Field label="Fuel loaded (gal)" input={fuelGal} />
        </Row>
        <Row>
          <Field label="Length of flight (hrs)" input={flightHours} />
          <Field label="Fuel burn (gal/hr)" input={fuelBurn} />
        </Row>
      </Collapsible>

      <Collapsible title="Departure weather" defaultExpanded={false}>
        <LegFields leg={departure} />
      </Collapsible>

      <Collapsible title="Destination weather" defaultExpanded={false}>
        <LegFields leg={destination} />
      </Collapsible>

      <Collapsible title="Takeoff performance chart" defaultExpanded={false}>
        <Text style={styles.helperText}>
          From your POH's short-field takeoff chart: the two pressure-altitude rows and two temperature columns
          bracketing today's conditions.
        </Text>
        <BracketFields label="Ground roll" bracket={takeoffGroundRoll} />
        <BracketFields label="50 ft obstacle" bracket={takeoffObstacle} />
      </Collapsible>

      <Collapsible title="Landing performance chart" defaultExpanded={false}>
        <BracketFields label="Ground roll" bracket={landingGroundRoll} />
        <BracketFields label="50 ft obstacle" bracket={landingObstacle} />
      </Collapsible>

      <Text style={styles.footnote}>
        Headwind correction reduces each bracket value by roughly 1% per knot of headwind component — a rule of
        thumb, not a certified correction. Always cross-check against your POH before flight.
      </Text>
    </ScrollView>
  );
}

function LegFields({ leg }: { leg: LegInputs }) {
  return (
    <>
      <Row>
        <Field label="OAT (°C)" input={leg.tempC} />
        <Field label="Altimeter (inHg)" input={leg.altimeterInHg} />
      </Row>
      <Row>
        <Field label="Field elevation (ft)" input={leg.elevationFt} />
        <Field label="Runway/wind angle (°)" input={leg.runwayWindAngleDeg} />
      </Row>
      <Field label="Wind speed (kt)" input={leg.windSpeedKt} />
    </>
  );
}

function BracketFields({ label, bracket }: { label: string; bracket: BracketInputs }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <View style={{ marginBottom: spacing(1) }}>
      <Text style={styles.bracketLabel}>{label}</Text>
      <Row>
        <Field label="Row 1, Col 1" input={bracket.row1Col1} />
        <Field label="Row 1, Col 2" input={bracket.row1Col2} />
      </Row>
      <Row>
        <Field label="Row 2, Col 1" input={bracket.row2Col1} />
        <Field label="Row 2, Col 2" input={bracket.row2Col2} />
      </Row>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 10 }}>{children}</View>;
}

function Field({ label, input }: { label: string; input: NumInput }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <View style={{ flex: 1, marginBottom: spacing(1.25) }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={input.text}
        onChangeText={input.setText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </View>
  );
}

function ResultRow({
  label,
  weight,
  arm,
  unit,
  warn,
}: {
  label: string;
  weight: number;
  arm?: number;
  unit: string;
  warn?: boolean;
}) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <View style={styles.resultLine}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, warn && { color: colors.danger }]}>
        {weight.toFixed(1)} {unit}
        {arm != null ? ` @ ${arm.toFixed(1)} in` : ""}
      </Text>
    </View>
  );
}

function ResultLine({ label, value }: { label: string; value: string }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <View style={styles.resultLine}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2.5), paddingBottom: spacing(5) },
    title: { fontSize: 20 * fontScale, fontWeight: "800", color: colors.text, marginBottom: spacing(1.5) },
    sectionTitle: {
      fontSize: 13 * fontScale,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      marginBottom: spacing(1),
    },
    resultCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: spacing(2),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    resultLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
    resultLabel: { fontSize: 13 * fontScale, color: colors.textMuted },
    resultValue: { fontSize: 14.5 * fontScale, fontWeight: "700", color: colors.text },
    warnText: { color: colors.danger, fontSize: 12.5 * fontScale, fontWeight: "700", marginTop: 6 },
    okText: { color: colors.acBadge },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing(1) },
    fieldLabel: { fontSize: 11.5 * fontScale, color: colors.textMuted, marginBottom: 4 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(1),
      color: colors.text,
      fontSize: 14.5 * fontScale,
    },
    bracketLabel: { fontSize: 12.5 * fontScale, fontWeight: "700", color: colors.text, marginBottom: 4 },
    helperText: { fontSize: 11.5 * fontScale, color: colors.textMuted, marginBottom: spacing(1), lineHeight: 16 * fontScale },
    footnote: { fontSize: 11 * fontScale, color: colors.textMuted, marginTop: spacing(3), lineHeight: 16 * fontScale },
  });
}
