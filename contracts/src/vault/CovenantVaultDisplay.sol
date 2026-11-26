// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {LibString} from "solady/utils/LibString.sol";
import {VaultUISchema, VaultMethodSchema, FieldDescriptor, ApproveAction} from "src/flap/IVaultSchemas.sol";
import {State, Tranche, Terms, ICovenantLauncher} from "src/vault/CovenantTypes.sol";
import {IERC8004Reputation} from "src/agent/IERC8004.sol";

/// @notice Flap's two mandatory vault surfaces, kept out of the vault's own code: the disclosure string
///         `description()` and the `vaultUISchema()` Flap.sh renders its interaction panel from.
/// @dev Public library functions run by DELEGATECALL from the vault, so the vault stays under the size limit.
library CovenantVaultDisplay {
    using LibString for uint256;

    struct Snapshot {
        address launcher; // read for the tax terms
        uint64 launchedAt;
        State state;
        uint256 treasury;
        uint256 book;
        address team;
        uint16 tapCapBps;
        uint256 owed;
        uint256 locked;
        uint256[] multiples;
        uint256 saleAmount;
        uint16 exitFeeBps;
        uint256 agentId;
    }

    /// @notice Renders, for example:
    ///   CovenantVault: 100% of this vault's revenue goes to the treasury. State ACTIVE. Treasury 317.47 BNB,
    ///   book value 0.000000427 BNB per token. Team 0x...: tap up to 4% of treasury per 30 days, 4.1 BNB claimable.
    ///   Trading tax (buy 1%, sell 1%) is the treasury's income until 2126-11-02 UTC; after that the tap is paid only
    ///   from the treasury, so book value only falls unless the team deposits revenue (depositRevenue). Team tokens:
    ///   250000000 locked, unlock at 2x, 4x, 8x of the sale price. Sale buyers claim 600000000 tokens pro rata. Exit
    ///   fee 1%, kept by the treasury.
    function describe(Snapshot memory s) public view returns (string memory) {
        string memory head = string.concat(
            "CovenantVault: 100% of this vault's revenue goes to the treasury. State ",
            stateName(s.state),
            ". Treasury ",
            decimal(s.treasury, 4),
            " BNB, book value ",
            decimal(s.book, 3),
            " BNB per token. "
        );
        string memory team = string.concat(
            "Team ",
            LibString.toHexString(s.team),
            s.agentId == 0 ? "" : string.concat(" (ERC-8004 agent #", s.agentId.toString(), ")"),
            ": tap up to ",
            bps(s.tapCapBps),
            " of treasury per 30 days, ",
            decimal(s.owed, 4),
            " BNB claimable. ",
            _taxText(s.launcher, s.launchedAt)
        );
        string memory tokens = string.concat(
            "Team tokens: ",
            (s.locked / 1e18).toString(),
            " locked",
            _multiplesText(s.multiples),
            ". Sale buyers claim ",
            (s.saleAmount / 1e18).toString(),
            " tokens pro rata. Exit fee ",
            bps(s.exitFeeBps),
            ", kept by the treasury; none at wind-down. No Covenant admin keys. Flap's Guardian can upgrade the vault and launcher, wind the covenant down, lower the tap, post a report and claim the tap to the team wallet."
        );
        return string.concat(head, team, tokens);
    }

    /// @dev Flap re-review F8: what the treasury lives on after the tax period.
    function _taxText(address launcher, uint64 launchedAt) private view returns (string memory) {
        Terms memory t = ICovenantLauncher(launcher).terms();
        uint256 end = uint256(launchedAt) + t.taxDuration;
        string memory tail =
            "the tap is paid only from the treasury, so book value only falls unless the team deposits revenue (depositRevenue; anyone can deposit, and exit fees the treasury keeps add to it too). ";
        if (block.timestamp >= end) return string.concat("Trading tax ended on ", date(end), " UTC: ", tail);
        return string.concat(
            "Trading tax (buy ",
            bps(t.buyTaxBps),
            ", sell ",
            bps(t.sellTaxBps),
            ") is the treasury's income until ",
            date(end),
            " UTC; after that ",
            tail
        );
    }

    /// @notice A unix time as YYYY-MM-DD (UTC), by the civil-from-days algorithm.
    function date(uint256 ts) public pure returns (string memory) {
        uint256 z = ts / 1 days + 719_468;
        uint256 era = z / 146_097;
        uint256 doe = z - era * 146_097;
        uint256 yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 d = doy - (153 * mp + 2) / 5 + 1;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        uint256 y = yoe + era * 400 + (m <= 2 ? 1 : 0);
        return string.concat(y.toString(), "-", _two(m), "-", _two(d));
    }

    function _two(uint256 v) private pure returns (string memory) {
        return v < 10 ? string.concat("0", v.toString()) : v.toString();
    }

    function _multiplesText(uint256[] memory m) private pure returns (string memory out) {
        if (m.length == 0) return "";
        out = ", unlock at ";
        for (uint256 i; i < m.length; ++i) {
            out = string.concat(out, i == 0 ? "" : ", ", decimal(m[i] * 1e16, 2), "x");
        }
        out = string.concat(out, " of the sale price");
    }

    function stateName(State s) public pure returns (string memory) {
        if (s == State.RAISING) return "RAISING";
        if (s == State.FAILED) return "FAILED";
        if (s == State.ACTIVE) return "ACTIVE";
        if (s == State.EXIT_ROUND) return "EXIT_ROUND";
        if (s == State.COOLDOWN) return "COOLDOWN";
        return "WIND_DOWN";
    }

    /// @notice "4%", "1.5%" from bps.
    function bps(uint256 v) public pure returns (string memory) {
        return string.concat(decimal(v * 1e16, 2), "%");
    }

    /// @notice An 18-decimal value as a decimal string, keeping `sig` significant fractional digits after the
    ///         first non-zero one and dropping trailing zeros: 317470000000000000000 -> "317.47",
    ///         427000000000 -> "0.000000427".
    function decimal(uint256 v, uint256 sig) public pure returns (string memory) {
        uint256 whole = v / 1e18;
        uint256 frac = v % 1e18;
        if (frac == 0) return whole.toString();
        bytes memory f = bytes(frac.toString());
        // left-pad to 18 digits
        bytes memory digits = new bytes(18);
        uint256 pad = 18 - f.length;
        for (uint256 i; i < 18; ++i) {
            digits[i] = i < pad ? bytes1("0") : f[i - pad];
        }
        uint256 keep;
        if (whole > 0) {
            keep = sig;
        } else {
            uint256 firstNonZero = pad; // the first digit of f is non-zero
            keep = firstNonZero + sig;
        }
        if (keep > 18) keep = 18;
        while (keep > 0 && digits[keep - 1] == "0") --keep;
        if (keep == 0) return whole.toString();
        bytes memory out = new bytes(keep);
        for (uint256 i; i < keep; ++i) {
            out[i] = digits[i];
        }
        return string.concat(whole.toString(), ".", string(out));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // vaultUISchema
    // ─────────────────────────────────────────────────────────────────────────

    struct TapInput {
        uint256 from; // the vault's last accrual time, s
        uint256 to; // now, s
        uint256 roundStart; // the latest exit round, s
        uint256 roundEnd;
        uint256 maxStep; // the most time one observation may add, s
        uint256 balance; // the vault's BNB, wei
        uint256 owed; // tap accrued and unclaimed, wei
        uint256 capBps; // tap cap, bps of the free treasury per 30 days
        uint256 usdPer30d; // dollar budget, USD 1e18 per 30 days
        uint256 bnbUsd; // a fresh verified BNB/USD, USD 1e18 per BNB (nonzero)
    }

    /// @notice Rule 1: the tap one observation accrues, in wei. Time since the last accrual, less the overlap with
    ///         the latest exit round, capped at `maxStep`; rate min(dollar budget at BNB/USD, capBps of the free
    ///         treasury) per 30 days; the unclaimed balance never exceeds one period's cap.
    function tapAmount(TapInput memory i) public pure returns (uint256 amt) {
        if (i.to <= i.from) return 0;
        uint256 span = i.to - i.from;
        if (i.roundEnd > i.from && i.roundStart < i.to) {
            uint256 lo = i.roundStart > i.from ? i.roundStart : i.from;
            uint256 hi = i.roundEnd < i.to ? i.roundEnd : i.to;
            span -= hi - lo;
        }
        if (span > i.maxStep) span = i.maxStep;
        if (span == 0 || i.balance <= i.owed) return 0;
        uint256 capAmt = (i.balance - i.owed) * i.capBps * span / (10_000 * 30 days);
        uint256 usdAmt = i.usdPer30d * 1e18 * span / (i.bnbUsd * 30 days);
        amt = usdAmt < capAmt ? usdAmt : capAmt;
        // A stolen key reaches at most one period's cap: unclaimed tap stops growing there.
        uint256 maxOwed = i.balance * i.capBps / 10_000;
        if (i.owed + amt > maxOwed) amt = maxOwed > i.owed ? maxOwed - i.owed : 0;
    }

    struct UnlockInput {
        bool strict; // a verified rate, a deep pool and a valid rate window
        uint256 rateElapsed; // strict: s since the previous poke with a rate (0 on the first poke)
        uint256 rateTwap; // strict: pool TWAP over that window, BNB per token 1e18
        uint256 elapsed; // s since the previous poke of any kind
        uint256 twap; // pool TWAP over that window, BNB per token 1e18
        uint256 rate; // BNB/USD 1e18 to value the price at: the observation's when strict, else the last verified
        //            rate if at most maxStep old, else 0 (then every counter resets)
        uint256 usdSale; // dollar sale price, USD per token 1e18
        uint256 bnbSale; // BNB sale price Q / A, 1e18
        uint256 minGap; // the poke gap, s
        uint256 maxStep; // the longest window that keeps unlock time continuous, s
        bool cliffPassed;
        uint256 window; // unlockWindow, s
    }

    /// @notice Rule 2 on one observation (the vault's `_observeTranches` states the rule). A strict observation adds
    ///         its rate window to each locked tranche whose multiple held over it (and over the window since the last
    ///         poke, when that is at least the poke gap long) and resets the others; a rate window longer than
    ///         `maxStep` resets them all. An observation without a rate never adds: it resets each tranche whose
    ///         multiple the TWAP misses at `rate`, and all of them when `rate` is 0. Prices 1e18, times in seconds.
    /// @return mask bit k set for each tranche this call unlocked (the vault does the accounting and the records)
    function observeTranches(Tranche[] storage ts, UnlockInput memory i) public returns (uint256 mask) {
        if (i.usdSale == 0) return 0; // no dollar reference yet: nothing has counted, nothing to reset
        uint256 n = ts.length;
        if (i.strict) {
            if (i.rateElapsed == 0) return 0; // the first poke only sets the rate
            bool continuous = i.rateElapsed <= i.maxStep;
            bool checkRecent = i.elapsed >= i.minGap && i.elapsed < i.rateElapsed;
            for (uint256 k; k < n; ++k) {
                Tranche storage t = ts[k];
                if (t.unlocked) continue;
                bool held = continuous && _holds(i.rateTwap, i.rate, t.multiple, i.usdSale, i.bnbSale)
                    && (!checkRecent || _holds(i.twap, i.rate, t.multiple, i.usdSale, i.bnbSale));
                if (held) t.progress += uint64(i.rateElapsed);
                else if (t.progress != 0) t.progress = 0;
                if (i.cliffPassed && t.progress >= i.window) {
                    t.unlocked = true;
                    mask |= 1 << k;
                }
            }
            return mask;
        }
        // Not strict: never adds. A window shorter than the gap (a rate-carrying poke that was not strict) is too short
        // to resist a one-block move, so it only resets through the stale-rate rule (rate == 0).
        if (i.rate != 0 && i.elapsed < i.minGap) return 0;
        for (uint256 k; k < n; ++k) {
            Tranche storage t = ts[k];
            if (t.unlocked || t.progress == 0) continue;
            if (i.rate == 0 || !_holds(i.twap, i.rate, t.multiple, i.usdSale, i.bnbSale)) t.progress = 0;
        }
    }

    /// @dev The multiple `m` (200 = 2x) holds in BNB (twap against the BNB sale price) and in dollars (twap x rate
    ///      against the dollar sale price).
    function _holds(uint256 twap, uint256 rate, uint256 m, uint256 usdSale, uint256 bnbSale)
        private
        pure
        returns (bool)
    {
        return twap >= bnbSale * m / 100 && twap * rate / 1e18 >= usdSale * m / 100;
    }

    /// @notice The vault's ERC-8004 feedback call (runs in the vault's context: a linked library is delegatecalled), in
    ///         try/catch so a broken registry never blocks a rule. Tag "covenant", URI covenant:<chainId>:<vault>.
    /// @return ok whether the registry accepted it
    function giveFeedback(address rep, uint256 id, int128 value, string memory outcome, bytes32 h, uint256 gas)
        public
        returns (bool ok)
    {
        string memory uri = outcomeUri(address(this));
        try IERC8004Reputation(rep).giveFeedback{gas: gas}(id, value, 0, "covenant", outcome, "", uri, h) {
            ok = true;
        } catch {}
    }

    /// @notice Sale tokens no claim can reach: what is left of A beyond an upper bound on the allocations still
    ///         unclaimed, sum(a_i) <= A * (C - claimed commitments) / C, rounded up. Tokens 18 decimals, BNB in wei.
    /// @param saleAmount A
    /// @param gone tokens already claimed or burned
    /// @param committed C
    /// @param claimedCommitments the commitments of every account that has claimed
    function saleDust(uint256 saleAmount, uint256 gone, uint256 committed, uint256 claimedCommitments)
        public
        pure
        returns (uint256)
    {
        uint256 owed;
        if (committed > 0) {
            uint256 x = saleAmount * (committed - claimedCommitments);
            owed = x == 0 ? 0 : (x - 1) / committed + 1;
        }
        uint256 left = saleAmount - gone;
        return left > owed ? left - owed : 0;
    }

    /// @notice The feedback URI a vault writes to the issuer's ERC-8004 record: covenant:<chainId>:<vault>.
    /// @param vault the vault writing the record
    function outcomeUri(address vault) public view returns (string memory) {
        return string.concat("covenant:", LibString.toString(block.chainid), ":", LibString.toHexString(vault));
    }

    function schema() public pure returns (VaultUISchema memory s) {
        s.vaultType = "CovenantVault";
        s.description =
            "Treasury of a Covenant raise. Claim your sale tokens, redeem at book value during an exit round or after wind-down, release unlocked team tokens, or declare abandonment once the team or agent has been silent past its heartbeat.";
        s.methods = new VaultMethodSchema[](10);
        s.methods[0] =
            _view("bookValue", "Treasury BNB per redeemable token (after tap owed to the team)", "bookValue", 18);
        s.methods[1] =
            _view("state", "0 RAISING, 1 FAILED, 2 ACTIVE, 3 EXIT_ROUND, 4 COOLDOWN, 5 WIND_DOWN", "state", 0);
        s.methods[2] = _view("redeemableSupply", "Supply less burned and locked team tokens", "supply", 18);
        s.methods[3] = _view("owedTeam", "Tap accrued to the team and not yet claimed", "bnb", 18);
        s.methods[4] = _view("exitStreak", "Seconds below book counted toward the next exit round", "seconds", 0);
        s.methods[5] = _write("claimTokens", "Withdraw your sale tokens from the Token Dock (once).");

        VaultMethodSchema memory r;
        r.name = "redeem";
        r.description =
        "Burn tokens for their share of the treasury. Exit rounds (less the exit fee) and wind-down only.";
        r.inputs = new FieldDescriptor[](2);
        r.inputs[0] = FieldDescriptor("amount", "uint256", "Tokens to burn", 18);
        r.inputs[1] = FieldDescriptor("minOut", "uint256", "Least BNB to accept", 18);
        r.approvals = new ApproveAction[](1);
        r.approvals[0] = ApproveAction("taxToken", "amount");
        r.isWriteMethod = true;
        s.methods[6] = r;

        s.methods[7] = _write("releaseTeam", "Send unlocked team tranches to the team wallet.");
        s.methods[8] = _write(
            "declareAbandoned", "Open the treasury to holders once the team or agent has stopped (heartbeat lapsed)."
        );
        s.methods[9] = _write("sync", "Recognize revenue that arrived without a call.");
    }

    function _view(string memory name, string memory desc, string memory out, uint8 dec)
        private
        pure
        returns (VaultMethodSchema memory m)
    {
        m.name = name;
        m.description = desc;
        m.outputs = new FieldDescriptor[](1);
        m.outputs[0] = FieldDescriptor(out, "uint256", desc, dec);
    }

    function _write(string memory name, string memory desc) private pure returns (VaultMethodSchema memory m) {
        m.name = name;
        m.description = desc;
        m.isWriteMethod = true;
    }
}
