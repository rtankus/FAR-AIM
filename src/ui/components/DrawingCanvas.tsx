import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Drawing } from "../../db/userdb";

function pathFor(points: [number, number][]): string {
  if (points.length === 0) return "";
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

/**
 * Ink overlay for one section. Sized to exactly cover the content View it's
 * layered on top of (see SectionDetailView), so strokes are stored — and
 * redrawn — in that content's own coordinate space. That keeps ink aligned
 * with the text across scrolling and app restarts on the same device; it
 * does NOT try to re-flow ink if the text itself wraps differently (a
 * different screen width, for instance).
 */
export function DrawingCanvas({
  width,
  height,
  drawings,
  active,
  color,
  strokeWidth,
  onStrokeComplete,
}: {
  width: number;
  height: number;
  drawings: Drawing[];
  active: boolean;
  color: string;
  strokeWidth: number;
  onStrokeComplete: (points: [number, number][]) => void;
}) {
  const [livePoints, setLivePoints] = useState<[number, number][]>([]);
  const pointsRef = useRef<[number, number][]>([]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Only claim a single-finger touch — a second finger means the user
        // wants to scroll, so we decline and let the ScrollView handle it.
        onStartShouldSetPanResponder: (e) => active && e.nativeEvent.touches.length === 1,
        onMoveShouldSetPanResponder: (e) => active && e.nativeEvent.touches.length === 1,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          pointsRef.current = [[locationX, locationY]];
          setLivePoints(pointsRef.current);
        },
        onPanResponderMove: (e) => {
          if (e.nativeEvent.touches.length > 1) return;
          const { locationX, locationY } = e.nativeEvent;
          pointsRef.current = [...pointsRef.current, [locationX, locationY]];
          setLivePoints(pointsRef.current);
        },
        onPanResponderRelease: () => {
          const points = pointsRef.current;
          pointsRef.current = [];
          // Keep rendering the just-finished stroke as "live" until the
          // parent's `drawings` list catches up with it, so it never
          // disappears for a frame between release and that state update.
          if (points.length > 1) onStrokeComplete(points);
          else setLivePoints([]);
        },
        onPanResponderTerminate: () => {
          pointsRef.current = [];
          setLivePoints([]);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [active, onStrokeComplete]
  );

  // Once the parent's `drawings` list has caught up with a just-finished
  // stroke (added optimistically — see SectionDetailView), stop rendering
  // it as "live"; it's now drawn from `drawings` instead.
  useEffect(() => {
    if (livePoints.length > 0) setLivePoints([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings]);

  if (width === 0 || height === 0) return null;

  return (
    <View
      pointerEvents={active ? "auto" : "none"}
      style={[StyleSheet.absoluteFill, { width, height }]}
      {...panResponder.panHandlers}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {drawings.map((d) => (
          <Path
            key={d.id}
            d={pathFor(d.points)}
            stroke={d.color}
            strokeWidth={d.stroke_width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {livePoints.length > 1 && (
          <Path
            d={pathFor(livePoints)}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </View>
  );
}
