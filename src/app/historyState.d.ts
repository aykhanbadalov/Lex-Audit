import type { LegislationListSearch } from "@/features/legislation/filters";
import type { NewsSearch } from "@/features/news/filters";

// State carried in the browser history entry when a list opens a detail page, so "back" can restore the list's
// filters. It is optional on purpose: opening a detail URL directly has no list to go back to.
declare module "@tanstack/history" {
  interface HistoryState {
    fromNewsSearch?: NewsSearch;
    fromLegislationSearch?: LegislationListSearch;
  }
}
