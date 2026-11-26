// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice One numbering for the six covenant states. The launcher reports RAISING, FAILED or ACTIVE (launched);
///         the vault reports ACTIVE, EXIT_ROUND, COOLDOWN or WIND_DOWN. FAILED and WIND_DOWN are terminal.
enum State {
    RAISING,
    FAILED,
    ACTIVE,
    EXIT_ROUND,
    COOLDOWN,
    WIND_DOWN
}

/// @notice The covenant's terms. Set once in `Portal.newLauncher`, stored in the launcher and copied into the
///         vault at launch. Nothing can be edited later except lowering the tap.
struct Terms {
    // token and raise
    string name;
    string symbol;
    string meta;
    bytes32 salt; // mined so the token address ends in 0x7777
    uint256 totalSupply; // 18 decimals, a multiple of 10_000 so every bps split is exact
    uint16 saleBps; // A / S
    uint16 poolBps; // P / S, must be <= saleBps
    uint16[] trancheBps; // team tranches, sum = 10000 - saleBps - poolBps
    uint16[] trancheMultiple; // 200 = 2x the sale price in dollars
    uint256 minRaise;
    uint256 cap;
    uint32 saleDuration;
    // trading tax
    uint16 buyTaxBps;
    uint16 sellTaxBps;
    uint32 taxDuration;
    // rule 1: tap
    address teamWallet;
    uint256 tapUsdPer30d; // 18 decimals
    uint16 tapCapBps; // share of the treasury per 30 days
    // rule 2: unlock
    uint32 cliff;
    uint32 unlockWindow;
    // rule 3: exit
    uint32 exitStreak;
    uint32 roundLength;
    uint32 cooldown;
    uint16 exitFeeBps;
    // rule 4: abandonment
    uint32 heartbeat;
    // agent layer: ERC-8004 identity of the issuer, 0 for a human team
    uint256 agentId;
    // rule 5 (stretch): the relayer that records disclosure verdicts, 0 disables rule 5
    address reportRelayer;
}

/// @notice Time and size bounds of one launcher factory. The production factory and the short-timer demo factory
///         differ only in this struct. The oracle timing (`minPokeGap`, `maxStep`, `staleAfter`) is copied into
///         every vault, so one oracle serves both.
struct Profile {
    uint32 minSaleDuration;
    uint32 maxSaleDuration;
    uint32 minExitStreak;
    uint32 maxExitStreak;
    uint32 minRoundLength;
    uint32 minCooldown;
    uint32 minHeartbeat;
    uint32 maxHeartbeat;
    uint32 minUnlockWindow;
    uint32 maxCliff;
    uint32 minPokeGap; // the oracle refuses a second poke of a vault within this time
    uint32 maxStep; // the most time one observation can add to any counter or to the tap
    uint32 staleAfter; // with no strict observation ever, the tap falls back to its cap after this long
    uint32 antiFarmerDuration; // passed to Flap's launch
    uint256 minPoolQuote; // guard against Flap's creation floor (LaunchLiquidityTooLow)
}

/// @notice One observation the oracle sends to a vault.
/// @dev Exit-rule fixes: `trusted` only says the pool TWAP is valid (on-chain numbers only). The exit streak runs on
///      every trusted observation, with or without Atlas and whatever the pool depth. `strict` additionally needs a
///      verified, fresh BNB/USD rate and a pool holding at least half its launch seed; only strict observations move
///      the unlock counters and price the dollar tap.
struct Observation {
    uint32 elapsed; // seconds since this vault's previous observation (0 on the first)
    uint256 twapBnb; // average pool price over that interval, BNB per token, 1e18
    uint256 bnbUsd; // verified BNB/USD, 1e18, 0 when no Atlas rate rode along
    bool trusted; // TWAP valid: counts for the exit streak
    bool strict; // atlas && deep: counts for unlock and the tap rate
    bool atlas; // a verified, fresh BNB/USD rate is attached (pull report or push feed)
    bool deep; // the pool's BNB reserve is at least half of its launch seed
    uint256 spotBnb; // pool spot price at poke time, BNB per token, 1e18 (display only)
}

/// @notice Addresses every vault of one vault factory shares. Fixed at factory construction.
struct VaultEnv {
    address hub; // Flap Direct Launch Portal
    address guardian; // Flap Guardian: the only upgrade authority
    address dockRouter; // Flap TokenDockRouter
    address oracle; // CovenantOracle, the only caller of onObservation
    address reputation; // ERC-8004 ReputationRegistry, 0 to skip outcome records
    address identity; // ERC-8004 IdentityRegistry, read for display only
}

/// @notice What a vault reads from its launcher at launch.
interface ICovenantLauncher {
    function terms() external view returns (Terms memory);
    function profile() external view returns (Profile memory);
    function launching() external view returns (bool);
    function state() external view returns (State);
    function accepted() external view returns (uint256);
    function poolQuote() external view returns (uint256);
    function committed() external view returns (uint256);
    function acceptedOf(address account) external view returns (uint256);
    function allocationOf(address account) external view returns (uint256);
    function contributions(address account) external view returns (uint256);
    function saleDeadline() external view returns (uint64);
    function creator() external view returns (address);
    function token() external view returns (address);
    function vault() external view returns (address);
    function pool() external view returns (address);
    function saleAmount() external view returns (uint256);
    function poolAmount() external view returns (uint256);
    function teamAmount() external view returns (uint256);
}

/// @notice The vault surface the oracle uses.
interface ICovenantVaultOracle {
    /// @return pair the PancakeSwap V2 pair, token the launch token, seedQuote the BNB the pool was seeded with,
    ///         minPokeGap the minimum time between pokes, live whether the vault is funded and observable
    function oracleConfig()
        external
        view
        returns (address pair, address token, uint256 seedQuote, uint32 minPokeGap, bool live);

    function onObservation(Observation calldata o) external;
}

library CovenantMath {
    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant PERIOD = 30 days;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
