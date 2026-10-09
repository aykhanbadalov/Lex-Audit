import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import "@/app/i18n";
import { DataTable } from "./DataTable";

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row, unknown>[] = [{ accessorKey: "name", header: "Ad" }];
const data: Row[] = [
  { id: "1", name: "Beta" },
  { id: "2", name: "Alfa" },
];

function renderTable(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(<DataTable columns={columns} data={data} getRowId={(row) => row.id} emptyTitle="Boşdur" {...props} />);
}

// jsdom has no layout, so the virtualizer sees a zero-height viewport and renders nothing.
// Giving the scroll element a size makes it render rows like a real browser would.
Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 480 });
Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 800 });
Element.prototype.getBoundingClientRect = () => ({
  width: 800,
  height: 480,
  top: 0,
  left: 0,
  right: 800,
  bottom: 480,
  x: 0,
  y: 0,
  toJSON: () => ({}),
});

describe("DataTable", () => {
  it("shows a loading state", () => {
    renderTable({ isLoading: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows an error with a retry button", async () => {
    const onRetry = vi.fn();
    renderTable({ error: new Error("Boom"), onRetry });
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    await userEvent.click(screen.getByRole("button", { name: "Yenidən cəhd et" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("distinguishes 'no data' from 'no results'", () => {
    const { unmount } = renderTable({ data: [] });
    expect(screen.getByText("Boşdur")).toBeInTheDocument();
    unmount();
    renderTable({ data: [], isFiltered: true });
    expect(screen.getByText("Nəticə tapılmadı")).toBeInTheDocument();
  });

  it("renders rows and lets keyboard users open one with Enter", async () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });
    const row = await screen.findByText("Beta");
    row.closest("tr")?.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledWith({ id: "1", name: "Beta" });
  });
});
