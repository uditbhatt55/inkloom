import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours must be hex, like #1B2A4A.");

/**
 * The multipart form the upload screen posts to /api/audit (§5, §7.1). Exactly one source: file, text or url.
 * New item: orgId + title. New version of an existing item: itemId. Fixed, user-safe messages only.
 */
export const AuditFormSchema = z
  .object({
    itemId: z.uuid().optional(),
    orgId: z.uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    channel: z.string().trim().min(1).max(40).default("web"),
    audience: z.enum(["public", "internal"]).default("public"),
    text: z.string().max(200_000).optional(),
    url: z.url().max(2048).optional(),
    altText: z.string().max(1000).optional(),
    textColour: hex.optional(),
    bgColour: hex.optional(),
    largeText: z.enum(["true", "false"]).optional(),
  })
  .refine((v) => v.itemId || (v.orgId && v.title), { message: "Give either an existing item, or an organisation and a title." })
  .refine((v) => !v.textColour === !v.bgColour, { message: "Give both the text colour and the background colour, or neither." });

export type AuditForm = z.infer<typeof AuditFormSchema> & { file?: File };

export class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** FormData → validated request. Throws RequestError(400) with a fixed message. */
export function readAuditForm(form: FormData): AuditForm {
  const fields: Record<string, string> = {};
  let file: File | undefined;
  for (const [k, v] of form.entries()) {
    if (k === "file" && typeof v !== "string") file = v;
    else if (typeof v === "string" && v !== "") fields[k] = v;
  }
  const sources = [file && file.size > 0, fields.text?.trim(), fields.url].filter(Boolean).length;
  if (sources !== 1) throw new RequestError(400, "Provide exactly one of: a file, pasted text, or a web address.");
  if (file && file.size > MAX_UPLOAD_BYTES) throw new RequestError(413, "Files over 10 MB are not supported.");
  const parsed = AuditFormSchema.safeParse(fields);
  if (!parsed.success) throw new RequestError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  return { ...parsed.data, file: file && file.size > 0 ? file : undefined };
}
