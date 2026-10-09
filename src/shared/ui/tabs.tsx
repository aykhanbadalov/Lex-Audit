import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface TabItem {
  id: string;
  label: string;
}

const tabDomId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
const panelDomId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

interface TabsProps {
  /** Names the group for screen readers. */
  label: string;
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Keeps ids unique when a page has more than one set of tabs. */
  idPrefix: string;
}

/**
 * Tabs that follow the WAI-ARIA pattern: one tab is in the tab order, the arrow keys, Home and End move between
 * them, and each tab names the panel it controls.
 */
export function Tabs({ label, tabs, value, onChange, idPrefix }: TabsProps) {
  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const target =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    const next = tabs[target];
    if (!next) return;
    onChange(next.id);
    document.getElementById(tabDomId(idPrefix, next.id))?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b">
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={tabDomId(idPrefix, tab.id)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelDomId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
              selected ? "border-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Only the active panel is mounted, so a tab that has not been opened never fetches its data. */
export function TabPanel({
  idPrefix,
  id,
  value,
  children,
}: {
  idPrefix: string;
  id: string;
  value: string;
  children: ReactNode;
}) {
  if (id !== value) return null;
  return (
    <div
      role="tabpanel"
      id={panelDomId(idPrefix, id)}
      aria-labelledby={tabDomId(idPrefix, id)}
      tabIndex={0}
      className="pt-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </div>
  );
}
