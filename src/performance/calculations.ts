import type {
  AircraftProfile,
  ChartBracket,
  EnvelopePoint,
  WeightAndBalanceInputs,
  WeightAndBalanceResult,
} from "./types";

/**
 * Standard mechanical-computer pressure altitude approximation:
 * PA = field elevation + 1000 ft for every inHg the altimeter setting reads
 * below 29.92.
 */
export function pressureAltitude(elevationFt: number, altimeterInHg: number): number {
  return (29.92 - altimeterInHg) * 1000 + elevationFt;
}

/** ISA standard temperature at a given elevation: 15°C at sea level, -2°C per 1000 ft. */
export function isaStandardTempC(elevationFt: number): number {
  return 15 - 2 * (elevationFt / 1000);
}

/**
 * Standard rule-of-thumb density altitude: pressure altitude, adjusted
 * 120 ft for every degree C the actual temperature differs from standard.
 */
export function densityAltitude(pressureAltitudeFt: number, standardTempC: number, actualTempC: number): number {
  return 120 * (actualTempC - standardTempC) + pressureAltitudeFt;
}

/** Headwind component of a wind at `windSpeedKt` blowing `angleDeg` off the runway heading. */
export function headwindComponent(windSpeedKt: number, runwayWindAngleDeg: number): number {
  return windSpeedKt * Math.cos((runwayWindAngleDeg * Math.PI) / 180);
}

/** Va scales with the square root of the weight ratio to max gross. */
export function maneuveringSpeed(weight: number, maxGrossWeight: number, vaAtMaxGross: number): number {
  return Math.sqrt(weight / maxGrossWeight) * vaAtMaxGross;
}

/**
 * Averages a 2x2 chart bracket and applies a headwind correction: each cell
 * is reduced by (headwind ÷ 100) of its own value before averaging — i.e. a
 * ~1%-per-knot rule of thumb, not the FAA's usual "-10% per 9 kt" note
 * applied literally. This mirrors the source spreadsheet's own method
 * exactly; treat it as a personal approximation, not a certified correction.
 */
export function interpolateBracket(bracket: ChartBracket, headwindKt: number): number {
  const factor = headwindKt / 100;
  const adjusted = (v: number) => v - factor * v;
  const row1Avg = (adjusted(bracket.row1Col1) + adjusted(bracket.row1Col2)) / 2;
  const row2Avg = (adjusted(bracket.row2Col1) + adjusted(bracket.row2Col2)) / 2;
  return (row1Avg + row2Avg) / 2;
}

/** Ray-casting point-in-polygon test, used for the CG envelope check. */
function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function isInsideEnvelope(weight: number, arm: number, envelope: EnvelopePoint[]): boolean {
  return pointInPolygon(
    { x: arm, y: weight },
    envelope.map((p) => ({ x: p.arm, y: p.weight }))
  );
}

/**
 * Full weight & balance + performance workup for one flight, given a saved
 * aircraft profile and this flight's specific loading/weather/chart inputs.
 * Faithfully ports the row-by-row logic of the source spreadsheet: BEW →
 * ZFW → ramp → takeoff (minus taxi fuel) → landing (minus fuel burned), with
 * arm/CG derived as moment ÷ weight at each stage.
 */
export function computeWeightAndBalance(
  profile: AircraftProfile,
  inputs: WeightAndBalanceInputs
): WeightAndBalanceResult {
  const bewMoment = profile.bewWeight * profile.bewArm;
  const frontMoment = inputs.frontWeight * profile.frontArm;
  const rearMoment = inputs.rearWeight * profile.rearArm;
  const baggageMoment = inputs.baggageWeight * profile.baggageArm;

  const zfwWeight = profile.bewWeight + inputs.frontWeight + inputs.rearWeight + inputs.baggageWeight;
  const zfwMoment = bewMoment + frontMoment + rearMoment + baggageMoment;
  const zfwArm = zfwMoment / zfwWeight;

  const fuelWeight = inputs.fuelGal * profile.fuelWeightPerGal;
  const fuelMoment = fuelWeight * profile.fuelArm;
  const rampWeight = zfwWeight + fuelWeight;
  const rampMoment = zfwMoment + fuelMoment;

  const taxiFuelWeight = profile.taxiFuelGal * profile.fuelWeightPerGal;
  const taxiMoment = taxiFuelWeight * profile.fuelArm;
  const takeoffWeightVal = rampWeight - taxiFuelWeight;
  const takeoffMoment = rampMoment - taxiMoment;
  const takeoffArm = takeoffMoment / takeoffWeightVal;

  const fuelBurnWeight = inputs.fuelBurnGalPerHr * inputs.flightHours * profile.fuelWeightPerGal;
  const fuelBurnMoment = fuelBurnWeight * profile.fuelArm;
  const landingWeightVal = takeoffWeightVal - fuelBurnWeight;
  const landingMoment = takeoffMoment - fuelBurnMoment;
  const landingArm = landingMoment / landingWeightVal;

  const vaTakeoff = maneuveringSpeed(takeoffWeightVal, profile.maxGrossWeight, profile.vaAtMaxGross);
  const vaLanding = maneuveringSpeed(landingWeightVal, profile.maxGrossWeight, profile.vaAtMaxGross);

  const depPA = pressureAltitude(inputs.departure.elevationFt, inputs.departure.altimeterInHg);
  const depStdTemp = isaStandardTempC(inputs.departure.elevationFt);
  const depDA = densityAltitude(depPA, depStdTemp, inputs.departure.tempC);

  const destPA = pressureAltitude(inputs.destination.elevationFt, inputs.destination.altimeterInHg);
  const destStdTemp = isaStandardTempC(inputs.destination.elevationFt);
  const destDA = densityAltitude(destPA, destStdTemp, inputs.destination.tempC);

  const takeoffHeadwindKt = headwindComponent(inputs.departure.windSpeedKt, inputs.departure.runwayWindAngleDeg);
  const landingHeadwindKt = headwindComponent(inputs.destination.windSpeedKt, inputs.destination.runwayWindAngleDeg);

  return {
    zfw: { weight: zfwWeight, arm: zfwArm, moment: zfwMoment },
    rampWeight: { weight: rampWeight, moment: rampMoment },
    takeoffWeight: { weight: takeoffWeightVal, arm: takeoffArm, moment: takeoffMoment },
    landingWeight: { weight: landingWeightVal, arm: landingArm, moment: landingMoment },
    vaTakeoff,
    vaLanding,
    departure: { pressureAltitude: depPA, standardTempC: depStdTemp, densityAltitude: depDA },
    destination: { pressureAltitude: destPA, standardTempC: destStdTemp, densityAltitude: destDA },
    takeoffHeadwindKt,
    landingHeadwindKt,
    takeoffGroundRollFt: interpolateBracket(inputs.takeoffGroundRoll, takeoffHeadwindKt),
    takeoffObstacleFt: interpolateBracket(inputs.takeoffObstacle, takeoffHeadwindKt),
    landingGroundRollFt: interpolateBracket(inputs.landingGroundRoll, landingHeadwindKt),
    landingObstacleFt: interpolateBracket(inputs.landingObstacle, landingHeadwindKt),
    withinMaxGross: takeoffWeightVal <= profile.maxGrossWeight,
    envelopeCheck: profile.envelopePoints
      ? {
          takeoffInside: isInsideEnvelope(takeoffWeightVal, takeoffArm, profile.envelopePoints),
          landingInside: isInsideEnvelope(landingWeightVal, landingArm, profile.envelopePoints),
        }
      : null,
  };
}
