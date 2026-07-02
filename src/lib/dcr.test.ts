import { describe, expect, it } from "vitest";

import {
  calculateDCR,
  calculateStaticCR,
  clampIVCABDC,
  effectiveStrokeRatioAtIVC,
  estimateIntakeCenterline,
  estimateIVCABDC,
  PORSCHE_SC_ROD_LENGTH_MM,
  resolveStaticCR,
} from "./dcr";

describe("estimateIntakeCenterline", () => {
  it("ignores overlap lift when nominal is missing", () => {
    expect(estimateIntakeCenterline(102, 4, 4.5, null)).toBe(98);
    expect(estimateIntakeCenterline(102, 4, 4.5, undefined)).toBe(98);
  });

  it("applies overlap lift only when both values are provided", () => {
    expect(estimateIntakeCenterline(102, 4, 4.5, 4.5)).toBe(98);
    expect(estimateIntakeCenterline(102, 4, 4.0, 4.5)).toBe(103);
  });
});

describe("estimateIVCABDC", () => {
  it("uses centerline method for DC 993SS with 2° advance", () => {
    const { ivcABDC } = estimateIVCABDC(242, 114, 2, 248);
    expect(ivcABDC).toBeCloseTo(56, 0);
  });

  it("prefers direct IVC when provided", () => {
    const { ivcABDC, method } = estimateIVCABDC(242, 114, 2, 248, null, null, 55);
    expect(ivcABDC).toBe(55);
    expect(method).toContain("Direct IVC");
  });

  it("labels invalid @ 1 mm duration correctly", () => {
    const invalid = estimateIVCABDC(242, 114, 0, 240);
    expect(invalid.method).toContain("must exceed");

    const equal = estimateIVCABDC(242, 114, 0, 242);
    expect(equal.method).toContain("must exceed");
  });

  it("does not mis-apply overlap without nominal", () => {
    const withoutNominal = estimateIVCABDC(259, 102, 4, 266, 4.5, null);
    const withNominal = estimateIVCABDC(259, 102, 4, 266, 4.5, 4.5);
    expect(withoutNominal.ivcABDC).toBe(withNominal.ivcABDC);
    expect(withoutNominal.ivcABDC).toBeCloseTo(51, 0);
  });
});

describe("clampIVCABDC", () => {
  it("clamps early and late IVC", () => {
    expect(clampIVCABDC(0).ivcABDC).toBe(1);
    expect(clampIVCABDC(-10).ivcABDC).toBe(1);
    expect(clampIVCABDC(200).ivcABDC).toBe(179);
  });

  it("passes through valid IVC", () => {
    expect(clampIVCABDC(56)).toEqual({ ivcABDC: 56 });
  });
});

describe("resolveStaticCR", () => {
  it("uses manual CR when geometry is incomplete", () => {
    expect(
      resolveStaticCR({
        manualStaticCR: 10.2,
        boreMM: 98,
        strokeMM: 70.4,
        deckHeightMM: 1,
        headVolumeCC: null as unknown as number,
      }),
    ).toEqual({ staticCR: 10.2, source: "manual" });
  });

  it("uses geometry when complete", () => {
    const result = resolveStaticCR({
      manualStaticCR: 9,
      boreMM: 98,
      strokeMM: 70.4,
      deckHeightMM: 1,
      headVolumeCC: 50.2,
      pistonCrownVolumeCC: 0,
    });
    expect(result.source).toBe("geometry");
    if (result.source === "geometry") {
      expect(result.staticCR).toBeCloseTo(10.2, 1);
      expect(result.manualStaticCR).toBe(9);
    }
  });

  it("falls back to manual CR on invalid geometry", () => {
    const result = resolveStaticCR({
      manualStaticCR: 10.2,
      boreMM: 98,
      strokeMM: 70.4,
      deckHeightMM: 1,
      headVolumeCC: -100,
    });
    expect(result.source).toBe("manual");
    if (result.source === "manual" && "error" in result) {
      expect(result.error).toContain("Using manual static CR");
    }
  });
});

describe("calculateDCR", () => {
  it("calculates minimal 4-field baseline", () => {
    const result = calculateDCR({
      strokeMM: 70.4,
      staticCR: 10.2,
      intakeDurationAt050: 228,
      lsa: 113,
    });
    expect(result.dcr).toBeCloseTo(8.93, 1);
  });

  it("calculates 3.2SS example with full optional inputs", () => {
    const result = calculateDCR({
      strokeMM: 70.4,
      staticCR: 10.2,
      intakeDurationAt050: 242,
      lsa: 114,
      rodLengthMM: PORSCHE_SC_ROD_LENGTH_MM,
      intakeDurationAt1mm: 248,
      camAdvance: 2,
      overlapLiftMM: 1.7,
      overlapLiftNominalMM: 1.7,
    });

    expect(result.ivcAngleABDC).toBeCloseTo(56, 0);
    expect(result.dcr).toBeCloseTo(8.61, 2);
  });

  it("returns higher DCR with more advance", () => {
    const base = calculateDCR({
      strokeMM: 70.4,
      staticCR: 10.2,
      intakeDurationAt050: 242,
      lsa: 114,
      rodLengthMM: PORSCHE_SC_ROD_LENGTH_MM,
      intakeDurationAt1mm: 248,
      camAdvance: 0,
    });
    const advanced = calculateDCR({
      strokeMM: 70.4,
      staticCR: 10.2,
      intakeDurationAt050: 242,
      lsa: 114,
      rodLengthMM: PORSCHE_SC_ROD_LENGTH_MM,
      intakeDurationAt1mm: 248,
      camAdvance: 4,
    });
    expect(advanced.dcr).toBeGreaterThan(base.dcr);
    expect(advanced.ivcAngleABDC).toBeLessThan(base.ivcAngleABDC);
  });

  it("clamps direct IVC of zero", () => {
    const result = calculateDCR({
      strokeMM: 70.4,
      staticCR: 10.2,
      intakeDurationAt050: 242,
      lsa: 114,
      intakeValveClosingAbdc: 0,
    });
    expect(result.ivcAngleABDC).toBe(1);
    expect(result.warning).toContain("clamped");
    expect(result.dcr).toBeCloseTo(10.2, 1);
  });

  it("uses rod length in slider-crank geometry", () => {
    const shortRod = calculateDCR({
      strokeMM: 70.4,
      staticCR: 10.2,
      intakeDurationAt050: 242,
      lsa: 114,
      rodLengthMM: 112,
      intakeDurationAt1mm: 248,
      camAdvance: 2,
    });
    const longRod = calculateDCR({
      strokeMM: 70.4,
      staticCR: 10.2,
      intakeDurationAt050: 242,
      lsa: 114,
      rodLengthMM: PORSCHE_SC_ROD_LENGTH_MM,
      intakeDurationAt1mm: 248,
      camAdvance: 2,
    });
    expect(shortRod.dcr).not.toBe(longRod.dcr);
  });
});

describe("calculateStaticCR", () => {
  it("computes CR from swept and clearance volumes", () => {
    const cr = calculateStaticCR({
      boreMM: 98,
      strokeMM: 70.4,
      deckHeightMM: 1,
      headVolumeCC: 50.2,
      pistonCrownVolumeCC: 0,
      gasketThicknessMM: 0,
    });
    expect(cr).toBeCloseTo(10.2, 1);
  });

  it("includes gasket thickness in clearance", () => {
    const withoutGasket = calculateStaticCR({
      boreMM: 98,
      strokeMM: 70.4,
      deckHeightMM: 1,
      headVolumeCC: 50.2,
    });
    const withGasket = calculateStaticCR({
      boreMM: 98,
      strokeMM: 70.4,
      deckHeightMM: 1,
      headVolumeCC: 50.2,
      gasketThicknessMM: 1,
    });
    expect(withGasket).toBeLessThan(withoutGasket);
  });
});

describe("effectiveStrokeRatioAtIVC", () => {
  it("returns ~1 at BDC and lower values with later IVC", () => {
    expect(effectiveStrokeRatioAtIVC(70.4, 127.8, 0)).toBeCloseTo(1, 2);
    expect(effectiveStrokeRatioAtIVC(70.4, 127.8, 56)).toBeLessThan(0.9);
  });
});
