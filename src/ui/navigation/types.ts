import type { Source } from "../../content/types";

export type RootStackParamList = {
  Home: undefined;
  PartsList: { source: Source };
  SectionsList: { source: Source; part: string };
  Detail: { id: string };
  Search: undefined;
  Bookmarks: undefined;
  Settings: undefined;
};
