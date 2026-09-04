import type { AircraftProfile } from "./types";

// Ported from the user's own "Weight & Balance 2.xlsx" — one tab per tail
// number. Only the fixed aircraft constants (BEW, station arms, fuel arm,
// taxi fuel, max gross, Va) came from that sheet; per-flight numbers
// (loaded weights, fuel, weather, chart brackets) aren't part of a profile
// and still get entered per flight. BEW arm is derived from the sheet's own
// BEW weight/moment (arm = moment ÷ weight) since the sheet stores moment
// directly for that row rather than an arm.
//
// Two things worth checking against the real airplane once these are in the
// app:
//   - N8535G's rear-seat arm came through as 0 in the source sheet — that
//     row happened to have 0 rear-passenger weight in the saved example, so
//     there's no way to tell whether that's a real "no rear seat" arm or
//     just never filled in. Fix it in the app if it has a rear seat.
//   - N1686Q's baggage arm (84) differs from every other tail here (95) —
//     kept as-is since that can be a genuine per-airframe difference, but
//     worth a second look.
//
// The sheet's 7th tab ("Weight and Balance") wasn't included — its BEW
// (2660.4 lb) already exceeds the max gross weight the sheet uses for it
// (2550 lb) and its arms (80–140 in) don't match any 172, so it reads as
// leftover template/example data rather than a real tail number.
export const SEED_PROFILES: AircraftProfile[] = [
  {
    id: "seed:c172s",
    name: "C172S",
    weightUnit: "lb",
    bewWeight: 1757.5,
    bewArm: 41.7809,
    frontArm: 37,
    rearArm: 73,
    baggageArm: 95,
    baggageMax: null,
    fuelArm: 48,
    fuelWeightPerGal: 6,
    taxiFuelGal: 1.4,
    maxGrossWeight: 2550,
    vaAtMaxGross: 105,
    envelopePoints: null,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "seed:n8535g",
    name: "N8535G",
    weightUnit: "lb",
    bewWeight: 1071.34,
    bewArm: 32.6121,
    frontArm: 39,
    // See file header — this came through as 0 in the source sheet;
    // double-check against the actual aircraft's W&B data.
    rearArm: 0,
    baggageArm: 95,
    baggageMax: null,
    fuelArm: 42,
    fuelWeightPerGal: 6,
    taxiFuelGal: 1.4,
    maxGrossWeight: 2550,
    vaAtMaxGross: 105,
    envelopePoints: null,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "seed:n1686q",
    name: "N1686Q",
    weightUnit: "lb",
    bewWeight: 1086.41,
    bewArm: 32.9849,
    frontArm: 39,
    rearArm: 64,
    baggageArm: 84,
    baggageMax: null,
    fuelArm: 42.2,
    fuelWeightPerGal: 6,
    taxiFuelGal: 1.2,
    maxGrossWeight: 2550,
    vaAtMaxGross: 105,
    envelopePoints: null,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "seed:81775-172h",
    name: "81775 (172H)",
    weightUnit: "lb",
    bewWeight: 1366.14,
    bewArm: 36.0666,
    frontArm: 36,
    rearArm: 70,
    baggageArm: 95,
    baggageMax: null,
    fuelArm: 48,
    fuelWeightPerGal: 6,
    taxiFuelGal: 1.4,
    maxGrossWeight: 2300,
    vaAtMaxGross: 122,
    envelopePoints: null,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "seed:1622f-172h",
    name: "1622F (172H)",
    weightUnit: "lb",
    bewWeight: 1435.96,
    bewArm: 37.5338,
    frontArm: 36,
    rearArm: 70,
    baggageArm: 95,
    baggageMax: null,
    fuelArm: 48,
    fuelWeightPerGal: 6,
    taxiFuelGal: 1.4,
    maxGrossWeight: 2300,
    vaAtMaxGross: 122,
    envelopePoints: null,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "seed:c172l",
    name: "C172L",
    weightUnit: "lb",
    bewWeight: 1418.27,
    bewArm: 38.8927,
    frontArm: 37,
    rearArm: 73,
    baggageArm: 95,
    baggageMax: null,
    fuelArm: 48,
    fuelWeightPerGal: 6,
    taxiFuelGal: 1.4,
    maxGrossWeight: 2550,
    vaAtMaxGross: 105,
    envelopePoints: null,
    createdAt: 0,
    updatedAt: 0,
  },
];
