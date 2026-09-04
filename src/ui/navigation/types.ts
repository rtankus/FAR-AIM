import type { NavigatorScreenParams } from "@react-navigation/native";
import type { Source } from "../../content/types";
import type { ProcedureType } from "../../airports/types";

// One shared route table, reused by every tab's own nested stack navigator
// (see RootNavigator.tsx). Each stack only actually registers the subset of
// these screens it needs, but sharing one type keeps every screen file's
// `NativeStackScreenProps<RootStackParamList, "X">` working unchanged
// regardless of which tab's stack it's mounted under.
export type RootStackParamList = {
  // Home tab (preflight briefing + daily reading picks)
  Home: undefined;
  // Reference tab (search + browse FAR/AIM/AC, TCDS, bookmarks, rulemaking)
  Reference: undefined;
  PartsList: { source: Source };
  SectionsList: { source: Source; part: string };
  Tcds: undefined;
  TcdsCapture: { startUrl?: string } | undefined;
  TcdsViewer: { id: string };
  Rulemaking: undefined;
  Bookmarks: undefined;
  // Reachable from Home and Reference
  Detail: { id: string };
  // Weather tab
  Weather: undefined;
  GfaMap: undefined;
  Notams: undefined;
  Tfr: undefined;
  TfrMap:
    | { focusId?: string; center?: { lat: number; lon: number; label: string }; radiusNm?: number }
    | undefined;
  // Airports tab
  NearbyAirports: undefined;
  AirportDetail: { ident: string };
  ProcedurePlate: { airportIdent: string; type: ProcedureType; name: string };
  // Performance tab
  Performance: undefined;
  AircraftProfileForm: { id?: string } | undefined;
  WeightAndBalance: { profileId: string };
  QuickCalculators: undefined;
  // Settings tab
  Settings: undefined;
};

// Each tab's value is typed as nested-screen params (rather than plain
// `undefined`) so a screen in one tab can jump into a *specific* screen of
// another tab — e.g. Home linking straight into the Weather tab's GFA map —
// via `navigation.getParent<BottomTabNavigationProp<TabParamList>>()
// ?.navigate('WeatherTab', { screen: 'GfaMap' })`.
export type TabParamList = {
  HomeTab: NavigatorScreenParams<RootStackParamList>;
  ReferenceTab: NavigatorScreenParams<RootStackParamList>;
  WeatherTab: NavigatorScreenParams<RootStackParamList>;
  AirportsTab: NavigatorScreenParams<RootStackParamList>;
  PerformanceTab: NavigatorScreenParams<RootStackParamList>;
  SettingsTab: NavigatorScreenParams<RootStackParamList>;
};
