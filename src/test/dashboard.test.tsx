import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp, setupMockApi, signInAs } from "./utils";

setupMockApi();

describe("the start page", () => {
  it("shows the notifications with how many are unread, and the coming tax deadlines", async () => {
    signInAs();
    renderApp("/dashboard");
    expect(await screen.findByText("2 oxunmamış")).toBeInTheDocument();
    expect(screen.getByText("Yeni xəbər sənədlərinizə təsir edə bilər")).toBeInTheDocument();
    const deadlines = screen.getByRole("heading", { name: "Yaxınlaşan son tarixlər" }).closest("div")!.parentElement!;
    expect(await within(deadlines).findByText(/2026-09/)).toBeInTheDocument();
  });

  it("marks one notification and then all of them as read", async () => {
    signInAs();
    renderApp("/dashboard");
    await userEvent.click((await screen.findAllByRole("button", { name: "Oxundu" }))[0]!);
    expect(await screen.findByText("1 oxunmamış")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hamısını oxunmuş et" }));
    await waitFor(() => expect(screen.queryByText(/oxunmamış/)).not.toBeInTheDocument());
  });
});
