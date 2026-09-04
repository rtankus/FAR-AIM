import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from "react-native-svg";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import type { EnvelopePoint } from "../../performance/types";

export interface CgEnvelopePlotPoint {
  label: string;
  arm: number;
  weight: number;
  color: string;
}

const CHART_HEIGHT = 260;
const PADDING = 36;

/** Plots a CG envelope polygon (arm on X, weight on Y) with one or more loading points marked on it. */
export function CgEnvelopeChart({ envelope, points }: { envelope: EnvelopePoint[]; points: CgEnvelopePlotPoint[] }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);

  const { toSvg, width } = useMemo(() => {
    const arms = [...envelope.map((p) => p.arm), ...points.map((p) => p.arm)];
    const weights = [...envelope.map((p) => p.weight), ...points.map((p) => p.weight)];
    const minArm = Math.min(...arms);
    const maxArm = Math.max(...arms);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const armPad = (maxArm - minArm) * 0.08 || 1;
    const weightPad = (maxWeight - minWeight) * 0.08 || 1;
    const armLo = minArm - armPad;
    const armHi = maxArm + armPad;
    const weightLo = minWeight - weightPad;
    const weightHi = maxWeight + weightPad;
    const chartWidth = 320;
    const plotW = chartWidth - PADDING * 2;
    const plotH = CHART_HEIGHT - PADDING * 2;
    const fn = (arm: number, weight: number) => ({
      x: PADDING + ((arm - armLo) / (armHi - armLo)) * plotW,
      // SVG y grows downward — flip so heavier weight plots higher, matching a normal envelope chart.
      y: PADDING + (1 - (weight - weightLo) / (weightHi - weightLo)) * plotH,
    });
    return { toSvg: fn, width: chartWidth };
  }, [envelope, points]);

  const envelopeSvgPoints = envelope.map((p) => toSvg(p.arm, p.weight));

  return (
    <View>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`}>
        <Polygon
          points={envelopeSvgPoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill={colors.primary + "1A"}
          stroke={colors.primary}
          strokeWidth={1.5}
        />
        {points.map((pt) => {
          const svg = toSvg(pt.arm, pt.weight);
          return (
            <G key={pt.label}>
              <Circle cx={svg.x} cy={svg.y} r={5} fill={pt.color} stroke="#fff" strokeWidth={1.5} />
              <SvgText x={svg.x + 8} y={svg.y - 6} fontSize={11} fill={colors.text} fontWeight="700">
                {pt.label}
              </SvgText>
            </G>
          );
        })}
        <Line x1={PADDING} y1={PADDING} x2={PADDING} y2={CHART_HEIGHT - PADDING} stroke={colors.border} strokeWidth={1} />
        <Line
          x1={PADDING}
          y1={CHART_HEIGHT - PADDING}
          x2={width - PADDING}
          y2={CHART_HEIGHT - PADDING}
          stroke={colors.border}
          strokeWidth={1}
        />
      </Svg>
      <Text style={styles.axisLabel}>Arm (in) →   ·   ↑ Weight</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    axisLabel: { fontSize: 11 * fontScale, color: colors.textMuted, textAlign: "center", marginTop: 4 },
  });
}
