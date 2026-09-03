import { useEffect, useState } from "react";
import { FlatList } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { Section } from "../../content/types";
import { listSectionsInPart } from "../../db/queries";
import { SectionListItem } from "../components/SectionListItem";
import { SplitView } from "../components/SplitView";
import { SectionDetailPlaceholder, SectionDetailView } from "../components/SectionDetailView";
import { useIsTablet } from "../hooks/useIsTablet";

type Props = NativeStackScreenProps<RootStackParamList, "SectionsList">;

export default function SectionsListScreen({ route, navigation }: Props) {
  const { source, part } = route.params;
  const db = useSQLiteContext();
  const isTablet = useIsTablet();
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: source === "AIM" ? part : `Part ${part}` });
    listSectionsInPart(db, source, part).then((rows) => {
      setSections(rows);
      if (isTablet) setSelectedId((current) => current ?? rows[0]?.id ?? null);
    });
    // isTablet intentionally excluded: switching orientation mid-screen shouldn't refetch/reset selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, source, part, navigation]);

  const list = (
    <FlatList
      data={sections}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <SectionListItem
          section={item}
          onPress={() =>
            isTablet ? setSelectedId(item.id) : navigation.navigate("Detail", { id: item.id })
          }
        />
      )}
    />
  );

  if (!isTablet) return list;

  return (
    <SplitView
      master={list}
      detail={
        selectedId ? (
          <SectionDetailView id={selectedId} />
        ) : (
          <SectionDetailPlaceholder message="Select a section to read it." />
        )
      }
    />
  );
}
