import { describe, expect, it } from "vitest";
import { decodeAtlasRound, roundsFromLogs } from "./atlas-feed";

// Update logs of the Atlas BNB/USD single feed the BNB testnet oracle names (blocks 145101933, 145102067, 145102200).
const LOGS = [
  { data: "0x00006b08fd47001e7a914cdba81b6ec6" },
  { data: "0x00006b08fd83001e78ed6239db92e3d8" },
  { data: "0x00006b08fdbf001e79651d2a1c80df4e" },
];
const LATEST = { price: 562.1497521292276, updatedAt: 0x6b08fdbf };

describe("Atlas feed rounds", () => {
  it("decodes the packed update time and 18-decimal answer of a feed log", () => {
    const r = decodeAtlasRound(LOGS[2]!.data, LATEST)!;
    expect(r.t).toBe(1_795_751_359);
    expect(r.price).toBeCloseTo(562.14975, 4);
  });

  it("returns the recent rounds oldest first, a minute apart", () => {
    const rounds = roundsFromLogs([LOGS[2]!, LOGS[0]!, LOGS[1]!, LOGS[2]!], LATEST);
    expect(rounds.map((r) => r.t)).toEqual([0x6b08fd47, 0x6b08fd83, 0x6b08fdbf]);
    expect(rounds[1]!.t - rounds[0]!.t).toBe(60);
    expect(rounds.every((r) => r.price > 550 && r.price < 575)).toBe(true);
  });

  it("drops data that is not a round of this feed", () => {
    expect(decodeAtlasRound("0x", LATEST)).toBeNull();
    expect(decodeAtlasRound(`0x${"00".repeat(32)}`, LATEST)).toBeNull(); // a 32-byte word: another event
    expect(decodeAtlasRound("0x00006b08fdbf000000000000000000000001", LATEST)).toBeNull(); // wrong length
    expect(decodeAtlasRound("0x00006b08fdbf00000000000000000001", LATEST)).toBeNull(); // answer far from the latest
    expect(decodeAtlasRound("0x00006b08fdc0001e79651d2a1c80df4e", LATEST)).toBeNull(); // newer than the latest round
    expect(decodeAtlasRound("0x00006b07ac3f001e79651d2a1c80df4e", LATEST)).toBeNull(); // more than a day old
  });
});
