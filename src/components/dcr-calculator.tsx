import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import "./dcr-calculator.css";

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

// Form schema validation
const calculatorFormSchema = z.object({
  stroke: z.coerce.number().positive("Stroke must be positive").default(70.4),
  staticCR: z.coerce
    .number()
    .positive("Static CR must be positive")
    .default(10.2),
  intakeDuration: z.coerce
    .number()
    .positive('Duration @ 0.050" must be positive')
    .default(242), // Duration @ 0.050"
  lsa: z.coerce.number().positive("LSA must be positive").default(114),
  rodLength: z.coerce
    .number()
    .positive("Rod length must be positive")
    .optional()
    .nullable()
    .default(null),
  advertisedIntakeDuration: z.coerce
    .number()
    .positive("Advertised duration must be positive")
    .optional()
    .nullable()
    .default(null), // Optional seat-to-seat duration
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
};

// DCR calculation function
function calculateDCR(
  strokeMM: number,
  staticCR: number,
  intakeDurationAt050: number,
  lsa: number,
  rodLengthMM: number | null | undefined,
  advertisedIntakeDuration: number | null | undefined,
): number {
  // Estimate rod length if not provided
  const actualRodLengthMM =
    rodLengthMM && rodLengthMM > 0 ? rodLengthMM : strokeMM * 1.7;

  let ivcAngleABDC: number;

  // Determine IVC Angle based on duration/LSA and ramp
  let rampDegrees: number;
  if (
    advertisedIntakeDuration &&
    typeof advertisedIntakeDuration === "number" &&
    advertisedIntakeDuration > intakeDurationAt050
  ) {
    rampDegrees = (advertisedIntakeDuration - intakeDurationAt050) / 2;
  } else {
    rampDegrees = 15; // Default estimate
  }
  ivcAngleABDC = intakeDurationAt050 / 2 + lsa - 180 + rampDegrees;

  // Ensure ivcAngleABDC is within a reasonable range (e.g., > 0 and < 180)
  const clampedIvcAngleABDC = Math.max(1, Math.min(ivcAngleABDC, 179));
  if (clampedIvcAngleABDC !== ivcAngleABDC) {
    console.warn(
      `IVC angle ${ivcAngleABDC.toFixed(1)} was outside expected range (1-179) and clamped to ${clampedIvcAngleABDC}. Check inputs.`,
    );
    ivcAngleABDC = clampedIvcAngleABDC;
  }

  // Calculate DCR using the determined IVC
  const thetaDegrees = 180 + ivcAngleABDC;
  const thetaRadians = (thetaDegrees * Math.PI) / 180;
  const crankRadiusMM = strokeMM / 2;
  const R = actualRodLengthMM / crankRadiusMM;
  const cosTheta = Math.cos(thetaRadians);
  const sinTheta = Math.sin(thetaRadians);
  // Prevent square root of negative number
  const sqrtTerm = Math.sqrt(Math.max(0, R * R - sinTheta * sinTheta));
  const effectiveStrokeRatio = 0.5 * (1 - cosTheta + R - sqrtTerm);
  const clampedESR = Math.max(0, Math.min(effectiveStrokeRatio, 1));
  const dcr = 1 + clampedESR * (staticCR - 1);

  return parseFloat(dcr.toFixed(2));
}

export function DCRCalculator() {
  const [dcrResult, setDCRResult] = useState<number | null>(null);
  const [calculationDetails, setCalculationDetails] = useState<string>("");

  const form = useForm<CalculatorFormValues>({
    resolver: zodResolver(calculatorFormSchema),
    defaultValues,
    mode: "onChange", // Validate on change
  });

  // Form setup using useForm hook with zodResolver

  const onSubmit = (data: CalculatorFormValues) => {
    // Determine calculation method string based on submitted data for feedback
    let ivcMethod = "";
    if (
      data.advertisedIntakeDuration &&
      typeof data.advertisedIntakeDuration === "number" &&
      data.advertisedIntakeDuration > data.intakeDuration
    ) {
      ivcMethod = "Using Advertised Duration";
    } else {
      ivcMethod = "Using default ramp estimate";
    }

    const rodMethod =
      data.rodLength === null || data.rodLength <= 0
        ? "(Rod length estimated)"
        : "";

    const dcr = calculateDCR(
      data.stroke,
      data.staticCR,
      data.intakeDuration,
      data.lsa,
      data.rodLength,
      data.advertisedIntakeDuration,
    );

    setDCRResult(dcr);
    setCalculationDetails(`${ivcMethod} ${rodMethod}`.trim());
  };

  const handleReset = () => {
    form.reset(defaultValues);
    setDCRResult(null);
    setCalculationDetails("");
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardDescription>
          Calculates approximate Dynamic Compression Ratio (DCR) based on valve
          timing (LSA, Duration @ 0.050"). Providing Advertised Duration
          improves accuracy over default ramp estimation. Rod length is
          estimated if not provided.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="stroke"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stroke (mm)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" className="max-w-[150px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="staticCR"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Static CR (e.g. 10.2)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" className="max-w-[150px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="intakeDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intake Duration @ 0.050" (deg)</FormLabel>
                    <FormControl>
                      <Input type="number" className="max-w-[150px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lsa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lobe Separation Angle (deg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" className="max-w-[150px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rodLength"
                render={({ field: { value, onChange, ...fieldProps } }) => (
                  <FormItem>
                    <FormLabel>Rod Length (mm, optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="Estimated if blank" 
                        className="max-w-[150px]"
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
                  <FormItem>
                    <FormLabel>Advertised Duration (deg, optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Seat-to-seat" 
                        className="max-w-[150px]"
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
            </div>

            <div className="flex space-x-2">
              <Button type="submit">Calculate</Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </form>
        </Form>

        {dcrResult !== null && (
          <div className="mt-6 p-4 border rounded-md bg-muted">
            <h3 className="text-lg font-semibold mb-2">Result:</h3>
            <p className="text-2xl font-bold">{dcrResult}:1</p>
            <p className="text-sm text-muted-foreground mt-1">{calculationDetails}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
