import { useWindowDimensions } from "react-native";

// A phone in landscape can be nearly as wide as a small tablet in portrait,
// so we key off the *shorter* dimension (which stays roughly constant across
// rotation) rather than raw width. 600dp comfortably separates phones
// (iPhone Pro Max landscape height ~430dp) from tablets (iPad mini portrait
// width ~744dp).
const TABLET_MIN_SHORT_SIDE = 600;

export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  return Math.min(width, height) >= TABLET_MIN_SHORT_SIDE;
}
