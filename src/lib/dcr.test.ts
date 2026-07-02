import { describe, expect, it } from "vitest";

import {
  calculateDCR,
  calculateStaticCR,
  effectiveStrokeRatioAtIVC,
  estimateIVCABDC,
  PORSCHE_SC_ROD_LENGTH_MM,
} from "./dcr";

describe("estimateIVCABDC", () => {
  it("uses centerline method for DC 993SS with 2° advance", () => {
    const { ivcABDC } = estimateIVCABDC(242, 114, 2, 248);
    // ICL = 112, IVC = 112 + 124 - 180 = 56
    expect(ivcABDC).toBeCloseTo(56, 0);
  });

  it("prefers direct IVC when provided", () => {
    const { ivcABDC, method } = estimateIVCABDC(242, 114, 2, 248, null, null, 55);
    expect(ivcABDC).toBe(55);
    expect(method).toContain("Direct IVC");
  });
});

describe("calculateDCR", () => {
  it("calculates 3.2SS example: 98mm bore SC block, DC 993SS, 1.7mm overlap, 2° advance", () => {
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
    expect(result.dcr).toBeGreaterThan(8);
    expect(result.dcr).toBeLessThan(9);
    expect(result.dcr).toBeCloseTo(8.61, 1);
  });

  it("returns higher DCR with shorter IVC (more advance)", () => {
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
    });
    expect(cr).toBeCloseTo(10.2, 1);
  });
});

describe("effectiveStrokeRatioAtIVC", () => {
  it("returns ~1 at BDC and lower values with later IVC", () => {
    expect(effectiveStrokeRatioAtIVC(70.4, 127.8, 0)).toBeCloseTo(1, 2);
    expect(effectiveStrokeRatioAtIVC(70.4, 127.8, 56)).toBeLessThan(0.9);
  });
});
