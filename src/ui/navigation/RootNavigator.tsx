import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./types";
import HomeScreen from "../screens/HomeScreen";
import PartsListScreen from "../screens/PartsListScreen";
import SectionsListScreen from "../screens/SectionsListScreen";
import DetailScreen from "../screens/DetailScreen";
import SearchScreen from "../screens/SearchScreen";
import BookmarksScreen from "../screens/BookmarksScreen";
import { theme } from "../theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: "FAR/AIM" }} />
      <Stack.Screen name="PartsList" component={PartsListScreen} />
      <Stack.Screen name="SectionsList" component={SectionsListScreen} />
      <Stack.Screen name="Detail" component={DetailScreen} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Search" }} />
      <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ title: "Bookmarks" }} />
    </Stack.Navigator>
  );
}
