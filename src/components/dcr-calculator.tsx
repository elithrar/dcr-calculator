import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Cam presets - duration @ 0.050", LSA, advertised duration (if known), typical advance
type CamPreset = {
  name: string;
  intakeDuration: number; // Duration @ 0.050"
  lsa: number;
  advertisedIntakeDuration?: number;
  camAdvance?: number; // Typical installed advance (positive = advanced)
};

const camPresets: CamPreset[] = [
  { name: "911 2.7 (stock)", intakeDuration: 218, lsa: 115, camAdvance: 0 },
  { name: "911 SC / 3.2 (stock)", intakeDuration: 220, lsa: 115, camAdvance: 0 },
  { name: "DC 15 (Sport SC)", intakeDuration: 228, lsa: 114, camAdvance: 4 },
  { name: "DC 30 (Mod Solex)", intakeDuration: 236, lsa: 114, camAdvance: 4 },
  { name: "DC 40 (Mod S)", intakeDuration: 242, lsa: 114, camAdvance: 4 },
  { name: "DC 43-113", intakeDuration: 243, lsa: 113, camAdvance: 2 },
  { name: "DC 60", intakeDuration: 252, lsa: 114, camAdvance: 0 },
  { name: "DC 993SS", intakeDuration: 242, lsa: 114, camAdvance: 4 },
  { name: "WebCam 20/21", intakeDuration: 238, lsa: 112, advertisedIntakeDuration: 258, camAdvance: 4 },
  { name: "WebCam 993SS", intakeDuration: 240, lsa: 112, advertisedIntakeDuration: 260, camAdvance: 4 },
];

function formatPresetTooltip(preset: CamPreset): string {
  let text = `${preset.intakeDuration}° @ 0.050" | ${preset.lsa}° LSA`;
  if (preset.advertisedIntakeDuration) {
    text += ` | ${preset.advertisedIntakeDuration}° adv.`;
  }
  if (preset.camAdvance !== undefined) {
    text += ` | ${preset.camAdvance}° advance`;
  }
  return text;
}

// Form schema validation
const calculatorFormSchema = z.object({
  stroke: z.number().positive("Stroke must be positive"),
  staticCR: z
    .number()
    .positive("Static CR must be positive"),
  intakeDuration: z
    .number()
    .positive('Duration @ 0.050" must be positive'), // Duration @ 0.050"
  lsa: z.number().positive("LSA must be positive"),
  rodLength: z
    .number()
    .positive("Rod length must be positive")
    .nullable(),
  advertisedIntakeDuration: z
    .number()
    .positive("Advertised duration must be positive")
    .nullable(), // Optional seat-to-seat duration
  camAdvance: z
    .number()
    .nullable(), // Cam advance in degrees (positive = advanced, negative = retarded)
  intakeValveClosingAbdc: z
    .number()
    .positive("IVC must be positive")
    .nullable(), // Optional direct intake valve closing angle ABDC
});

type CalculatorFormValues = z.infer<typeof calculatorFormSchema>;

// Default values
const defaultValues: CalculatorFormValues = {
  stroke: 70.4,
  staticCR: 10.2,
  intakeDuration: 242, // Duration @ 0.050"
  lsa: 114,
  rodLength: null,
  advertisedIntakeDuration: null, // Seat-to-seat duration
  camAdvance: null, // Cam advance in degrees
  intakeValveClosingAbdc: null, // Direct IVC ABDC from cam card
};

type DCRResult = {
  dcr: number;
  effectiveStrokeMM: number;
  ivcAngleABDC: number;
  warning?: string;
};

function calculateDCR(
  strokeMM: number,
  staticCR: number,
  intakeDurationAt050: number,
  lsa: number,
  rodLengthMM: number | null | undefined,
  advertisedIntakeDuration: number | null | undefined,
  camAdvance: number | null | undefined,
  intakeValveClosingAbdc: number | null | undefined,
): DCRResult {
  const actualRodLengthMM =
    rodLengthMM && rodLengthMM > 0 ? rodLengthMM : strokeMM * 1.7;
  const actualCamAdvance = camAdvance ?? 0;

  // Determine ramp degrees from advertised duration or use a typical default
  const rampDegrees =
    advertisedIntakeDuration && advertisedIntakeDuration > intakeDurationAt050
      ? (advertisedIntakeDuration - intakeDurationAt050) / 2
      : 20;

  // Direct IVC from a cam card is usually more accurate than estimating it from duration and LSA.
  let ivcAngleABDC = intakeValveClosingAbdc && intakeValveClosingAbdc > 0
    ? intakeValveClosingAbdc
    : intakeDurationAt050 / 2 + lsa - 180 + rampDegrees - actualCamAdvance;

  let warning: string | undefined;
  const clampedIvcAngleABDC = Math.max(1, Math.min(ivcAngleABDC, 179));
  if (clampedIvcAngleABDC !== ivcAngleABDC) {
    warning = `IVC angle ${ivcAngleABDC.toFixed(1)}° was outside expected range (1-179°) and clamped. Check inputs.`;
    ivcAngleABDC = clampedIvcAngleABDC;
  }

  const thetaDegrees = 180 + ivcAngleABDC;
  const thetaRadians = (thetaDegrees * Math.PI) / 180;
  const crankRadiusMM = strokeMM / 2;
  const R = actualRodLengthMM / crankRadiusMM;
  const cosTheta = Math.cos(thetaRadians);
  const sinTheta = Math.sin(thetaRadians);
  const sqrtTerm = Math.sqrt(Math.max(0, R * R - sinTheta * sinTheta));
  const effectiveStrokeRatio = 0.5 * (1 - cosTheta + R - sqrtTerm);
  const clampedESR = Math.max(0, Math.min(effectiveStrokeRatio, 1));
  const effectiveStrokeMM = strokeMM * clampedESR;
  const dcr = 1 + clampedESR * (staticCR - 1);

  return {
    dcr: parseFloat(dcr.toFixed(2)),
    effectiveStrokeMM: parseFloat(effectiveStrokeMM.toFixed(1)),
    ivcAngleABDC: parseFloat(ivcAngleABDC.toFixed(1)),
    warning,
  };
}

export function DCRCalculator() {
  const [dcrResult, setDCRResult] = useState<DCRResult | null>(null);
  const [calculationDetails, setCalculationDetails] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<CamPreset | null>(null);

  const form = useForm<CalculatorFormValues>({
    resolver: zodResolver(calculatorFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const onSubmit = (data: CalculatorFormValues) => {
    const ivcMethod = data.intakeValveClosingAbdc && data.intakeValveClosingAbdc > 0
      ? "Using direct IVC"
      : data.advertisedIntakeDuration && data.advertisedIntakeDuration > data.intakeDuration
        ? "Using Advertised Duration"
        : "Using default ramp estimate";

    const rodMethod =
      data.rodLength === null || data.rodLength <= 0 ? "(Rod length estimated)" : "";

    const result = calculateDCR(
      data.stroke,
      data.staticCR,
      data.intakeDuration,
      data.lsa,
      data.rodLength,
      data.advertisedIntakeDuration,
      data.camAdvance,
      data.intakeValveClosingAbdc,
    );

    setDCRResult(result);
    setCalculationDetails(
      [
        ivcMethod,
        rodMethod,
        `IVC ${result.ivcAngleABDC}° ABDC`,
        `Effective stroke ${result.effectiveStrokeMM} mm`,
      ].filter(Boolean).join(" | "),
    );
  };

  const handleReset = () => {
    form.reset(defaultValues);
    setDCRResult(null);
    setCalculationDetails("");
    setSelectedPreset(null);
  };

  const handlePresetChange = (value: string) => {
    const preset = camPresets.find((p) => p.name === value);
    if (preset) {
      setSelectedPreset(preset);
      form.setValue("intakeDuration", preset.intakeDuration);
      form.setValue("lsa", preset.lsa);
      if (preset.advertisedIntakeDuration) {
        form.setValue("advertisedIntakeDuration", preset.advertisedIntakeDuration);
      } else {
        form.setValue("advertisedIntakeDuration", null);
      }
      if (preset.camAdvance !== undefined) {
        form.setValue("camAdvance", preset.camAdvance);
      } else {
        form.setValue("camAdvance", null);
      }
      form.setValue("intakeValveClosingAbdc", null);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardDescription className="text-xs text-center">
          Direct IVC is best if your cam card lists it. Otherwise, advertised
          duration and cam advance improve the estimate. Rod length is estimated if blank.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-x-6 sm:[grid-auto-rows:auto]">
              <FormField
                control={form.control}
                name="stroke"
                render={({ field: { onChange, ...fieldProps } }) => (
                  <FormItem className="grid grid-rows-[2.5rem_auto] gap-1 content-start">
                    <FormLabel className="self-end">Stroke (mm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        onChange={e => onChange(Number(e.target.value))}
                        {...fieldProps}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="staticCR"
                render={({ field: { onChange, ...fieldProps } }) => (
                  <FormItem className="grid grid-rows-[2.5rem_auto] gap-1 content-start">
                    <FormLabel className="self-end">Static CR (e.g. 10.2)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        onChange={e => onChange(Number(e.target.value))}
                        {...fieldProps}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="intakeDuration"
                render={({ field: { onChange, ...fieldProps } }) => (
                  <FormItem className="grid grid-rows-[2.5rem_auto] gap-1 content-start">
                    <FormLabel className="self-end">Intake Duration @ 0.050" (deg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        onChange={e => onChange(Number(e.target.value))}
                        {...fieldProps}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lsa"
                render={({ field: { onChange, ...fieldProps } }) => (
                  <FormItem className="grid grid-rows-[2.5rem_auto] gap-1 content-start">
                    <FormLabel className="self-end">Lobe Separation Angle (deg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        onChange={e => onChange(Number(e.target.value))}
                        {...fieldProps}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rodLength"
                render={({ field: { value, onChange, ...fieldProps } }) => (
                  <FormItem className="grid grid-rows-[2.5rem_auto_auto] gap-1 content-start">
                    <FormLabel className="self-end">Rod Length (mm, optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Estimated if blank"
                        value={value === null ? "" : value}
                        onChange={e => {
                          const value = e.target.value === "" ? null : Number(e.target.value);
                          onChange(value);
                        }}
                        {...fieldProps}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Will be estimated if not provided</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="advertisedIntakeDuration"
                render={({ field: { value, onChange, ...fieldProps } }) => (
                  <FormItem className="grid grid-rows-[2.5rem_auto_auto] gap-1 content-start">
                    <FormLabel className="self-end">Advertised Duration (deg, optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Seat-to-seat"
                        value={value === null ? "" : value}
                        onChange={e => {
                          const value = e.target.value === "" ? null : Number(e.target.value);
                          onChange(value);
                        }}
                        {...fieldProps}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Seat-to-seat duration for better accuracy</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="camAdvance"
                render={({ field: { value, onChange, ...fieldProps } }) => (
                  <FormItem className="grid grid-rows-[2.5rem_auto_auto] gap-1 content-start">
                    <FormLabel className="self-end">Cam Advance (deg, optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="0 (default)"
                        value={value === null ? "" : value}
                        onChange={e => {
                          const value = e.target.value === "" ? null : Number(e.target.value);
                          onChange(value);
                        }}
                        {...fieldProps}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Typically 2-4° for street cams. Positive = advanced.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="intakeValveClosingAbdc"
                render={({ field: { value, onChange, ...fieldProps } }) => (
                  <FormItem className="grid grid-rows-[2.5rem_auto_auto] gap-1 content-start">
                    <FormLabel className="self-end">IVC ABDC (deg, optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="Overrides estimate"
                        value={value === null ? "" : value}
                        onChange={e => {
                          const value = e.target.value === "" ? null : Number(e.target.value);
                          onChange(value);
                        }}
                        {...fieldProps}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Use seat/advertised intake closing from a cam card</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex space-x-2">
                <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">Calculate</Button>
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
              <TooltipProvider>
                <Select onValueChange={handlePresetChange}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectTrigger 
                        className="w-full sm:w-[250px] font-mono bg-muted"
                      >
                        <SelectValue placeholder="Select a cam preset..." />
                      </SelectTrigger>
                    </TooltipTrigger>
                    {selectedPreset && (
                      <TooltipContent className="font-mono">
                        {formatPresetTooltip(selectedPreset)}
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <SelectContent className="font-mono">
                    {camPresets.map((preset) => (
                      <Tooltip key={preset.name}>
                        <TooltipTrigger asChild>
                          <SelectItem value={preset.name}>
                            {preset.name}
                          </SelectItem>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="font-mono">
                          {formatPresetTooltip(preset)}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </SelectContent>
                </Select>
              </TooltipProvider>
            </div>
          </form>
        </Form>

        {dcrResult !== null && (
          <div className="mt-6 p-4 border-2 border-border bg-secondary shadow-md">
            <h3 className="text-lg font-semibold mb-2">Result:</h3>
            <p className="text-2xl font-bold">{dcrResult.dcr}:1</p>
            <p className="text-sm text-muted-foreground mt-1">{calculationDetails}</p>
            {dcrResult.warning && (
              <p className="text-sm text-destructive mt-2">{dcrResult.warning}</p>
            )}
          </div>
        )}

        <footer className="mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
          Built by{" "}
          <a
            href="http://twitter.com/elithrar"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Matt Silverlock
          </a>
          {" | "}
          <a
            href="https://ratio.questionable.services/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            ratio
          </a>
          {" "}gearset calculator
        </footer>
      </CardContent>
    </Card>
  );
}
