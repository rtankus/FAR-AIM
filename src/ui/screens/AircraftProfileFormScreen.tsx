import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { deleteProfile, getProfile, newProfileId, saveProfile } from "../../performance/store";
import type { AircraftProfile, EnvelopePoint, WeightUnit } from "../../performance/types";

type Props = NativeStackScreenProps<RootStackParamList, "AircraftProfileForm">;

function blankProfile(): AircraftProfile {
  const now = Date.now();
  return {
    id: newProfileId(),
    name: "",
    weightUnit: "lb",
    bewWeight: 0,
    bewArm: 0,
    frontArm: 0,
    rearArm: 0,
    baggageArm: 0,
    baggageMax: null,
    fuelArm: 0,
    fuelWeightPerGal: 6,
    taxiFuelGal: 0,
    maxGrossWeight: 0,
    vaAtMaxGross: 0,
    envelopePoints: null,
    createdAt: now,
    updatedAt: now,
  };
}

export default function AircraftProfileFormScreen({ navigation, route }: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const editingId = route.params?.id;
  const [profile, setProfile] = useState<AircraftProfile>(blankProfile);
  const [envelope, setEnvelope] = useState<EnvelopePoint[]>([]);
  const [loaded, setLoaded] = useState(!editingId);

  useEffect(() => {
    navigation.setOptions({ title: editingId ? "Edit Aircraft" : "Add Aircraft" });
  }, [navigation, editingId]);

  useEffect(() => {
    if (!editingId) return;
    getProfile(userDb, editingId).then((p) => {
      if (p) {
        setProfile(p);
        setEnvelope(p.envelopePoints ?? []);
      }
      setLoaded(true);
    });
  }, [editingId, userDb]);

  const set = <K extends keyof AircraftProfile>(key: K, value: AircraftProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const handleSave = useCallback(async () => {
    if (!profile.name.trim()) {
      Alert.alert("Name required", "Give this aircraft a name or tail number.");
      return;
    }
    const toSave: AircraftProfile = {
      ...profile,
      updatedAt: Date.now(),
      envelopePoints: envelope.length >= 3 ? envelope : null,
    };
    await saveProfile(userDb, toSave);
    navigation.goBack();
  }, [profile, envelope, userDb, navigation]);

  const handleDelete = useCallback(() => {
    Alert.alert("Delete aircraft?", `This removes "${profile.name}" and its saved numbers.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteProfile(userDb, profile.id);
          navigation.goBack();
        },
      },
    ]);
  }, [profile.id, profile.name, userDb, navigation]);

  if (!loaded) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field label="Name / tail number" value={profile.name} onChangeText={(v) => set("name", v)} keyboardType="default" />

      <Text style={styles.sectionLabel}>Units</Text>
      <View style={styles.segmentRow}>
        {(["lb", "kg"] as WeightUnit[]).map((u) => (
          <Pressable
            key={u}
            onPress={() => set("weightUnit", u)}
            style={[styles.segment, profile.weightUnit === u && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, profile.weightUnit === u && styles.segmentTextActive]}>{u}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Basic Empty Weight</Text>
      <Row>
        <NumberField label={`Weight (${profile.weightUnit})`} value={profile.bewWeight} onChange={(v) => set("bewWeight", v)} />
        <NumberField label="Arm (in)" value={profile.bewArm} onChange={(v) => set("bewArm", v)} />
      </Row>

      <Text style={styles.sectionLabel}>Station arms (fixed, inches)</Text>
      <Row>
        <NumberField label="Front seats" value={profile.frontArm} onChange={(v) => set("frontArm", v)} />
        <NumberField label="Rear seats" value={profile.rearArm} onChange={(v) => set("rearArm", v)} />
      </Row>
      <Row>
        <NumberField label="Baggage" value={profile.baggageArm} onChange={(v) => set("baggageArm", v)} />
        <NumberField
          label={`Baggage max (${profile.weightUnit}, optional)`}
          value={profile.baggageMax ?? undefined}
          onChange={(v) => set("baggageMax", v)}
        />
      </Row>

      <Text style={styles.sectionLabel}>Fuel</Text>
      <Row>
        <NumberField label="Fuel arm (in)" value={profile.fuelArm} onChange={(v) => set("fuelArm", v)} />
        <NumberField label="Fuel weight (lb/gal)" value={profile.fuelWeightPerGal} onChange={(v) => set("fuelWeightPerGal", v)} />
      </Row>
      <NumberField label="Taxi fuel (gal)" value={profile.taxiFuelGal} onChange={(v) => set("taxiFuelGal", v)} />

      <Text style={styles.sectionLabel}>Limits</Text>
      <Row>
        <NumberField
          label={`Max gross weight (${profile.weightUnit})`}
          value={profile.maxGrossWeight}
          onChange={(v) => set("maxGrossWeight", v)}
        />
        <NumberField label="Va at max gross (kt)" value={profile.vaAtMaxGross} onChange={(v) => set("vaAtMaxGross", v)} />
      </Row>

      <View style={styles.envelopeHeaderRow}>
        <Text style={styles.sectionLabel}>CG envelope points (optional)</Text>
        <Pressable onPress={() => setEnvelope((e) => [...e, { weight: 0, arm: 0 }])}>
          <Text style={styles.addLink}>+ Add point</Text>
        </Pressable>
      </View>
      <Text style={styles.helperText}>
        List the certified envelope's corner points in order (weight + arm), same units as above. Needs at least 3
        to draw. Leave empty to skip the envelope chart.
      </Text>
      {envelope.map((pt, i) => (
        <Row key={i}>
          <NumberField
            label={`Weight ${i + 1}`}
            value={pt.weight}
            onChange={(v) => setEnvelope((e) => e.map((p, j) => (j === i ? { ...p, weight: v } : p)))}
          />
          <NumberField
            label={`Arm ${i + 1}`}
            value={pt.arm}
            onChange={(v) => setEnvelope((e) => e.map((p, j) => (j === i ? { ...p, arm: v } : p)))}
          />
          <Pressable onPress={() => setEnvelope((e) => e.filter((_, j) => j !== i))} style={styles.removeButton}>
            <Text style={styles.removeButtonText}>✕</Text>
          </Pressable>
        </Row>
      ))}

      <Pressable onPress={handleSave} style={styles.saveButton}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>

      {editingId ? (
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete Aircraft</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 10 }}>{children}</View>;
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType: "default" | "numeric";
}) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <View style={{ marginBottom: spacing(1.5) }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </View>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [text, setText] = useState(value != null && value !== 0 ? String(value) : value === 0 ? "0" : "");

  useEffect(() => {
    setText(value != null ? String(value) : "");
  }, [value]);

  return (
    <View style={{ flex: 1, marginBottom: spacing(1.5) }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          const n = parseFloat(t);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2.5), paddingBottom: spacing(5) },
    sectionLabel: {
      fontSize: 13 * fontScale,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      marginTop: spacing(2),
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
    segmentRow: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 10, padding: 4, gap: 4 },
    segment: { flex: 1, paddingVertical: spacing(1.25), borderRadius: 8, alignItems: "center" },
    segmentActive: { backgroundColor: colors.primary },
    segmentText: { color: colors.text, fontWeight: "600", fontSize: 14 * fontScale },
    segmentTextActive: { color: "#fff" },
    envelopeHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing(2) },
    addLink: { fontSize: 13 * fontScale, fontWeight: "700", color: colors.primary },
    helperText: { fontSize: 11.5 * fontScale, color: colors.textMuted, marginBottom: spacing(1), lineHeight: 16 * fontScale },
    removeButton: { justifyContent: "center", alignItems: "center", paddingHorizontal: spacing(1) },
    removeButtonText: { color: colors.danger, fontSize: 16 * fontScale, fontWeight: "700" },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: spacing(1.5),
      alignItems: "center",
      marginTop: spacing(3),
    },
    saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 * fontScale },
    deleteButton: { alignItems: "center", paddingVertical: spacing(2) },
    deleteButtonText: { color: colors.danger, fontWeight: "700", fontSize: 14 * fontScale },
  });
}
