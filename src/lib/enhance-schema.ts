import { z } from "zod";

export const bulletSchema = z.object({
  origin: z
    .enum(["you", "ai"])
    .describe('"you" if the point comes from the user\'s own rough notes, "ai" if you added it from the transcript.'),
  cites: z
    .array(z.string())
    .describe("Ids of the transcript segments that support this bullet, e.g. [\"s4\", \"s6\"]. Required for every ai bullet."),
  text: z.string().describe("One concise bullet. No trailing citation markers."),
});

export const enhancedSchema = z.object({
  title: z.string().describe("A short, specific meeting title (max 60 characters)."),
  sections: z.array(
    z.object({
      heading: z.string(),
      bullets: z.array(bulletSchema),
    }),
  ),
});

export type EnhancedRaw = z.infer<typeof enhancedSchema>;

export const segmentInputSchema = z.object({
  id: z.string().min(1).max(40),
  speaker: z.enum(["you", "them"]),
  label: z.string().max(80).optional(),
  t: z.number().min(0),
  text: z.string().max(4000),
});

export const enhanceRequestSchema = z.object({
  template: z.string().max(40),
  title: z.string().max(200).optional(),
  userNotes: z.string().max(20000),
  transcriptSegments: z.array(segmentInputSchema).max(2000),
});

export type EnhanceRequest = z.infer<typeof enhanceRequestSchema>;
