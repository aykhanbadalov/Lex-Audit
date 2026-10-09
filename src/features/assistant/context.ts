import { z } from "zod";
import type { Attachment } from "./api";

const TYPES = ["legislation", "news", "file", "invoice"] as const;

/** A screen can open the assistant "about" one resource by putting it in the URL. */
export const assistantSearchSchema = z.object({
  contextType: z.enum(TYPES).optional().catch(undefined),
  contextId: z.coerce.string().optional().catch(undefined),
  contextTitle: z.coerce.string().optional().catch(undefined),
});

export type AssistantSearch = z.infer<typeof assistantSearchSchema>;

export function contextFromSearch(search: AssistantSearch): Attachment[] {
  const { contextType, contextId, contextTitle } = search;
  if (!contextType || !contextId || !contextTitle?.trim()) return [];
  return [{ type: contextType, id: contextId, title: contextTitle.trim().slice(0, 200) }];
}
