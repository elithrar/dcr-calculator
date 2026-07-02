/**
 * Dynamic Compression Ratio (DCR) calculations.
 *
 * Minimum inputs (paper data points):
 *   stroke, static CR, intake duration @ 0.050", LSA
 *
 * Optional inputs improve IVC timing and rod geometry accuracy.
 */

export type DCRInputs = {
  strokeMM: number;
  staticCR: number;
  intakeDurationAt050: number;
  lsa: number;
  /** Center-to-center rod length. Estimated from stroke if omitted. */
  rodLengthMM?: number | null;
  /** Seat-to-seat or duration @ 1 mm — refines when the intake actually closes. */
  intakeDurationAt1mm?: number | null;
  /** Installed advance in degrees. Positive = advanced (intake closes earlier). */
  camAdvance?: number | null;
  /** Overlap lift setting from cam card (mm). Refines intake centerline. */
  overlapLiftMM?: number | null;
  /** Nominal overlap lift for the cam profile (mm). Defaults to 1.7 for DC 993SS-style cams. */
  overlapLiftNominalMM?: number | null;
  /** Direct intake valve closing angle ABDC from a cam card — highest accuracy. */
  intakeValveClosingAbdc?: number | null;
};

export type DCRResult = {
  dcr: number;
  effectiveStrokeMM: number;
  effectiveStrokeRatio: number;
  ivcAngleABDC: number;
  staticCR: number;
  rodLengthMM: number;
  ivcMethod: string;
  warning?: string;
};

export type StaticCRInputs = {
  boreMM: number;
  strokeMM: number;
  deckHeightMM: number;
  headVolumeCC: number;
  pistonCrownVolumeCC?: number;
  gasketThicknessMM?: number;
};

const DEFAULT_RAMP_DEGREES = 3;
const OVERLAP_LIFT_DEGREES_PER_MM = 10;

/** Cylinder swept volume in cc. */
export function cylinderSweptVolumeCC(boreMM: number, strokeMM: number): number {
  return (Math.PI * Math.pow(boreMM / 2, 2) * strokeMM) / 1000;
}

/** Flat piston deck clearance volume in cc. */
export function deckVolumeCC(boreMM: number, deckHeightMM: number): number {
  return (Math.PI * Math.pow(boreMM / 2, 2) * deckHeightMM) / 1000;
}

/** Static compression ratio from measured volumes. */
export function calculateStaticCR({
  boreMM,
  strokeMM,
  deckHeightMM,
  headVolumeCC,
  pistonCrownVolumeCC = 0,
  gasketThicknessMM = 0,
}: StaticCRInputs): number {
  const swept = cylinderSweptVolumeCC(boreMM, strokeMM);
  const deck = deckVolumeCC(boreMM, deckHeightMM);
  const gasket = deckVolumeCC(boreMM, gasketThicknessMM);
  const clearance = deck + gasket + headVolumeCC + pistonCrownVolumeCC;
  if (clearance <= 0) {
    throw new Error("Clearance volume must be positive");
  }
  return (swept + clearance) / clearance;
}

/**
 * Estimate intake centerline (degrees ATDC) from LSA, advance, and overlap lift.
 * Positive cam advance moves the intake centerline earlier (smaller ATDC value).
 * Higher overlap lift vs nominal retards the effective centerline.
 */
export function estimateIntakeCenterline(
  lsa: number,
  camAdvance: number,
  overlapLiftMM?: number | null,
  overlapLiftNominalMM?: number | null,
): number {
  let icl = lsa - camAdvance;

  if (overlapLiftMM != null && overlapLiftMM > 0) {
    const nominal = overlapLiftNominalMM ?? 1.7;
    const liftShift = (overlapLiftMM - nominal) * OVERLAP_LIFT_DEGREES_PER_MM;
    icl -= liftShift;
  }

  return icl;
}

/**
 * Estimate intake valve closing ABDC.
 * Priority: direct IVC > duration @ 1 mm > duration @ 0.050" + ramp estimate.
 */
export function estimateIVCABDC(
  intakeDurationAt050: number,
  lsa: number,
  camAdvance = 0,
  intakeDurationAt1mm?: number | null,
  overlapLiftMM?: number | null,
  overlapLiftNominalMM?: number | null,
  intakeValveClosingAbdc?: number | null,
): { ivcABDC: number; method: string } {
  if (intakeValveClosingAbdc != null && Number.isFinite(intakeValveClosingAbdc)) {
    return {
      ivcABDC: intakeValveClosingAbdc,
      method: "Direct IVC from cam card",
    };
  }

  const icl = estimateIntakeCenterline(
    lsa,
    camAdvance,
    overlapLiftMM,
    overlapLiftNominalMM,
  );

  if (intakeDurationAt1mm != null && intakeDurationAt1mm > intakeDurationAt050) {
    const ivc = icl + intakeDurationAt1mm / 2 - 180;
    return {
      ivcABDC: ivc,
      method: "Duration @ 1 mm + centerline",
    };
  }

  const rampDegrees =
    intakeDurationAt1mm != null && intakeDurationAt1mm > intakeDurationAt050
      ? (intakeDurationAt1mm - intakeDurationAt050) / 2
      : DEFAULT_RAMP_DEGREES;

  const ivc = icl + intakeDurationAt050 / 2 - 180 + rampDegrees;
  return {
    ivcABDC: ivc,
    method:
      intakeDurationAt1mm != null
        ? "Duration @ 0.050\" + ramp from @ 1 mm"
        : "Duration @ 0.050\" + default ramp estimate",
  };
}

/**
 * Slider-crank effective stroke ratio at intake valve closing.
 * theta is measured from TDC on the compression/power stroke (180° = BDC).
 */
export function effectiveStrokeRatioAtIVC(
  strokeMM: number,
  rodLengthMM: number,
  ivcABDC: number,
): number {
  const thetaDegrees = 180 + ivcABDC;
  const thetaRadians = (thetaDegrees * Math.PI) / 180;
  const crankRadiusMM = strokeMM / 2;
  const rodRatio = rodLengthMM / crankRadiusMM;
  const cosTheta = Math.cos(thetaRadians);
  const sinTheta = Math.sin(thetaRadians);
  const sqrtTerm = Math.sqrt(Math.max(0, rodRatio * rodRatio - sinTheta * sinTheta));
  const esr = 0.5 * (1 - cosTheta + rodRatio - sqrtTerm);
  return Math.max(0, Math.min(esr, 1));
}

/** Default rod length estimate when not provided (Porsche air-cooled ~1.82:1 rod/stroke). */
export function estimateRodLengthMM(strokeMM: number): number {
  return strokeMM * 1.815;
}

/** Porsche SC / 3.2 short-block rod length (127.8 mm C-C). */
export const PORSCHE_SC_ROD_LENGTH_MM = 127.8;

export function calculateDCR(inputs: DCRInputs): DCRResult {
  const {
    strokeMM,
    staticCR,
    intakeDurationAt050,
    lsa,
    rodLengthMM,
    intakeDurationAt1mm,
    camAdvance,
    overlapLiftMM,
    overlapLiftNominalMM,
    intakeValveClosingAbdc,
  } = inputs;

  const actualRodLengthMM =
    rodLengthMM != null && rodLengthMM > 0 ? rodLengthMM : estimateRodLengthMM(strokeMM);
  const actualCamAdvance = camAdvance ?? 0;

  const { ivcABDC: rawIVC, method: ivcMethod } = estimateIVCABDC(
    intakeDurationAt050,
    lsa,
    actualCamAdvance,
    intakeDurationAt1mm,
    overlapLiftMM,
    overlapLiftNominalMM,
    intakeValveClosingAbdc,
  );

  let warning: string | undefined;
  let ivcAngleABDC = rawIVC;

  if (ivcAngleABDC <= 0) {
    warning = `IVC ${ivcAngleABDC.toFixed(1)}° ABDC is before BDC (intake closes early). DCR may exceed static CR.`;
  } else if (ivcAngleABDC >= 180) {
    warning = `IVC ${ivcAngleABDC.toFixed(1)}° ABDC is very late. Check cam timing inputs.`;
    ivcAngleABDC = 179;
  }

  const clampedESR = effectiveStrokeRatioAtIVC(strokeMM, actualRodLengthMM, ivcAngleABDC);
  const effectiveStrokeMM = strokeMM * clampedESR;
  const dcr = 1 + clampedESR * (staticCR - 1);

  return {
    dcr: parseFloat(dcr.toFixed(2)),
    effectiveStrokeMM: parseFloat(effectiveStrokeMM.toFixed(1)),
    effectiveStrokeRatio: parseFloat(clampedESR.toFixed(4)),
    ivcAngleABDC: parseFloat(ivcAngleABDC.toFixed(1)),
    staticCR,
    rodLengthMM: actualRodLengthMM,
    ivcMethod,
    warning,
  };
}
