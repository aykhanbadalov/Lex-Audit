import type { Citation } from "./chatReducer";

/** Where a citation points inside the app. A resource type the UI does not know yet simply gets no link. */
export function citationTarget(
  citation: Pick<Citation, "resourceType" | "resourceId">,
): { to: "/legislation/$id" | "/news/$id" | "/files/$id" | "/invoices/$id"; id: string } | null {
  const id = citation.resourceId;
  switch (citation.resourceType) {
    case "legislation":
      return { to: "/legislation/$id", id };
    case "news":
      return { to: "/news/$id", id };
    case "file":
      return { to: "/files/$id", id };
    case "invoice":
      return { to: "/invoices/$id", id };
    default:
      return null;
  }
}
