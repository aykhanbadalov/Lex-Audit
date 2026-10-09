import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TabPanel, Tabs } from "./tabs";

const TABS = [
  { id: "a", label: "Birinci" },
  { id: "b", label: "İkinci" },
  { id: "c", label: "Üçüncü" },
];

function Harness({ initial = "a" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Tabs label="Bölmələr" tabs={TABS} value={value} onChange={setValue} idPrefix="t" />
      {TABS.map((tab) => (
        <TabPanel key={tab.id} idPrefix="t" id={tab.id} value={value}>
          Məzmun {tab.id}
        </TabPanel>
      ))}
    </>
  );
}

describe("Tabs", () => {
  it("shows only the selected panel, wired to its tab", () => {
    render(<Harness />);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Məzmun a");
    expect(panel).toHaveAttribute("aria-labelledby", screen.getByRole("tab", { name: "Birinci" }).id);
    expect(screen.queryByText("Məzmun b")).not.toBeInTheDocument();
  });

  it("puts only the selected tab in the tab order", () => {
    render(<Harness initial="b" />);
    expect(screen.getByRole("tab", { name: "İkinci" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Birinci" })).toHaveAttribute("tabindex", "-1");
  });

  it("switches on click", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("tab", { name: "Üçüncü" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Məzmun c");
    expect(screen.getByRole("tab", { name: "Üçüncü" })).toHaveAttribute("aria-selected", "true");
  });

  it("moves with the arrow keys, wrapping at both ends, and moves focus along", async () => {
    render(<Harness />);
    screen.getByRole("tab", { name: "Birinci" }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "İkinci" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Məzmun b");

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}"); // back to the first, then wraps to the last
    expect(screen.getByRole("tab", { name: "Üçüncü" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Birinci" })).toHaveFocus();
  });

  it("jumps to the first and last tab with Home and End", async () => {
    render(<Harness initial="b" />);
    screen.getByRole("tab", { name: "İkinci" }).focus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Üçüncü" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Birinci" })).toHaveFocus();
  });
});
