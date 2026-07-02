import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  calculateDCR,
  PORSCHE_SC_ROD_LENGTH_MM,
  resolveStaticCR,
  type DCRResult,
} from "@/lib/dcr";
import { parseOptionalNumber, parseRequiredNumber } from "@/lib/form-numbers";

type CamPreset = {
  name: string;
  intakeDuration: number;
  lsa: number;
  intakeDurationAt1mm?: number;
  overlapLiftNominal?: number;
  camAdvance?: number;
};

type EnginePreset = {
  name: string;
  stroke: number;
  bore?: number;
  staticCR: number;
  rodLength?: number;
  deckHeight?: number;
};

const camPresets: CamPreset[] = [
  { name: "911 2.7 (stock)", intakeDuration: 218, lsa: 115, intakeDurationAt1mm: 226, camAdvance: 0 },
  { name: "911 SC / 3.2 (stock)", intakeDuration: 228, lsa: 113, intakeDurationAt1mm: 236, overlapLiftNominal: 1.55, camAdvance: 0 },
  { name: "DC 15 (Sport SC)", intakeDuration: 238, lsa: 113, intakeDurationAt1mm: 244, overlapLiftNominal: 1.9, camAdvance: 4 },
  { name: "DC 30 (Mod Solex)", intakeDuration: 242, lsa: 102, intakeDurationAt1mm: 248, overlapLiftNominal: 3.8, camAdvance: 4 },
  { name: "DC 40 (Mod S)", intakeDuration: 259, lsa: 102, intakeDurationAt1mm: 266, overlapLiftNominal: 4.5, camAdvance: 4 },
  { name: "DC 43-113", intakeDuration: 258, lsa: 112, intakeDurationAt1mm: 264, overlapLiftNominal: 3.0, camAdvance: 2 },
  { name: "DC 60", intakeDuration: 264, lsa: 102, intakeDurationAt1mm: 271, overlapLiftNominal: 5.0, camAdvance: 0 },
  { name: "DC 993SS", intakeDuration: 242, lsa: 114, intakeDurationAt1mm: 248, overlapLiftNominal: 1.7, camAdvance: 2 },
  { name: "WebCam 20/21", intakeDuration: 238, lsa: 112, intakeDurationAt1mm: 258, overlapLiftNominal: 2.0, camAdvance: 4 },
  { name: "WebCam 993SS", intakeDuration: 240, lsa: 112, intakeDurationAt1mm: 260, overlapLiftNominal: 1.7, camAdvance: 4 },
];

const enginePresets: EnginePreset[] = [
  {
    name: "3.2SS — 98 mm / SC short block",
    stroke: 70.4,
    bore: 98,
    staticCR: 10.2,
    rodLength: PORSCHE_SC_ROD_LENGTH_MM,
    deckHeight: 1,
  },
  {
    name: "911 SC 3.0 (stock)",
    stroke: 70.4,
    bore: 95,
    staticCR: 9.0,
    rodLength: PORSCHE_SC_ROD_LENGTH_MM,
    deckHeight: 1,
  },
  {
    name: "911 3.2 Carrera (stock)",
    stroke: 74.4,
    bore: 95,
    staticCR: 10.3,
    rodLength: 127,
    deckHeight: 1,
  },
];

const alignedFormGridClass = "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6";

const alignedFormItemClass = "row-span-4 grid grid-rows-subgrid gap-2";

function FieldHelp({ children }: { children?: ReactNode }) {
  if (!children) {
    return <div aria-hidden="true" />;
  }

  return <FormDescription className="text-xs">{children}</FormDescription>;
}

function FieldErrorSlot() {
  return (
    <div>
      <FormMessage />
    </div>
  );
}

function formatCamPresetTooltip(preset: CamPreset): string {
  let text = `${preset.intakeDuration}° @ 0.050" | ${preset.lsa}° LSA`;
  if (preset.intakeDurationAt1mm) {
    text += ` | ${preset.intakeDurationAt1mm}° @ 1 mm`;
  }
  if (preset.overlapLiftNominal) {
    text += ` | ${preset.overlapLiftNominal} mm overlap`;
  }
  if (preset.camAdvance !== undefined) {
    text += ` | ${preset.camAdvance}° advance`;
  }
  return text;
}

const requiredPositive = z
  .number()
  .refine((value) => Number.isFinite(value), "Enter a valid number")
  .refine((value) => value > 0, "Must be positive");

const optionalNumber = z
  .number()
  .nullable()
  .refine((value) => value === null || value > 0, "Must be positive");

const calculatorFormSchema = z.object({
  stroke: requiredPositive,
  staticCR: requiredPositive,
  intakeDuration: requiredPositive,
  lsa: requiredPositive,
  rodLength: optionalNumber,
  intakeDurationAt1mm: optionalNumber,
  camAdvance: z
    .number()
    .nullable()
    .refine((value) => value === null || Number.isFinite(value), "Enter a valid number"),
  overlapLiftMM: optionalNumber,
  overlapLiftNominalMM: optionalNumber,
  intakeValveClosingAbdc: z
    .number()
    .nullable()
    .refine((value) => value === null || Number.isFinite(value), "Enter a valid number"),
  bore: optionalNumber,
  deckHeight: z
    .number()
    .nullable()
    .refine((value) => value === null || value >= 0, "Must be zero or positive"),
  headVolumeCC: optionalNumber,
  pistonCrownVolumeCC: z
    .number()
    .nullable()
    .refine((value) => value === null || Number.isFinite(value), "Enter a valid number"),
  gasketThicknessMM: z
    .number()
    .nullable()
    .refine((value) => value === null || value >= 0, "Must be zero or positive"),
});

type CalculatorFormValues = z.infer<typeof calculatorFormSchema>;

const defaultValues: CalculatorFormValues = {
  stroke: 70.4,
  staticCR: 9.0,
  intakeDuration: 228,
  lsa: 113,
  rodLength: null,
  intakeDurationAt1mm: null,
  camAdvance: null,
  overlapLiftMM: null,
  overlapLiftNominalMM: null,
  intakeValveClosingAbdc: null,
  bore: null,
  deckHeight: null,
  headVolumeCC: null,
  pistonCrownVolumeCC: null,
  gasketThicknessMM: null,
};

function OptionalNumberInput({
  value,
  onChange,
  placeholder,
  step = "0.1",
  ...props
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  step?: string;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <Input
      type="number"
      step={step}
      placeholder={placeholder}
      value={value === null ? "" : value}
      onChange={(e) => {
        onChange(parseOptionalNumber(e.target.value));
      }}
      {...props}
    />
  );
}

function RequiredNumberInput({
  value,
  onChange,
  step = "0.1",
  ...props
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step?: string;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  return (
    <Input
      type="number"
      step={step}
      value={value ?? ""}
      onChange={(e) => {
        onChange(parseRequiredNumber(e.target.value));
      }}
      {...props}
    />
  );
}

export function DCRCalculator() {
  const [dcrResult, setDCRResult] = useState<DCRResult | null>(null);
  const [calculationDetails, setCalculationDetails] = useState<string>("");
  const [staticCRNote, setStaticCRNote] = useState<string>("");
  const [selectedCamPreset, setSelectedCamPreset] = useState<CamPreset | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  const form = useForm<CalculatorFormValues>({
    resolver: zodResolver(calculatorFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const onSubmit = (data: CalculatorFormValues) => {
    const staticCRResult = resolveStaticCR({
      manualStaticCR: data.staticCR,
      boreMM: data.bore ?? 0,
      strokeMM: data.stroke,
      deckHeightMM: data.deckHeight ?? 0,
      headVolumeCC: data.headVolumeCC ?? 0,
      pistonCrownVolumeCC: data.pistonCrownVolumeCC ?? 0,
      gasketThicknessMM: data.gasketThicknessMM ?? 0,
    });

    if (staticCRResult.source === "geometry") {
      form.setValue("staticCR", staticCRResult.staticCR);
      setStaticCRNote(
        `Using static CR ${staticCRResult.staticCR}:1 computed from geometry (manual entry was ${staticCRResult.manualStaticCR}:1).`,
      );
    } else if ("error" in staticCRResult && staticCRResult.error) {
      setStaticCRNote(staticCRResult.error);
    } else {
      setStaticCRNote("");
    }

    const staticCR = staticCRResult.staticCR;
    const rodEstimated = data.rodLength == null || data.rodLength <= 0;

    const result = calculateDCR({
      strokeMM: data.stroke,
      staticCR,
      intakeDurationAt050: data.intakeDuration,
      lsa: data.lsa,
      rodLengthMM: data.rodLength,
      intakeDurationAt1mm: data.intakeDurationAt1mm,
      camAdvance: data.camAdvance,
      overlapLiftMM: data.overlapLiftMM,
      overlapLiftNominalMM: data.overlapLiftNominalMM,
      intakeValveClosingAbdc: data.intakeValveClosingAbdc,
    });

    setDCRResult(result);
    setCalculationDetails(
      [
        result.ivcMethod,
        rodEstimated ? "Rod length estimated" : `Rod ${result.rodLengthMM.toFixed(1)} mm`,
        `IVC ${result.ivcAngleABDC}° ABDC`,
        `Effective stroke ${result.effectiveStrokeMM} mm (${(result.effectiveStrokeRatio * 100).toFixed(1)}%)`,
      ].join(" · "),
    );
  };

  const handleReset = () => {
    form.reset(defaultValues);
    setDCRResult(null);
    setCalculationDetails("");
    setStaticCRNote("");
    setSelectedCamPreset(null);
    setShowOptional(false);
  };

  const handleCamPresetChange = (value: string) => {
    const preset = camPresets.find((p) => p.name === value);
    if (!preset) return;

    setSelectedCamPreset(preset);
    form.setValue("intakeDuration", preset.intakeDuration);
    form.setValue("lsa", preset.lsa);
    form.setValue("intakeDurationAt1mm", preset.intakeDurationAt1mm ?? null);
    form.setValue("overlapLiftNominalMM", preset.overlapLiftNominal ?? null);
    form.setValue("overlapLiftMM", preset.overlapLiftNominal ?? null);
    form.setValue("camAdvance", preset.camAdvance ?? null);
    form.setValue("intakeValveClosingAbdc", null);
  };

  const handleEnginePresetChange = (value: string) => {
    const preset = enginePresets.find((p) => p.name === value);
    if (!preset) return;

    form.setValue("stroke", preset.stroke);
    form.setValue("staticCR", preset.staticCR);
    form.setValue("rodLength", preset.rodLength ?? null);
    form.setValue("bore", preset.bore ?? null);
    form.setValue("deckHeight", preset.deckHeight ?? null);
  };

  const quickExample = useMemo(
    () =>
      calculateDCR({
        strokeMM: 70.4,
        staticCR: 10.2,
        intakeDurationAt050: 242,
        lsa: 114,
        rodLengthMM: PORSCHE_SC_ROD_LENGTH_MM,
        intakeDurationAt1mm: 248,
        camAdvance: 2,
        overlapLiftMM: 1.7,
        overlapLiftNominalMM: 1.7,
      }),
    [],
  );

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-lg">Dynamic Compression Ratio</CardTitle>
        <CardDescription className="text-xs text-center space-y-1">
          <span className="block">
            Four paper data points get you close: <strong>stroke</strong>,{" "}
            <strong>static CR</strong>, <strong>duration @ 0.050&quot;</strong>, and{" "}
            <strong>LSA</strong>.
          </span>
          <span className="block">
            Optional fields refine IVC timing and rod geometry. Direct IVC ABDC from a cam card is best.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select onValueChange={handleEnginePresetChange}>
                <SelectTrigger className="w-full sm:flex-1 font-mono bg-muted">
                  <SelectValue placeholder="Engine preset…" />
                </SelectTrigger>
                <SelectContent className="font-mono">
                  {enginePresets.map((preset) => (
                    <SelectItem key={preset.name} value={preset.name}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <TooltipProvider>
                <Select onValueChange={handleCamPresetChange}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectTrigger className="w-full sm:flex-1 font-mono bg-muted">
                        <SelectValue placeholder="Cam preset…" />
                      </SelectTrigger>
                    </TooltipTrigger>
                    {selectedCamPreset && (
                      <TooltipContent className="font-mono">
                        {formatCamPresetTooltip(selectedCamPreset)}
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <SelectContent className="font-mono">
                    {camPresets.map((preset) => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TooltipProvider>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Required — paper data points</h3>
              <div className={alignedFormGridClass}>
                <FormField
                  control={form.control}
                  name="stroke"
                  render={({ field: { value, onChange, ...fieldProps } }) => (
                    <FormItem className={alignedFormItemClass}>
                      <FormLabel>Stroke (mm)</FormLabel>
                      <FormControl>
                        <RequiredNumberInput
                          value={Number.isFinite(value) ? value : undefined}
                          onChange={(next) => onChange(next ?? Number.NaN)}
                          {...fieldProps}
                        />
                      </FormControl>
                      <FieldHelp />
                      <FieldErrorSlot />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="staticCR"
                  render={({ field: { value, onChange, ...fieldProps } }) => (
                    <FormItem className={alignedFormItemClass}>
                      <FormLabel>Static CR</FormLabel>
                      <FormControl>
                        <RequiredNumberInput
                          value={Number.isFinite(value) ? value : undefined}
                          onChange={(next) => onChange(next ?? Number.NaN)}
                          {...fieldProps}
                        />
                      </FormControl>
                      <FieldHelp>
                        From piston spec sheet, or computed when bore + deck + chamber are filled
                      </FieldHelp>
                      <FieldErrorSlot />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="intakeDuration"
                  render={({ field: { value, onChange, ...fieldProps } }) => (
                    <FormItem className={alignedFormItemClass}>
                      <FormLabel>Intake Duration @ 0.050&quot; (deg)</FormLabel>
                      <FormControl>
                        <RequiredNumberInput
                          value={Number.isFinite(value) ? value : undefined}
                          onChange={(next) => onChange(next ?? Number.NaN)}
                          step="1"
                          {...fieldProps}
                        />
                      </FormControl>
                      <FieldHelp />
                      <FieldErrorSlot />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lsa"
                  render={({ field: { value, onChange, ...fieldProps } }) => (
                    <FormItem className={alignedFormItemClass}>
                      <FormLabel>Lobe Separation Angle (deg)</FormLabel>
                      <FormControl>
                        <RequiredNumberInput
                          value={Number.isFinite(value) ? value : undefined}
                          onChange={(next) => onChange(next ?? Number.NaN)}
                          {...fieldProps}
                        />
                      </FormControl>
                      <FieldHelp />
                      <FieldErrorSlot />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                className="text-sm font-semibold mb-3 underline underline-offset-2 hover:text-foreground/80"
                onClick={() => setShowOptional((value) => !value)}
              >
                {showOptional ? "Hide" : "Show"} optional accuracy fields
              </button>

              {showOptional && (
                <div className={alignedFormGridClass}>
                  <FormField
                    control={form.control}
                    name="rodLength"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>Rod Length (mm)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Estimated if blank"
                          />
                        </FormControl>
                        <FieldHelp>
                          SC / 3.2 rods: 127.8 mm C-C
                        </FieldHelp>
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="intakeDurationAt1mm"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>Intake Duration @ 1 mm (deg)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Seat-to-seat / @ 1 mm"
                          />
                        </FormControl>
                        <FieldHelp>
                          DRC card lists this — refines when the seat closes
                        </FieldHelp>
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="camAdvance"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>Cam Advance (deg)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="0"
                            step="0.5"
                          />
                        </FormControl>
                        <FieldHelp>
                          Positive = advanced (intake closes earlier)
                        </FieldHelp>
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="overlapLiftMM"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>Overlap Lift Setting (mm)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="From degree wheel"
                            step="0.1"
                          />
                        </FormControl>
                        <FieldHelp>
                          Requires nominal overlap lift to apply
                        </FieldHelp>
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="overlapLiftNominalMM"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>Nominal Overlap Lift (mm)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Cam spec midpoint"
                            step="0.1"
                          />
                        </FormControl>
                        <FieldHelp />
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="intakeValveClosingAbdc"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>IVC ABDC (deg)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Direct from cam card"
                            step="0.5"
                          />
                        </FormControl>
                        <FieldHelp>
                          Most accurate — overrides all IVC estimates
                        </FieldHelp>
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bore"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>Bore (mm)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FieldHelp />
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deckHeight"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>Deck Height (mm)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FieldHelp />
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gasketThicknessMM"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>Head Gasket Thickness (mm)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FieldHelp />
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="headVolumeCC"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>Combustion Chamber (cc)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FieldHelp>
                          With bore + deck + chamber, overrides manual static CR on calculate
                        </FieldHelp>
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pistonCrownVolumeCC"
                    render={({ field }) => (
                      <FormItem className={alignedFormItemClass}>
                        <FormLabel>Piston Crown Volume (cc)</FormLabel>
                        <FormControl>
                          <OptionalNumberInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FieldHelp>
                          Dome (+) or dish (−) volume
                        </FieldHelp>
                        <FieldErrorSlot />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Calculate
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </form>
        </Form>

        {dcrResult !== null && (
          <div className="mt-6 p-4 border-2 border-border bg-secondary shadow-md">
            <h3 className="text-lg font-semibold mb-2">Result</h3>
            <p className="text-2xl font-bold">{dcrResult.dcr}:1</p>
            <p className="text-sm text-muted-foreground mt-1">{calculationDetails}</p>
            {staticCRNote && (
              <p className="text-sm text-muted-foreground mt-1">{staticCRNote}</p>
            )}
            {dcrResult.warning && (
              <p className="text-sm text-destructive mt-2">{dcrResult.warning}</p>
            )}
          </div>
        )}

        <div className="mt-6 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Example: 3.2SS — 98 mm bore, SC block/crank/rods, DC 993SS</p>
          <p>
            Stroke 70.4 mm · Static CR 10.2:1 (98 mm Mahle @ 1 mm deck) · Rod 127.8 mm ·
            242° @ 0.050&quot; / 248° @ 1 mm · 114° LSA · 1.7 mm overlap · 2° advance
          </p>
          <p>
            → IVC ~{quickExample.ivcAngleABDC}° ABDC · Effective stroke {quickExample.effectiveStrokeMM} mm ·{" "}
            <strong className="text-foreground">DCR ≈ {quickExample.dcr}:1</strong>
          </p>
        </div>

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
          </a>{" "}
          gearset calculator
        </footer>
      </CardContent>
    </Card>
  );
}
