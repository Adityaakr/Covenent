import { describe, expect, it } from 'vitest';
import { dispatchableQuote } from '../../src/keeper/keeper.js';

const E18 = 10n ** 18n;

// Numbers from chain 97 (26 Nov 2026): before Flap's processor liquidates, it holds nothing; after one 5 BNB round
// trip on a fork it held 0.3906 WBNB with feeQuoteBalance 0.0391, and dispatch() sent the vault 0.3515.
describe('keeper: dispatch only when the tax processor has BNB to pass on', () => {
  it('nothing liquidated yet: nothing to dispatch', () => {
    expect(dispatchableQuote({ wbnb: 0n, native: 0n, reserved: [0n, 0n, 0n, 0n] })).toBe(0n);
  });
  it('liquidated: the vault share is what exceeds the processor’s own balances', () => {
    const wbnb = 390558548810113580n;
    const fee = 39055854881011358n;
    expect(dispatchableQuote({ wbnb, native: 0n, reserved: [fee, 0n, 0n, 0n] })).toBe(351502693929102222n);
  });
  it('after dispatch only Flap’s fee remains: nothing to dispatch again', () => {
    const fee = 39055854881011358n;
    expect(dispatchableQuote({ wbnb: fee, native: 0n, reserved: [fee, 0n, 0n, 0n] })).toBe(0n);
  });
  it('native BNB counts too, and never goes below zero', () => {
    expect(dispatchableQuote({ wbnb: 0n, native: E18, reserved: [0n] })).toBe(E18);
    expect(dispatchableQuote({ wbnb: 1n, native: 0n, reserved: [5n] })).toBe(0n);
  });
});
