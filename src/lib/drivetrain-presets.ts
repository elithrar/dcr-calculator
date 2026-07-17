export type DrivetrainPreset = {
  name: string;
  transmission: string;
  firstGearRatio: number;
  finalDriveRatio: number;
};

export const drivetrainPresets: DrivetrainPreset[] = [
  {
    name: "’66 Mustang (T5 w/ 2.95 1st, 3.55 rear)",
    transmission: "T5",
    firstGearRatio: 2.95,
    finalDriveRatio: 3.55,
  },
  {
    name: "’66 Mustang (T5 w/ 2.95 1st, 3.80 rear)",
    transmission: "T5",
    firstGearRatio: 2.95,
    finalDriveRatio: 3.8,
  },
];

export function calculateOverallFirstGearRatio(preset: DrivetrainPreset): number {
  return preset.firstGearRatio * preset.finalDriveRatio;
}
