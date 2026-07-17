import { describe, expect, it } from "vitest";

import {
  calculateOverallFirstGearRatio,
  drivetrainPresets,
} from "./drivetrain-presets";

describe("drivetrain presets", () => {
  it("includes both 1966 Mustang T5 final-drive options", () => {
    expect(drivetrainPresets.map((preset) => preset.name)).toEqual([
      "’66 Mustang (T5 w/ 2.95 1st, 3.55 rear)",
      "’66 Mustang (T5 w/ 2.95 1st, 3.80 rear)",
    ]);
  });

  it("calculates overall first-gear ratios", () => {
    expect(calculateOverallFirstGearRatio(drivetrainPresets[0])).toBeCloseTo(10.4725, 4);
    expect(calculateOverallFirstGearRatio(drivetrainPresets[1])).toBeCloseTo(11.21, 2);
  });
});
