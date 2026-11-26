// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LibString} from "solady/utils/LibString.sol";
import {
    VaultUISchema, VaultMethodSchema, FieldDescriptor, ApproveAction
} from "src/flap/IVaultSchemas.sol";
import {State} from "src/vault/CovenantTypes.sol";

/// @notice Flap's two mandatory vault surfaces, kept out of the vault's own code: the disclosure string
///         `description()` and the `vaultUISchema()` Flap.sh renders its interaction panel from.
/// @dev Public library functions run by DELEGATECALL from the vault, so the vault stays under the size limit.
library CovenantVaultDisplay {
    using LibString for uint256;

    struct Snapshot {
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
    ///   Team tokens: 250000000 locked, unlock at 2x, 4x, 8x of the sale price. Sale buyers claim 600000000 tokens
    ///   pro rata. Exit fee 1%, kept by the treasury.
    function describe(Snapshot memory s) public pure returns (string memory) {
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
            " BNB claimable. "
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
            ", kept by the treasury; none at wind-down. No Covenant admin keys; Flap's Guardian can upgrade."
        );
        return string.concat(head, team, tokens);
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

    function schema() public pure returns (VaultUISchema memory s) {
        s.vaultType = "CovenantVault";
        s.description =
            "Treasury of a Covenant raise. Claim your sale tokens, redeem at book value during an exit round or after wind-down, release unlocked team tokens, or declare abandonment once the team has been silent past its heartbeat.";
        s.methods = new VaultMethodSchema[](10);
        s.methods[0] = _view("bookValue", "Treasury BNB per redeemable token (after tap owed to the team)", "bookValue", 18);
        s.methods[1] = _view("state", "0 RAISING, 1 FAILED, 2 ACTIVE, 3 EXIT_ROUND, 4 COOLDOWN, 5 WIND_DOWN", "state", 0);
        s.methods[2] = _view("redeemableSupply", "Supply less burned and locked team tokens", "supply", 18);
        s.methods[3] = _view("tapAccrued", "Tap accrued to the team and not yet claimed", "bnb", 18);
        s.methods[4] = _view("exitStreak", "Seconds below book counted toward the next exit round", "seconds", 0);
        s.methods[5] = _write("claimTokens", "Withdraw your sale tokens from the Token Dock (once).");

        VaultMethodSchema memory r;
        r.name = "redeem";
        r.description = "Burn tokens for their share of the treasury. Exit rounds (less the exit fee) and wind-down only.";
        r.inputs = new FieldDescriptor[](2);
        r.inputs[0] = FieldDescriptor("amount", "uint256", "Tokens to burn", 18);
        r.inputs[1] = FieldDescriptor("minOut", "uint256", "Least BNB to accept", 18);
        r.approvals = new ApproveAction[](1);
        r.approvals[0] = ApproveAction("taxToken", "amount");
        r.isWriteMethod = true;
        s.methods[6] = r;

        s.methods[7] = _write("releaseTeam", "Send unlocked team tranches to the team wallet.");
        s.methods[8] = _write("declareAbandoned", "Open the treasury to holders once the team's heartbeat has lapsed.");
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
