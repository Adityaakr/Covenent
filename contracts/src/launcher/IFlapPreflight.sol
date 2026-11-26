// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Read-only Flap calls the launcher factory makes before a raise opens, so terms that Flap's launch would
///         refuse are refused at creation instead of after the money is raised.
/// @dev Kept outside `src/flap/`, which holds Flap's immutable specification unchanged. Shapes match the live
///      contracts on BNB Chain and BNB testnet (read 26 Nov 2026) and Flap's own `IPortalLaunchFloor` in
///      flap-sh/FlapPoolLaunchVaultExample (branch fix/example-spec-alignment, `src/common/IPortalLaunchFloor.sol`).
interface IFlapLaunchFloor {
    struct GraduationFloorParams {
        address quoteToken;
        uint256 quotePriceUsd;
        uint256 poolQuote;
        uint256 poolToken;
        uint256 totalSupply;
        address vaultFactory;
    }

    /// @dev `meetsCreateFloor` is the creation gate (below it `launchTaxTokenV2` reverts); `meetsFloor` is the
    ///      graduation floor, twice the creation floor, at which the token is marked graduated in the launch
    ///      transaction. Both floors scale with totalSupply / poolToken and with the factory multiplier.
    struct GraduationFloorResultV2 {
        bool meetsFloor;
        uint256 floorUsdWad;
        uint256 quoteUsdWad;
        uint16 multiplierBps;
        bool meetsCreateFloor;
        uint256 createFloorUsdWad;
    }

    /// @notice Whether (kind, quote) launches are enabled and the quote price in USD (1e18) the floors use.
    function launchQuoteConfig(uint8 kind, address quoteToken)
        external
        view
        returns (bool enabled, uint256 quotePriceUsd);

    /// @notice Preview a launch's floors. With `vaultFactory` set, that enabled vault factory's multiplier applies,
    ///         which is the multiplier a launch through it uses.
    function graduationFloorV2(GraduationFloorParams calldata params)
        external
        view
        returns (GraduationFloorResultV2 memory);
}

/// @notice Flap's name and symbol blocklist. The Portal's launch facet calls it inside `launchTaxTokenV2` and reverts
///         `BlacklistedNameOrSymbol(string)` when either flag is true. Matching is exact and case-insensitive. On
///         26 Nov 2026 BNB, USDT and USDC were blocked on both chains, ETH and BTC on BNB testnet only; Flap edits
///         the list, so the factory asks it live.
/// @dev The Portal does not expose the address: it is an immutable of the launch facet. BNB Chain
///      `0xfFb69d59f62454f3B8322Bc1a9FCE6E171a5264f`, BNB testnet `0x5CfbE713d070e87F67D1bc84312B7eB8Fe4F2B5E`, both
///      upgradeable proxies (read from launch traces on forks of each chain, 26 Nov 2026).
interface IFlapNameScreen {
    function isScamWord(string calldata name, string calldata symbol)
        external
        view
        returns (bool nameBlocked, bool symbolBlocked);
}
