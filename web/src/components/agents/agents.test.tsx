// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AgentActivity } from "./agent-activity";
import { ApprovalCard } from "./approval-card";
import { PromptInput } from "./prompt-input";
import { StreamingResponse } from "./streaming-response";
import { ToolApproval, ToolApprovalCode } from "./tool-approval";

describe("StreamingResponse", () => {
  it("renders the answer's Markdown: headings, lists, bold, tables, inline code and safe links", () => {
    const md = "**Don't redeem yet.**\n\n### Numbers\n- **Book:** 0.0012 BNB\n- **Pool:** `0x1234…abcd`\n\n| Route | BNB |\n|---|---|\n| Redeem | 1 |\n\n[BscScan](https://testnet.bscscan.com/address/0x1)";
    const { container } = render(<StreamingResponse>{md}</StreamingResponse>);
    expect(container.querySelector("strong")!.textContent).toBe("Don't redeem yet.");
    expect(screen.getByRole("heading", { name: "Numbers" }).tagName).toBe("H3");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("table td")!.textContent).toBe("Redeem");
    expect(container.querySelector("code")!.textContent).toBe("0x1234…abcd");
    const a = screen.getByRole("link", { name: "BscScan" });
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noreferrer");
  });

  it("never renders raw HTML, images or script links from the model", () => {
    const md = "Hi <img src=x onerror=alert(1)> <script>alert(1)</script>\n\n![x](https://evil.example/x.png)\n\n[click](javascript:alert(1))";
    const { container } = render(<StreamingResponse>{md}</StreamingResponse>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("click");
  });

  it("shows no half-written bold while streaming and the copy action only once complete", () => {
    const { container, rerender } = render(<StreamingResponse status="streaming">{"**Book va"}</StreamingResponse>);
    expect(container.textContent).not.toContain("**");
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
    rerender(<StreamingResponse status="complete">{"**Book value**"}</StreamingResponse>);
    expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy();
  });
});

describe("AgentActivity", () => {
  const items = [{ id: "a", type: "step" as const, label: "Checked Flap's floor for 4 splits", meta: "min raise 2.915 BNB" }];

  it("shows a live status with the rows open while working, then a summary that toggles the rows", () => {
    const { rerender } = render(<AgentActivity status="working" activeLabel="Checking Flap's floor…" summary="Done in 4s" items={items} />);
    expect(screen.getByRole("status").textContent).toBe("Checking Flap's floor…");
    expect(screen.getByText("min raise 2.915 BNB")).toBeTruthy();
    rerender(<AgentActivity status="complete" activeLabel="x" summary="Done in 4s" items={items} />);
    const head = screen.getByRole("button", { name: /Done in 4s/ });
    expect(head.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("ApprovalCard", () => {
  const question = { id: "q", title: "Which split?", options: [{ value: "Use 50/45/5", label: "Sale 50 · Pool 45 · Team 5", description: "Min raise 2.65 BNB" }, { value: "Use 50/50/0", label: "Sale 50 · Pool 50 · Team 0" }], allowCustom: true };

  it("answers with the clicked option's value, and settles to show it", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<ApprovalCard question={question} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /Sale 50 · Pool 45/ }));
    expect(onSubmit).toHaveBeenCalledWith({ selected: ["Use 50/45/5"] });
    rerender(<ApprovalCard question={question} status="answered" answer={{ selected: ["Use 50/45/5"] }} onSubmit={onSubmit} />);
    expect(screen.getByRole("button", { name: /Sale 50 · Pool 45/ }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("button", { name: /Sale 50 · Pool 50/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("sends a free-text answer", () => {
    const onSubmit = vi.fn();
    render(<ApprovalCard question={question} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Your own answer" }), { target: { value: "Raise 5 BNB instead" } });
    fireEvent.click(screen.getByRole("button", { name: "Send your answer" }));
    expect(onSubmit).toHaveBeenCalledWith({ selected: [], custom: "Raise 5 BNB instead" });
  });
});

describe("PromptInput", () => {
  function Harness({ loading = false, onSubmit = vi.fn(), onStop = vi.fn() }) {
    const [v, setV] = useState("");
    return <PromptInput value={v} onValueChange={setV} onSubmit={onSubmit} loading={loading} onStop={onStop} />;
  }

  it("sends on Enter, keeps Shift+Enter for a new line, and trims", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const box = screen.getByRole("textbox");
    fireEvent.change(box, { target: { value: "  Should I redeem?  " } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("Should I redeem?");
  });

  it("is a Stop button while the agent works", () => {
    const onStop = vi.fn();
    const onSubmit = vi.fn();
    render(<Harness loading onStop={onStop} onSubmit={onSubmit} />);
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalled();
  });
});

describe("ToolApproval", () => {
  it("lays out the title, status badge, parameter rows, footer and a raw-call disclosure", () => {
    render(
      <ToolApproval title="Mint 1,000 test USDT" tool="faucet()" status="pending" labels={{ pending: "Needs your signature" }}
        parameters={[{ id: "a", label: "Amount", value: "1,000 USDT" }]} footer={<button type="button">Sign in your wallet</button>}>
        <ToolApprovalCode code='{"to":"0x1"}' />
      </ToolApproval>,
    );
    expect(screen.getByRole("heading", { name: "Mint 1,000 test USDT" })).toBeTruthy();
    expect(screen.getByText("Needs your signature")).toBeTruthy();
    expect(screen.getByText("Amount").tagName).toBe("DT");
    const toggle = screen.getByRole("button", { name: "Show raw call" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide raw call" }).getAttribute("aria-expanded")).toBe("true");
  });
});
