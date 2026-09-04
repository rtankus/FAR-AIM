import { createNativeStackNavigator, type NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList, TabParamList } from "./types";
import HomeScreen from "../screens/HomeScreen";
import ReferenceScreen from "../screens/ReferenceScreen";
import PartsListScreen from "../screens/PartsListScreen";
import SectionsListScreen from "../screens/SectionsListScreen";
import DetailScreen from "../screens/DetailScreen";
import BookmarksScreen from "../screens/BookmarksScreen";
import SettingsScreen from "../screens/SettingsScreen";
import TcdsScreen from "../screens/TcdsScreen";
import TcdsCaptureScreen from "../screens/TcdsCaptureScreen";
import TcdsViewerScreen from "../screens/TcdsViewerScreen";
import WeatherScreen from "../screens/WeatherScreen";
import GfaMapScreen from "../screens/GfaMapScreen";
import NotamScreen from "../screens/NotamScreen";
import RulemakingScreen from "../screens/RulemakingScreen";
import TfrListScreen from "../screens/TfrListScreen";
import TfrMapScreen from "../screens/TfrMapScreen";
import NearbyAirportsScreen from "../screens/NearbyAirportsScreen";
import AirportDetailScreen from "../screens/AirportDetailScreen";
import PerformanceScreen from "../screens/PerformanceScreen";
import AircraftProfileFormScreen from "../screens/AircraftProfileFormScreen";
import WeightAndBalanceScreen from "../screens/WeightAndBalanceScreen";
import QuickCalculatorsScreen from "../screens/QuickCalculatorsScreen";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function stackScreenOptions(colors: ThemeColors): NativeStackNavigationOptions {
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  };
}

function HomeStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(colors)}>
      {/* No title — this is the tab's landing screen, not a page with a name of its own. */}
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Detail" component={DetailScreen} />
    </Stack.Navigator>
  );
}

function ReferenceStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="Reference" component={ReferenceScreen} options={{ title: "Reference" }} />
      <Stack.Screen name="PartsList" component={PartsListScreen} />
      <Stack.Screen name="SectionsList" component={SectionsListScreen} />
      <Stack.Screen name="Detail" component={DetailScreen} />
      <Stack.Screen name="Tcds" component={TcdsScreen} options={{ title: "TCDS" }} />
      <Stack.Screen name="TcdsCapture" component={TcdsCaptureScreen} options={{ title: "Add TCDS" }} />
      <Stack.Screen name="TcdsViewer" component={TcdsViewerScreen} />
      <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ title: "Bookmarks" }} />
      <Stack.Screen name="Rulemaking" component={RulemakingScreen} options={{ title: "Rulemaking" }} />
    </Stack.Navigator>
  );
}

function WeatherStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="Weather" component={WeatherScreen} options={{ title: "Weather" }} />
      <Stack.Screen name="GfaMap" component={GfaMapScreen} options={{ title: "GFA Map" }} />
      <Stack.Screen name="Notams" component={NotamScreen} options={{ title: "NOTAMs" }} />
      <Stack.Screen name="Tfr" component={TfrListScreen} options={{ title: "TFRs" }} />
      <Stack.Screen name="TfrMap" component={TfrMapScreen} options={{ title: "TFR Map" }} />
      <Stack.Screen name="NearbyAirports" component={NearbyAirportsScreen} options={{ title: "Nearby Airports" }} />
      <Stack.Screen name="AirportDetail" component={AirportDetailScreen} options={{ title: "Airport" }} />
    </Stack.Navigator>
  );
}

function PerformanceStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="Performance" component={PerformanceScreen} options={{ title: "Performance" }} />
      <Stack.Screen name="AircraftProfileForm" component={AircraftProfileFormScreen} />
      <Stack.Screen name="WeightAndBalance" component={WeightAndBalanceScreen} options={{ title: "Weight & Balance" }} />
      <Stack.Screen name="QuickCalculators" component={QuickCalculatorsScreen} options={{ title: "Quick Calculators" }} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(colors)}>
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </Stack.Navigator>
  );
}

// Plain text glyphs for tab icons, matching the app's existing minimal
// text-glyph icon convention (the header's gear, the row chevrons) rather
// than pulling in an icon-font dependency for five icons.
const TAB_ICONS: Record<keyof TabParamList, string> = {
  HomeTab: "🏠",
  ReferenceTab: "📖",
  WeatherTab: "⛅",
  PerformanceTab: "🧮",
  SettingsTab: "⚙︎",
};

export default function RootNavigator() {
  const { colors } = useTheme();
  // The default tab bar packs its icon+label tight against the top of the
  // bar, leaving the whole safe-area inset below feeling like dead space
  // rather than part of the bar. Sizing the bar explicitly (content height +
  // the device's own safe-area inset) and padding both ends lets the
  // icon/label sit lower — closer to where a thumb actually rests — while
  // the extra safe-area space still separates it from the home indicator /
  // the screen's rounded corners, instead of icons crowding right up to them.
  const insets = useSafeAreaInsets();
  const tabBarHeight = 54 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>{TAB_ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: "Home" }} />
      <Tab.Screen name="ReferenceTab" component={ReferenceStack} options={{ title: "Reference" }} />
      <Tab.Screen name="WeatherTab" component={WeatherStack} options={{ title: "Weather" }} />
      <Tab.Screen name="PerformanceTab" component={PerformanceStack} options={{ title: "Performance" }} />
      <Tab.Screen name="SettingsTab" component={SettingsStack} options={{ title: "Settings" }} />
    </Tab.Navigator>
  );
}
