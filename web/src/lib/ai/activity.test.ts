import { describe, expect, it } from "vitest";
import { activeLabel, activityRows, doneIn } from "./activity";
import { applyEvent, snapshot, type AiItem } from "./client";
import { closeOpenMarks, safeHref } from "./markdown";

const ai = (over: Partial<AiItem> = {}): AiItem => ({ id: 2, kind: "ai", text: "", tools: [], proposals: [], choices: [], pending: true, at: 1_000, ...over });

describe("activity rows", () => {
  it("folds repeated calls of one tool into a row with a count, in first-call order", () => {
    const rows = activityRows([
      { id: "a", name: "flap_floor", ok: true, summary: "min raise 28.571 BNB" },
      { id: "b", name: "get_wallet", ok: true, summary: "1.6291 BNB" },
      { id: "c", name: "flap_floor", ok: true, summary: "min raise 2.143 BNB" },
      { id: "d", name: "flap_floor", ok: true, summary: "min raise 2.646 BNB" },
      { id: "e", name: "flap_floor", ok: true, summary: "min raise 2.915 BNB" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "a", label: "Checked Flap's floor for 4 splits", count: 4, status: "complete", meta: "min raise 2.915 BNB" });
    expect(rows[1]).toMatchObject({ label: "Read your wallet", count: 1, kind: "read" });
  });

  it("shows the active label while a call runs and the error when every call failed", () => {
    expect(activityRows([{ id: "a", name: "get_covenant" }])[0]).toMatchObject({ label: "Reading the covenant", status: "active" });
    expect(activityRows([{ id: "a", name: "mint_demo_usdc", ok: false, summary: "needs a connected wallet" }])[0]).toMatchObject({ status: "error", meta: "needs a connected wallet" });
    expect(activityRows([{ id: "a", name: "get_covenant", ok: true, summary: "x" }, { id: "b", name: "get_covenant", ok: false, summary: "no match" }])[0]).toMatchObject({ status: "complete", meta: "1 of 2 failed", label: "Read the covenant for 2 covenants" });
    expect(activityRows([{ id: "a", name: "made_up", ok: true }])[0]!.label).toBe("Ran made_up");
  });

  it("labels the live line and the finished header", () => {
    expect(activeLabel([{ id: "a", name: "flap_floor" }])).toBe("Checking Flap's floor…");
    expect(activeLabel([{ id: "a", name: "flap_floor", ok: true }])).toBe("Thinking…");
    expect(doneIn(3_600)).toBe("Done in 4s");
    expect(doneIn(72_000)).toBe("Done in 1m 12s");
    expect(doneIn(120_000)).toBe("Done in 2m");
  });
});

describe("chat events", () => {
  it("adds choices, flags a tool that needs a wallet, and stamps when the work ended", () => {
    let m = applyEvent(ai(), { t: "tool", id: "t1", name: "mint_demo_usdc", input: {} }, 1_500);
    expect(m.workEnd).toBeUndefined();
    m = applyEvent(m, { t: "tool_done", id: "t1", name: "mint_demo_usdc", ok: false, summary: "needs a connected wallet", need: "wallet" }, 2_000);
    expect(m.needWallet).toBe(true);
    expect(m.tools[0]).toMatchObject({ ok: false, need: "wallet" });
    expect(m.workEnd).toBe(2_000);
    m = applyEvent(m, { t: "choices", c: { id: "c1", question: "Which?", allowCustom: false, options: [{ label: "A", reply: "a" }, { label: "B", reply: "b" }] } });
    expect(m.choices).toHaveLength(1);
    m = applyEvent(m, { t: "done", messages: [], stop: "end_turn" }, 9_000);
    expect(m).toMatchObject({ pending: false, workEnd: 2_000 });
  });

  it("stores a chat without anything in flight: a half answer is marked stopped and a signing card resets", () => {
    const snap = snapshot({
      chatId: "c", busy: true, messages: [{ role: "user", content: "hi" }], notes: [],
      items: [{ id: 1, kind: "user", text: "Raise 3 BNB", at: 1 }, ai({ text: "half" })],
      cards: { p1: { status: "signing", detail: "Confirm", step: 0 }, p2: { status: "confirmed", hashes: ["0xab"] } },
    }, 5);
    expect(snap).toMatchObject({ id: "c", title: "Raise 3 BNB", updatedAt: 5, cards: { p1: { status: "pending" }, p2: { status: "confirmed" } } });
    expect(snap!.items[1]).toMatchObject({ pending: false, error: "Stopped." });
    expect(snapshot({ chatId: null, busy: false, messages: [], notes: [], items: [], cards: {} })).toBeNull();
  });
});

describe("markdown while streaming", () => {
  it("closes a dangling bold, code span or fence, and drops a mark that has just opened", () => {
    expect(closeOpenMarks("**Book va")).toBe("**Book va**");
    expect(closeOpenMarks("Use `0x12")).toBe("Use `0x12`");
    expect(closeOpenMarks("```json\n{")).toBe("```json\n{\n```");
    expect(closeOpenMarks("Done.\n\n- **")).toBe("Done.\n\n- ");
    expect(closeOpenMarks("**ok** and `x`")).toBe("**ok** and `x`");
    expect(closeOpenMarks("`a**b` then **c")).toBe("`a**b` then **c**");
  });

  it("allows only web links", () => {
    expect(safeHref("https://testnet.bscscan.com/tx/0x1")).toBe("https://testnet.bscscan.com/tx/0x1");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("/app/settings")).toBeNull();
    expect(safeHref(undefined)).toBeNull();
  });
});
