import { Text, type TextStyle } from "react-native";
import { useAirportsDataMeta } from "../hooks/useAirportsDataMeta";
import { timeAgo } from "../../weather/format";

/**
 * "Data as of <date> (<age>) · FAA CIFP + OurAirports" — shown wherever
 * airports.db-backed data is displayed, so it's obvious at the point of use
 * (not just buried in Settings) how current the runway/frequency/procedure
 * data is and where it came from.
 */
export default function AirportsDataFreshness({ style }: { style?: TextStyle }) {
  const meta = useAirportsDataMeta();
  if (!meta) return null;
  const builtAtMs = new Date(meta.builtAt).getTime();
  return (
    <Text style={style}>
      Data as of {new Date(meta.builtAt).toLocaleDateString()} ({timeAgo(builtAtMs)}) · FAA CIFP/d-TPP + OurAirports
    </Text>
  );
}
