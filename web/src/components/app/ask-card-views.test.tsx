// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CardState } from "@/lib/ai/client";
import { ME, TOKEN } from "@/lib/ai/test-kit";
import type { Proposal } from "@/lib/ai/types";
import { DEFAULT_TERMS } from "@/lib/covenant/defaults";
import { CreateCardView, TxCardView, type CardActions } from "./ask-card-views";

const mint: Proposal = {
  id: "p1", kind: "mint_demo_usdc", title: "Mint 1,000 test USDT", summary: "faucet() on the test USDT contract.", chainId: 97, signer: ME,
  facts: [{ label: "Amount", value: "1,000 USDT" }, { label: "Token", value: TOKEN }],
  risks: ["Test funds only."],
  txs: [{ chainId: 97, to: TOKEN, data: "0xde5f72fd", value: "0", from: ME, functionName: "faucet", description: "Mint 1,000 USDT to your wallet.", simulation: { ok: true, detail: "ok", gas: "73718" } }],
};

const actions = (card: CardState, account?: string) => ({ card, account, onSign: vi.fn<() => void>(), onCancel: vi.fn<() => void>(), onConnect: vi.fn<() => void>() }) satisfies CardActions;

describe("transaction card", () => {
  it("shows the facts as rows, addresses short with BscScan and copy, the simulation and the risk", () => {
    render(<TxCardView p={mint} a={actions({ status: "pending" }, ME)} wrongSigner={false} />);
    const rows = screen.getAllByRole("term").map((t) => t.textContent);
    // the token is already a fact, so it is not repeated as the contract
    expect(rows).toEqual(["Amount", "Token", "Signer", "Simulation"]);
    const token = screen.getAllByRole("link").find((a) => a.getAttribute("href") === `https://testnet.bscscan.com/address/${TOKEN}`)!;
    expect(token.getAttribute("target")).toBe("_blank");
    expect(screen.getAllByRole("button", { name: "Copy" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Succeeds/).textContent).toContain("73,718");
    expect(screen.getByText("Test funds only.")).toBeTruthy();
    expect(screen.getByText("Needs your signature")).toBeTruthy();
  });

  it("asks to connect a wallet instead of an address, and Sign and Cancel call back", () => {
    const none = actions({ status: "pending" });
    const { rerender } = render(<TxCardView p={mint} a={none} wrongSigner={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(none.onConnect).toHaveBeenCalled();
    expect(screen.getByText("Needs a wallet")).toBeTruthy();
    const me = actions({ status: "pending" }, ME);
    rerender(<TxCardView p={mint} a={me} wrongSigner={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in your wallet" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(me.onSign).toHaveBeenCalled();
    expect(me.onCancel).toHaveBeenCalled();
  });

  it("walks the status: signing, submitted, confirmed with the hash link, rejected, cancelled", () => {
    const { rerender } = render(<TxCardView p={mint} a={actions({ status: "signing", detail: "Confirm faucet in your wallet", step: 0 }, ME)} wrongSigner={false} />);
    expect(screen.getByText("Waiting for wallet")).toBeTruthy();
    expect(screen.getByText("Confirm faucet in your wallet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    rerender(<TxCardView p={mint} a={actions({ status: "submitted", detail: "Waiting for the block", step: 0 }, ME)} wrongSigner={false} />);
    expect(screen.getByText("Submitted")).toBeTruthy();
    const hash = `0x${"ab".repeat(32)}`;
    rerender(<TxCardView p={mint} a={actions({ status: "confirmed", hashes: [hash] }, ME)} wrongSigner={false} />);
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /0xabab/ }).getAttribute("href")).toBe(`https://testnet.bscscan.com/tx/${hash}`);
    rerender(<TxCardView p={mint} a={actions({ status: "rejected" }, ME)} wrongSigner={false} />);
    expect(screen.getByText("Rejected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    rerender(<TxCardView p={mint} a={actions({ status: "cancelled" }, ME)} wrongSigner={false} />);
    expect(screen.getByText("Cancelled. Nothing was sent.")).toBeTruthy();
  });

  it("refuses to sign for the wrong wallet and lists every step of a multi-step call", () => {
    const two = { ...mint, txs: [mint.txs[0]!, { ...mint.txs[0]!, functionName: "redeem", description: "Redeem.", simulation: { ok: null, detail: "Simulated after the step before it confirms." } }] };
    render(<TxCardView p={two} a={actions({ status: "signing", detail: "Confirm redeem", step: 1 }, ME)} wrongSigner />);
    const steps = screen.getByText("Steps").closest(".ag-todo") as HTMLElement;
    expect(within(steps).getAllByRole("listitem")).toHaveLength(2);
    expect(within(steps).getByText("1 of 2")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/can send this/);
  });
});

describe("covenant draft card", () => {
  const terms = { ...DEFAULT_TERMS, name: "GPU Agent", symbol: "GPU", minRaise: 2.7, cap: 3, saleBps: 5000, poolBps: 4500, trancheBps: [500], trancheMultiple: [200], teamWallet: ME };
  const draft: Proposal = { id: "d1", kind: "create", title: "Create GPU", summary: "", chainId: 97, signer: ME, facts: [], risks: ["The rules are fixed at creation."], txs: [], create: { factory: "demo", terms, checkTerms: null, problems: [] } };

  it("shows the terms as a summary table with Edit, and creates from the primary button", () => {
    const a = actions({ status: "pending" }, ME);
    render(<CreateCardView p={draft} a={a} editHref="/app/create?draft=x" />);
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual(["Token", "Raise", "Split", "Budget", "Unlocks", "Exit", "Timing", "Issuer"]);
    expect(screen.getByText("Sale 50%")).toBeTruthy();
    expect(screen.getByText("Team 5%")).toBeTruthy();
    expect(screen.getByText("5% at 2x")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe("/app/create?draft=x");
    fireEvent.click(screen.getByRole("button", { name: "Mine salt and create" }));
    expect(a.onSign).toHaveBeenCalled();
  });

  it("blocks creating a draft with problems and says what to fix", () => {
    const bad = { ...draft, create: { ...draft.create!, checkTerms: "Raise the minimum.", problems: ["Raise the minimum to at least 2.65 BNB."] } };
    render(<CreateCardView p={bad} a={actions({ status: "pending" }, ME)} editHref="/app/create" />);
    expect(screen.getByText("Needs changes")).toBeTruthy();
    expect(screen.getByText("Raise the minimum to at least 2.65 BNB.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Mine salt and create" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
