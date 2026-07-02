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
  /** Overlap lift setting when degreeing cams (mm). Requires nominal to apply. */
  overlapLiftMM?: number | null;
  /** Nominal overlap lift from cam card (mm). Required with overlapLiftMM. */
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

export type StaticCRResolveInput = StaticCRInputs & {
  manualStaticCR: number;
};

export type StaticCRResolveResult =
  | { staticCR: number; source: "manual" }
  | { staticCR: number; source: "geometry"; computedCR: number; manualStaticCR: number }
  | { staticCR: number; source: "manual"; error: string };

const DEFAULT_RAMP_DEGREES = 3;
const OVERLAP_LIFT_DEGREES_PER_MM = 10;
const MIN_IVC_ABDC = 1;
const MAX_IVC_ABDC = 179;

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

export function hasGeometryForStaticCR(
  boreMM?: number | null,
  deckHeightMM?: number | null,
  headVolumeCC?: number | null,
): boolean {
  return (
    boreMM != null &&
    boreMM > 0 &&
    deckHeightMM != null &&
    deckHeightMM >= 0 &&
    headVolumeCC != null &&
    headVolumeCC > 0
  );
}

/** Resolve static CR from geometry when complete, otherwise use manual entry. */
export function resolveStaticCR(input: StaticCRResolveInput): StaticCRResolveResult {
  const { manualStaticCR, ...geometry } = input;

  if (!hasGeometryForStaticCR(geometry.boreMM, geometry.deckHeightMM, geometry.headVolumeCC)) {
    return { staticCR: manualStaticCR, source: "manual" };
  }

  try {
    const computedCR = calculateStaticCR(geometry);
    const rounded = parseFloat(computedCR.toFixed(2));
    return {
      staticCR: rounded,
      source: "geometry",
      computedCR: rounded,
      manualStaticCR,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid geometry inputs";
    return {
      staticCR: manualStaticCR,
      source: "manual",
      error: `${message}. Using manual static CR.`,
    };
  }
}

/**
 * Estimate intake centerline (degrees ATDC) from LSA, advance, and overlap lift.
 * Positive cam advance moves the intake centerline earlier (smaller ATDC value).
 * Overlap lift adjustment only applies when both actual and nominal lift are provided.
 */
export function estimateIntakeCenterline(
  lsa: number,
  camAdvance: number,
  overlapLiftMM?: number | null,
  overlapLiftNominalMM?: number | null,
): number {
  let icl = lsa - camAdvance;

  if (
    overlapLiftMM != null &&
    overlapLiftMM > 0 &&
    overlapLiftNominalMM != null &&
    overlapLiftNominalMM > 0
  ) {
    const liftShift = (overlapLiftMM - overlapLiftNominalMM) * OVERLAP_LIFT_DEGREES_PER_MM;
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

  const hasValidDurationAt1mm =
    intakeDurationAt1mm != null && intakeDurationAt1mm > intakeDurationAt050;

  if (hasValidDurationAt1mm) {
    const ivc = icl + intakeDurationAt1mm / 2 - 180;
    return {
      ivcABDC: ivc,
      method: "Duration @ 1 mm + centerline",
    };
  }

  const rampDegrees = DEFAULT_RAMP_DEGREES;
  const ivc = icl + intakeDurationAt050 / 2 - 180 + rampDegrees;

  const method =
    intakeDurationAt1mm != null
      ? "Duration @ 0.050\" + default ramp (@ 1 mm must exceed @ 0.050\")"
      : "Duration @ 0.050\" + default ramp estimate";

  return { ivcABDC: ivc, method };
}

/**
 * Clamp IVC to a calculable range and return any warning.
 */
export function clampIVCABDC(ivcABDC: number): { ivcABDC: number; warning?: string } {
  if (ivcABDC <= 0) {
    return {
      ivcABDC: MIN_IVC_ABDC,
      warning: `IVC ${ivcABDC.toFixed(1)}° ABDC is before BDC and was clamped to ${MIN_IVC_ABDC}°.`,
    };
  }
  if (ivcABDC >= 180) {
    return {
      ivcABDC: MAX_IVC_ABDC,
      warning: `IVC ${ivcABDC.toFixed(1)}° ABDC is very late and was clamped to ${MAX_IVC_ABDC}°.`,
    };
  }
  if (ivcABDC < MIN_IVC_ABDC) {
    return {
      ivcABDC: MIN_IVC_ABDC,
      warning: `IVC ${ivcABDC.toFixed(1)}° ABDC was clamped to ${MIN_IVC_ABDC}°.`,
    };
  }
  return { ivcABDC };
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

/** Default rod length estimate when not provided (Porsche air-cooled ~1.815:1 rod/stroke). */
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

  const { ivcABDC, warning } = clampIVCABDC(rawIVC);

  const clampedESR = effectiveStrokeRatioAtIVC(strokeMM, actualRodLengthMM, ivcABDC);
  const effectiveStrokeMM = strokeMM * clampedESR;
  const dcr = 1 + clampedESR * (staticCR - 1);

  return {
    dcr: parseFloat(dcr.toFixed(2)),
    effectiveStrokeMM: parseFloat(effectiveStrokeMM.toFixed(1)),
    effectiveStrokeRatio: parseFloat(clampedESR.toFixed(4)),
    ivcAngleABDC: parseFloat(ivcABDC.toFixed(1)),
    staticCR,
    rodLengthMM: actualRodLengthMM,
    ivcMethod,
    warning,
  };
}
