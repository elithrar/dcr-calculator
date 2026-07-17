import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateOverallFirstGearRatio,
  drivetrainPresets,
  type DrivetrainPreset,
} from "@/lib/drivetrain-presets";

export function DrivetrainPresets() {
  const [selectedPreset, setSelectedPreset] = useState<DrivetrainPreset | null>(null);

  const handlePresetChange = (value: string) => {
    setSelectedPreset(drivetrainPresets.find((preset) => preset.name === value) ?? null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-lg">Drivetrain Presets</CardTitle>
        <CardDescription className="text-center text-xs">
          Saved reference gearing for the 1966 Mustang build.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select onValueChange={handlePresetChange}>
          <SelectTrigger className="w-full font-mono bg-muted">
            <SelectValue placeholder="Drivetrain preset…" />
          </SelectTrigger>
          <SelectContent className="font-mono">
            {drivetrainPresets.map((preset) => (
              <SelectItem key={preset.name} value={preset.name}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedPreset && (
          <div className="grid gap-2 border-2 border-border bg-secondary p-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Transmission</p>
              <p className="font-semibold">{selectedPreset.transmission}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">First gear</p>
              <p className="font-semibold">{selectedPreset.firstGearRatio.toFixed(2)}:1</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rear ratio</p>
              <p className="font-semibold">{selectedPreset.finalDriveRatio.toFixed(2)}:1</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overall first</p>
              <p className="font-semibold">
                {calculateOverallFirstGearRatio(selectedPreset).toFixed(2)}:1
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
