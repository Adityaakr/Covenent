// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PullOracleConsumerStandard} from "src/vendor/atlas/PullOracleConsumerStandard.sol";

import {Observation, ICovenantVaultOracle} from "src/vault/CovenantTypes.sol";
import {PairTwap} from "src/oracle/PairTwap.sol";

/// @notice Chainlink AggregatorV3 surface of an Atlas push feed (single-feed contracts are Chainlink compatible).
interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title CovenantOracle
/// @notice Singleton with no owner. Each `poke(vault)` reads the vault's PancakeSwap V2 pair, computes the
///         time-weighted price since that vault's previous poke, verifies an Atlas BNB/USD rate if one rides along,
///         applies the trust gate and sends one `Observation` to the vault.
///
///         Atlas pull mode: the keeper's SDK appends a signed report to the calldata of `poke(vault)`. The vendored
///         Atlas consumer verifies the signer and freshness (max 180 s old, 60 s future drift); this contract adds a
///         per-vault monotonic timestamp so a report cannot be replayed inside its freshness window.
///         Fallback ladder: pull report, else the push feed if configured and fresh, else no rate.
///
///         Trust gate, with the three exit-rule fixes:
///           trusted = the pool TWAP is valid. That is all the exit streak needs: pool price and book value are
///                     both on-chain, so the exit works with no Atlas report and in a pool of any depth.
///           strict  = trusted-or-first AND a verified fresh BNB/USD AND the pool's BNB reserve is at least half its
///                     launch seed. Only strict observations price the dollar tap and move the unlock counters.
///         Atlas status (Consensus Score) is not readable on-chain yet, so it is not part of the gate.
contract CovenantOracle is PullOracleConsumerStandard {
    /// @notice Atlas feed id of BNB/USD, from Atlas onboarding.
    bytes4 public immutable BNB_USD_FEED;
    /// @notice The only address whose signed reports verify. Atlas's production signer on BNB Chain is
    ///         0x59eD4701224fD9e2a85Ef2946c2ab828C1dDC600; local and fork stacks use a dev signer.
    address public immutable ATLAS_SIGNER;
    /// @notice Optional Atlas push feed (Chainlink-compatible) used when no pull report is attached. 0 = none.
    address public immutable PUSH_FEED;
    uint256 public immutable PUSH_MAX_AGE;
    uint8 internal immutable PUSH_DECIMALS;

    struct Point {
        uint256 cumulative;
        uint32 timestamp;
        uint64 atlasTimestamp; // last Atlas timestamp accepted for this vault
        uint64 pokedAt;
        bool initialized;
    }

    mapping(address vault => Point) public points;

    event Poked(
        address indexed vault,
        address indexed caller,
        uint256 twapBnb,
        uint256 spotBnb,
        uint256 bnbUsd,
        uint32 elapsed,
        bool trusted,
        bool strict
    );

    error ZeroSigner();
    error NotLive(address vault);
    error TooSoon(uint256 nextAt);
    error ReplayedReport(uint256 reportTs, uint256 lastTs);

    constructor(bytes4 bnbUsdFeed, address atlasSigner, address pushFeed, uint256 pushMaxAge) {
        if (atlasSigner == address(0)) revert ZeroSigner();
        BNB_USD_FEED = bnbUsdFeed;
        ATLAS_SIGNER = atlasSigner;
        PUSH_FEED = pushFeed;
        PUSH_MAX_AGE = pushMaxAge;
        uint8 dec = 18;
        if (pushFeed != address(0)) {
            try IAggregatorV3(pushFeed).decimals() returns (uint8 d) {
                dec = d;
            } catch {}
        }
        PUSH_DECIMALS = dec;
    }

    /// @dev Pull mode trusts exactly one signer, fixed at deployment. No owner can rotate it.
    function _isAuthorizedSigner(address recoveredSigner) internal view override returns (bool) {
        return recoveredSigner == ATLAS_SIGNER;
    }

    /// @notice Record one observation for `vault`. Anyone may call; at most once per the vault's poke gap.
    ///         A signed Atlas report may be appended to the calldata.
    function poke(address vault) external returns (Observation memory o) {
        o = _observe(vault);
        emit Poked(vault, msg.sender, o.twapBnb, o.spotBnb, o.bnbUsd, o.elapsed, o.trusted, o.strict);
        ICovenantVaultOracle(vault).onObservation(o);
    }

    /// @dev Reads the pair and the Atlas rate, applies the gate and stores the vault's new point.
    function _observe(address vault) internal returns (Observation memory o) {
        (address pair, address token, uint256 seed, uint32 minGap, bool live) =
            ICovenantVaultOracle(vault).oracleConfig();
        if (!live || pair == address(0)) revert NotLive(vault);

        Point memory pt = points[vault];
        PairTwap.Reading memory r = PairTwap.read(pair, token);

        if (pt.initialized) {
            uint32 elapsed;
            unchecked {
                elapsed = r.timestamp - pt.timestamp;
            }
            if (elapsed < minGap) revert TooSoon(uint256(pt.pokedAt) + minGap);
            o.elapsed = elapsed;
            o.twapBnb = PairTwap.average(pt.cumulative, r.cumulative, elapsed);
            o.trusted = o.twapBnb > 0;
        }
        o.spotBnb = PairTwap.spot(r);
        o.deep = r.quoteReserve * 2 >= seed;

        uint64 ts;
        (o.atlas, o.bnbUsd, ts) = _readBnbUsd();
        if (o.atlas) {
            if (ts < pt.atlasTimestamp) revert ReplayedReport(ts, pt.atlasTimestamp);
            pt.atlasTimestamp = ts;
        }
        o.strict = o.atlas && o.deep && (o.trusted || !pt.initialized);

        pt.cumulative = r.cumulative;
        pt.timestamp = r.timestamp;
        pt.pokedAt = uint64(block.timestamp);
        pt.initialized = true;
        points[vault] = pt;
    }

    /// @notice The earliest time `vault` can be poked again (0 if never poked).
    function nextPokeAt(address vault) external view returns (uint256) {
        Point memory pt = points[vault];
        if (!pt.initialized) return 0;
        (,,, uint32 minGap,) = ICovenantVaultOracle(vault).oracleConfig();
        return uint256(pt.pokedAt) + minGap;
    }

    /// @notice What a poke would see right now, without an Atlas rate: TWAP since the last poke, spot, depth.
    function preview(address vault)
        external
        view
        returns (uint256 twapBnb, uint256 spotBnb, uint32 elapsed, bool deep, uint256 quoteReserve)
    {
        (address pair, address token, uint256 seed,,) = ICovenantVaultOracle(vault).oracleConfig();
        PairTwap.Reading memory r = PairTwap.read(pair, token);
        Point memory pt = points[vault];
        if (pt.initialized) {
            unchecked {
                elapsed = r.timestamp - pt.timestamp;
            }
            twapBnb = PairTwap.average(pt.cumulative, r.cumulative, elapsed);
        }
        spotBnb = PairTwap.spot(r);
        deep = r.quoteReserve * 2 >= seed;
        quoteReserve = r.quoteReserve;
    }

    /// @dev Pull report first (the signed payload trails the 36 bytes of `poke(address)`), push feed second.
    function _readBnbUsd() internal view returns (bool ok, uint256 price, uint64 ts) {
        if (msg.data.length > 36) {
            (uint256 p, uint256 t) = _getVerifiedFeedData(BNB_USD_FEED);
            if (p == 0) return (false, 0, 0);
            return (true, p, uint64(t));
        }
        address feed = PUSH_FEED;
        if (feed == address(0)) return (false, 0, 0);
        try IAggregatorV3(feed).latestRoundData() returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80) {
            if (answer <= 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > PUSH_MAX_AGE) {
                return (false, 0, 0);
            }
            uint256 a = uint256(answer);
            uint8 d = PUSH_DECIMALS;
            price = d <= 18 ? a * 10 ** (18 - d) : a / 10 ** (d - 18);
            return (true, price, uint64(updatedAt));
        } catch {
            return (false, 0, 0);
        }
    }
}
