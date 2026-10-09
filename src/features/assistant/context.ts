import { z } from "zod";

const TYPES = ["legislation", "news", "file", "invoice"] as const;

export type ContextType = (typeof TYPES)[number];
export interface ContextResource {
  type: ContextType;
  id: string;
  title: string;
}

/** A screen can open the assistant "about" one resource by putting it in the URL. */
export const assistantSearchSchema = z.object({
  contextType: z.enum(TYPES).optional().catch(undefined),
  contextId: z.coerce.string().optional().catch(undefined),
  contextTitle: z.coerce.string().optional().catch(undefined),
});

export type AssistantSearch = z.infer<typeof assistantSearchSchema>;

export function contextFromSearch(search: AssistantSearch): ContextResource | null {
  const { contextType, contextId, contextTitle } = search;
  if (!contextType || !contextId || !contextTitle?.trim()) return null;
  return { type: contextType, id: contextId, title: contextTitle.trim().slice(0, 200) };
}

/**
 * The backend's assistant has tools that read a news item, a law, a file or an invoice by id, so pointing it at one is
 * done in words: the first line names the resource and its id, and the person finishes the question.
 */
export function draftFor(resource: ContextResource, label: string): string {
  return `${label} «${resource.title}» (id: ${resource.id}): `;
}
