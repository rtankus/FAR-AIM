export type WeightUnit = "lb" | "kg";

/** A vertex of a CG envelope polygon, in the profile's own weight unit and inches. */
export interface EnvelopePoint {
  weight: number;
  arm: number;
}

/**
 * A saved aircraft's fixed weight-and-balance constants — everything that
 * doesn't change flight to flight. Ported from a personal W&B spreadsheet:
 * each station is a fixed arm the user's own weight gets multiplied against,
 * fuel is bought by the gallon and converted with a fixed lb/gal, and
 * maneuvering speed scales off a known Va at a known max gross weight.
 */
export interface AircraftProfile {
  id: string;
  name: string;
  weightUnit: WeightUnit;
  bewWeight: number;
  bewArm: number;
  frontArm: number;
  rearArm: number;
  baggageArm: number;
  baggageMax: number | null;
  fuelArm: number;
  fuelWeightPerGal: number;
  taxiFuelGal: number;
  maxGrossWeight: number;
  vaAtMaxGross: number;
  /** Ordered polygon vertices of the certified CG envelope, if plotted. */
  envelopePoints: EnvelopePoint[] | null;
  createdAt: number;
  updatedAt: number;
}

export interface WeatherLegInputs {
  tempC: number;
  altimeterInHg: number;
  elevationFt: number;
  runwayWindAngleDeg: number;
  windSpeedKt: number;
}

/**
 * A 2x2 bracket of adjacent values read straight off a POH performance
 * chart (e.g. two pressure-altitude rows x two temperature columns bounding
 * today's actual conditions) — the same manual lookup a pilot does with a
 * ruler on the paper chart, just typed in instead.
 */
export interface ChartBracket {
  row1Col1: number;
  row1Col2: number;
  row2Col1: number;
  row2Col2: number;
}

export const EMPTY_BRACKET: ChartBracket = { row1Col1: 0, row1Col2: 0, row2Col1: 0, row2Col2: 0 };

export interface WeightAndBalanceInputs {
  frontWeight: number;
  rearWeight: number;
  baggageWeight: number;
  fuelGal: number;
  flightHours: number;
  fuelBurnGalPerHr: number;
  departure: WeatherLegInputs;
  destination: WeatherLegInputs;
  takeoffGroundRoll: ChartBracket;
  takeoffObstacle: ChartBracket;
  landingGroundRoll: ChartBracket;
  landingObstacle: ChartBracket;
}

export interface WeightArmMoment {
  weight: number;
  arm: number;
  moment: number;
}

export interface LegAtmosphere {
  pressureAltitude: number;
  standardTempC: number;
  densityAltitude: number;
}

export interface WeightAndBalanceResult {
  zfw: WeightArmMoment;
  rampWeight: { weight: number; moment: number };
  takeoffWeight: WeightArmMoment;
  landingWeight: WeightArmMoment;
  vaTakeoff: number;
  vaLanding: number;
  departure: LegAtmosphere;
  destination: LegAtmosphere;
  takeoffHeadwindKt: number;
  landingHeadwindKt: number;
  takeoffGroundRollFt: number;
  takeoffObstacleFt: number;
  landingGroundRollFt: number;
  landingObstacleFt: number;
  withinMaxGross: boolean;
  envelopeCheck: { takeoffInside: boolean; landingInside: boolean } | null;
}
