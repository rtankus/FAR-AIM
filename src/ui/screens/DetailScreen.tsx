import { useCallback } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { SectionDetailView } from "../components/SectionDetailView";

type Props = NativeStackScreenProps<RootStackParamList, "Detail">;

export default function DetailScreen({ route, navigation }: Props) {
  const onTitleChange = useCallback(
    (title: string) => navigation.setOptions({ title }),
    [navigation]
  );
  // Drawing strokes near the left edge otherwise fight the iOS
  // swipe-to-go-back gesture, so disable it for as long as draw mode is on.
  const onDrawModeChange = useCallback(
    (active: boolean) => navigation.setOptions({ gestureEnabled: !active }),
    [navigation]
  );
  return (
    <SectionDetailView id={route.params.id} onTitleChange={onTitleChange} onDrawModeChange={onDrawModeChange} />
  );
}
