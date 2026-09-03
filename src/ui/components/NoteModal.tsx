import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

/**
 * Add/edit/delete UI for a single highlight's note. Used both right after
 * picking a new word range and when tapping an existing highlight.
 */
export function NoteModal({
  visible,
  quotedText,
  initialNote,
  onSave,
  onDelete,
  onCancel,
}: {
  visible: boolean;
  quotedText: string;
  initialNote: string;
  onSave: (note: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [text, setText] = useState(initialNote);

  useEffect(() => {
    if (visible) setText(initialNote);
  }, [visible, initialNote]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.quoteLabel}>Highlighted</Text>
          <Text style={styles.quote} numberOfLines={3}>
            “{quotedText}”
          </Text>

          <TextInput
            style={styles.input}
            multiline
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder="Add a note (optional)…"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.row}>
            {onDelete && (
              <Pressable onPress={onDelete} style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
                <Text style={styles.deleteText}>Remove highlight</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(text)}
              style={({ pressed }) => [styles.button, styles.saveButton, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      padding: spacing(3),
    },
    card: {
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: spacing(2.5),
    },
    quoteLabel: { fontSize: 12 * fontScale, fontWeight: "700", color: colors.textMuted, marginBottom: 4 },
    quote: { fontSize: 15 * fontScale, fontStyle: "italic", color: colors.text, marginBottom: spacing(2) },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: spacing(1.5),
      minHeight: 90,
      fontSize: 16 * fontScale,
      color: colors.text,
      textAlignVertical: "top",
    },
    row: { flexDirection: "row", alignItems: "center", marginTop: spacing(2), gap: spacing(1) },
    button: { paddingVertical: spacing(1), paddingHorizontal: spacing(1.5) },
    saveButton: { backgroundColor: colors.primary, borderRadius: 8 },
    saveText: { color: "#fff", fontWeight: "700", fontSize: 15 * fontScale },
    cancelText: { color: colors.textMuted, fontWeight: "600", fontSize: 15 * fontScale },
    deleteText: { color: colors.danger, fontWeight: "600", fontSize: 15 * fontScale },
  });
}
