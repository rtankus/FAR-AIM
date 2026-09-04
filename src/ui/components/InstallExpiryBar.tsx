import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../ThemeContext";
import { useInstallExpiry } from "../hooks/useInstallExpiry";

// Green (plenty of runway) -> orange (due soon) -> red (expired), matching
// the app's existing badge colors rather than stock traffic-light hex.
const GREEN = "#5E7B0B"; // acBadge
const ORANGE = "#B4530A"; // aimBadge
const RED = "#C0392B"; // danger

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(from: string, to: string, t: number): string {
  const f = [1, 3, 5].map((i) => parseInt(from.slice(i, i + 2), 16));
  const tt = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
  const c = f.map((v, i) => Math.round(lerp(v, tt[i], t)));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Green at 7 days down to orange at 3, then orange down to red at 0. */
function colorForDaysRemaining(daysRemaining: number): string {
  const clamped = Math.max(0, Math.min(7, daysRemaining));
  if (clamped >= 3) return lerpColor(ORANGE, GREEN, (clamped - 3) / 4);
  return lerpColor(RED, ORANGE, clamped / 3);
}

/**
 * A super-narrow bar pinned to the top of the app, counting down the 7-day
 * window a free Apple developer signing certificate is good for before the
 * install needs to be refreshed from the laptop (see useInstallExpiry).
 * Renders nothing once the install db hasn't loaded yet.
 */
export default function InstallExpiryBar() {
  const insets = useSafeAreaInsets();
  const { appearance } = useTheme();
  const expiry = useInstallExpiry();
  if (!expiry) return null;

  const { daysRemaining, expired } = expiry;
  // "night" mode is a red-on-black night-vision palette (see theme.ts) —
  // every accent stays in the red family there, so skip the green/orange
  // gradient and just vary shade with how urgent it is.
  const backgroundColor = appearance === "night" ? (expired ? "#FF3B30" : "#802420") : colorForDaysRemaining(daysRemaining);

  const label = expired
    ? "Install expired — reinstall from your laptop"
    : daysRemaining === 0
      ? "Expires today — reinstall from your laptop soon"
      : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining before reinstall`;

  return (
    <View style={[styles.bar, { backgroundColor, paddingTop: insets.top }]}>
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingBottom: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
});
