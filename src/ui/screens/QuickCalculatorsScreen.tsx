import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { densityAltitude, isaStandardTempC, maneuveringSpeed, pressureAltitude } from "../../performance/calculations";

const r = (n: number | null, d = 1) => (n != null && Number.isFinite(n) ? n.toFixed(d) : "—");

function useNumberInput(initial = "") {
  const [text, setText] = useState(initial);
  const n = parseFloat(text);
  return { text, setText, value: Number.isFinite(n) ? n : null };
}

export default function QuickCalculatorsScreen() {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);

  const elevation = useNumberInput();
  const altimeter = useNumberInput("29.92");
  const oat = useNumberInput();

  const pa = elevation.value != null && altimeter.value != null ? pressureAltitude(elevation.value, altimeter.value) : null;
  const stdTemp = elevation.value != null ? isaStandardTempC(elevation.value) : null;
  const da = pa != null && stdTemp != null && oat.value != null ? densityAltitude(pa, stdTemp, oat.value) : null;

  const weight = useNumberInput();
  const maxGross = useNumberInput();
  const vaMaxGross = useNumberInput();
  const va =
    weight.value != null && maxGross.value != null && maxGross.value > 0 && vaMaxGross.value != null
      ? maneuveringSpeed(weight.value, maxGross.value, vaMaxGross.value)
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Pressure & Density Altitude</Text>
      <Row>
        <Field label="Field elevation (ft)" input={elevation} />
        <Field label="Altimeter (inHg)" input={altimeter} />
      </Row>
      <Field label="OAT (°C)" input={oat} />
      <View style={styles.resultCard}>
        <ResultLine
          label="Pressure altitude"
          value={pa != null ? `${Math.round(pa)} ft` : "—"}
          formula={`(29.92 − ${r(altimeter.value, 2)}) × 1000 + ${r(elevation.value, 0)} = ${r(pa, 0)} ft`}
        />
        <ResultLine
          label="ISA standard temp"
          value={stdTemp != null ? `${stdTemp.toFixed(1)}°C` : "—"}
          formula={`15 − 2 × (${r(elevation.value, 0)} ÷ 1000) = ${r(stdTemp)}°C`}
        />
        <ResultLine
          label="Density altitude"
          value={da != null ? `${Math.round(da)} ft` : "—"}
          formula={`${r(pa, 0)} + 120 × (${r(oat.value)} − ${r(stdTemp)}) = ${r(da, 0)} ft`}
          big
        />
      </View>

      <Text style={styles.sectionTitle}>Maneuvering Speed (Va)</Text>
      <Row>
        <Field label="Current weight" input={weight} />
        <Field label="Max gross weight" input={maxGross} />
      </Row>
      <Field label="Va at max gross (kt)" input={vaMaxGross} />
      <View style={styles.resultCard}>
        <ResultLine
          label="Va at current weight"
          value={va != null ? `${va.toFixed(1)} kt` : "—"}
          formula={`√(${r(weight.value)} ÷ ${r(maxGross.value)}) × ${r(vaMaxGross.value)} = ${r(va)} kt`}
          big
        />
      </View>

      <Text style={styles.footnote}>
        Density altitude uses the standard mechanical-computer approximation (120 ft per °C off ISA standard
        temperature). Maneuvering speed scales with the square root of the weight ratio to max gross — enter your
        aircraft's actual Va at max gross weight from its POH.
      </Text>
    </ScrollView>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 10 }}>{children}</View>;
}

function Field({ label, input }: { label: string; input: ReturnType<typeof useNumberInput> }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <View style={{ flex: 1, marginBottom: spacing(1.5) }}>
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

function ResultLine({ label, value, formula, big }: { label: string; value: string; formula: string; big?: boolean }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <View style={styles.resultBlock}>
      <View style={styles.resultLine}>
        <Text style={styles.resultLabel}>{label}</Text>
        <Text style={[styles.resultValue, big && { fontSize: 20 * fontScale, fontWeight: "800" }]}>{value}</Text>
      </View>
      <Text style={styles.formulaText}>{formula}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2.5), paddingBottom: spacing(5) },
    sectionTitle: {
      fontSize: 13 * fontScale,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      marginTop: spacing(2.5),
      marginBottom: spacing(1),
    },
    fieldLabel: { fontSize: 12 * fontScale, color: colors.textMuted, marginBottom: 4 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.1),
      color: colors.text,
      fontSize: 15 * fontScale,
    },
    resultCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing(1.75),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: spacing(0.5),
    },
    resultBlock: { marginBottom: 4 },
    resultLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
    resultLabel: { fontSize: 13 * fontScale, color: colors.textMuted },
    resultValue: { fontSize: 15 * fontScale, fontWeight: "700", color: colors.text },
    formulaText: { fontSize: 11 * fontScale, color: colors.textMuted, fontFamily: "Menlo", lineHeight: 15 * fontScale },
    footnote: { fontSize: 11 * fontScale, color: colors.textMuted, marginTop: spacing(3), lineHeight: 16 * fontScale },
  });
}
