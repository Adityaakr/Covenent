// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CovenantTestBase} from "test/utils/CovenantTestBase.sol";
import {Observation, State} from "src/vault/CovenantTypes.sol";
import {CovenantLauncher} from "src/launcher/CovenantLauncher.sol";
import {CovenantVault} from "src/vault/CovenantVault.sol";
import {CovenantOracle} from "src/oracle/CovenantOracle.sol";
import {IPullOracleBase} from "src/vendor/atlas/interfaces/IPullOracleBase.sol";
import {IPullOracleReferenceHooks} from "src/vendor/atlas/interfaces/IPullOracleReferenceHooks.sol";
import {MockAggregator} from "src/mocks/MockERC8004.sol";

/// @notice A vault that records the last observation it was sent, to read the oracle's output directly.
contract ObservationSink {
    address public pair;
    address public token;
    uint256 public seed;
    uint32 public gap;
    Observation public last;
    uint256 public count;

    constructor(address pair_, address token_, uint256 seed_, uint32 gap_) {
        pair = pair_;
        token = token_;
        seed = seed_;
        gap = gap_;
    }

    function oracleConfig() external view returns (address, address, uint256, uint32, bool) {
        return (pair, token, seed, gap, true);
    }

    function onObservation(Observation calldata o) external {
        last = o;
        ++count;
    }

    function lastObservation() external view returns (Observation memory) {
        return last;
    }
}

/// @notice Atlas report fixtures (signature, staleness, drift, replay), the push-feed fallback, the TWAP and the
///         trust gate, one condition at a time.
contract OracleTest is CovenantTestBase {
    CovenantLauncher internal l;
    CovenantVault internal v;
    IERC20 internal token;
    ObservationSink internal sink;

    function setUp() public override {
        super.setUp();
        (l, v, token) = _launchDefault("oracle");
        _claimAll(l, v);
        sink = new ObservationSink(v.pair(), address(token), v.poolSeedQuote(), 1 hours);
        vm.warp(block.timestamp + 601);
    }

    function _pokeSink(uint256 signerKey, uint256 price, uint256 ts) internal returns (bool ok, bytes memory ret) {
        bytes memory data = abi.encodeCall(CovenantOracle.poke, (address(sink)));
        if (price > 0) data = abi.encodePacked(data, _atlasPayload(signerKey, DEV_BNB_USD_FEED, price, ts));
        (ok, ret) = address(oracle).call(data);
    }

    function _last() internal view returns (Observation memory o) {
        o = sink.lastObservation();
    }

    // ── Atlas pull reports ─────────────────────────────────────────────────

    function test_validReport_isVerified_andStrict() public {
        (bool ok,) = _pokeSink(atlasKey, 612.5 ether, block.timestamp);
        assertTrue(ok);
        Observation memory o = _last();
        assertTrue(o.atlas);
        assertEq(o.bnbUsd, 612.5 ether);
        assertTrue(o.deep);
        assertTrue(o.strict, "the first poke may be strict (sets the dollar sale price)");
        assertFalse(o.trusted, "but has no interval yet");
        (,,, uint64 atlasTs,,) = _point(address(sink));
        assertEq(atlasTs, block.timestamp);
    }

    function test_reportFromAnotherSigner_reverts() public {
        uint256 otherKey = 0xBAD;
        (bool ok, bytes memory ret) = _pokeSink(otherKey, 600 ether, block.timestamp);
        assertFalse(ok);
        assertEq(bytes4(ret), IPullOracleBase.UnauthorizedSigner.selector);
    }

    function test_staleReport_reverts() public {
        (bool ok, bytes memory ret) = _pokeSink(atlasKey, 600 ether, block.timestamp - 181);
        assertFalse(ok);
        assertEq(bytes4(ret), IPullOracleReferenceHooks.PriceFeedExpired.selector, "older than 180 s");
        (ok,) = _pokeSink(atlasKey, 600 ether, block.timestamp - 180);
        assertTrue(ok, "exactly 180 s is accepted");
    }

    function test_futureReport_reverts() public {
        (bool ok, bytes memory ret) = _pokeSink(atlasKey, 600 ether, block.timestamp + 61);
        assertFalse(ok);
        assertEq(bytes4(ret), IPullOracleReferenceHooks.PriceFeedFutureDrift.selector, "more than 60 s ahead");
    }

    /// @dev A signed report can be replayed inside its freshness window; the oracle keeps per-vault timestamps
    ///      monotonic so a newer report can never be replaced by an older one.
    function test_olderReportThanTheLastAccepted_reverts() public {
        // A vault with no poke gap, so two pokes fit inside one 180 s freshness window.
        ObservationSink fast = new ObservationSink(v.pair(), address(token), v.poolSeedQuote(), 0);
        bytes memory d1 = abi.encodePacked(
            abi.encodeCall(CovenantOracle.poke, (address(fast))),
            _atlasPayload(atlasKey, DEV_BNB_USD_FEED, 600 ether, block.timestamp)
        );
        (bool ok,) = address(oracle).call(d1);
        assertTrue(ok);
        vm.warp(block.timestamp + 30);
        // Still fresh (31 s old), but older than the report this vault already accepted.
        bytes memory d2 = abi.encodePacked(
            abi.encodeCall(CovenantOracle.poke, (address(fast))),
            _atlasPayload(atlasKey, DEV_BNB_USD_FEED, 590 ether, block.timestamp - 31)
        );
        (bool ok2, bytes memory ret) = address(oracle).call(d2);
        assertFalse(ok2);
        assertEq(bytes4(ret), CovenantOracle.ReplayedReport.selector);
    }

    function test_reportWithoutTheBnbUsdFeed_reverts() public {
        bytes memory data = abi.encodePacked(
            abi.encodeCall(CovenantOracle.poke, (address(sink))),
            _atlasPayload(atlasKey, 0x00000099, 600 ether, block.timestamp)
        );
        (bool ok, bytes memory ret) = address(oracle).call(data);
        assertFalse(ok);
        assertEq(bytes4(ret), IPullOracleBase.UnmatchedFeedID.selector);
    }

    function test_garbageTrailingData_reverts() public {
        bytes memory data = abi.encodePacked(abi.encodeCall(CovenantOracle.poke, (address(sink))), hex"deadbeef");
        (bool ok,) = address(oracle).call(data);
        assertFalse(ok);
    }

    function test_noReport_isTrustedForTheExit_butNotStrict() public {
        (bool ok,) = _pokeSink(0, 0, 0);
        assertTrue(ok);
        vm.warp(block.timestamp + 1 hours);
        (ok,) = _pokeSink(0, 0, 0);
        assertTrue(ok);
        Observation memory o = _last();
        assertFalse(o.atlas);
        assertEq(o.bnbUsd, 0);
        assertTrue(o.trusted, "on-chain TWAP only: counts for the exit");
        assertFalse(o.strict);
    }

    // ── push feed fallback ─────────────────────────────────────────────────

    function test_pushFeed_isTheFallbackWhenNoPullReportRides() public {
        MockAggregator feed = new MockAggregator(8);
        CovenantOracle o2 = new CovenantOracle(DEV_BNB_USD_FEED, atlasSigner, address(feed), 1 hours);
        ObservationSink s2 = new ObservationSink(v.pair(), address(token), v.poolSeedQuote(), 1 hours);

        feed.set(601_25000000, block.timestamp - 10 minutes);
        o2.poke(address(s2));
        Observation memory ob = s2.lastObservation();
        assertTrue(ob.atlas);
        assertEq(ob.bnbUsd, 601.25 ether, "8 decimals scaled to 18");

        vm.warp(block.timestamp + 2 hours);
        o2.poke(address(s2));
        assertFalse(s2.lastObservation().atlas, "a push answer older than its max age does not count");

        feed.set(-1, block.timestamp);
        vm.warp(block.timestamp + 1 hours);
        o2.poke(address(s2));
        assertFalse(s2.lastObservation().atlas, "a non-positive answer does not count");
    }

    // ── TWAP and the gate ──────────────────────────────────────────────────

    function test_secondPokeWithinTheGap_reverts() public {
        _poke(v, BNB_USD);
        vm.warp(block.timestamp + 59 minutes);
        vm.expectRevert(abi.encodeWithSelector(CovenantOracle.TooSoon.selector, block.timestamp + 1 minutes));
        _poke(v, BNB_USD);
        assertEq(oracle.nextPokeAt(address(v)), block.timestamp + 1 minutes);
    }

    function test_twap_isTheTimeWeightedAverage() public {
        (bool ok,) = _pokeSink(0, 0, 0);
        assertTrue(ok);
        uint256 p0 = _spot(v);
        vm.warp(block.timestamp + 30 minutes);
        _sell(token, whale, 100_000_000 ether);
        uint256 p1 = _spot(v);
        vm.warp(block.timestamp + 30 minutes);
        (ok,) = _pokeSink(0, 0, 0);
        assertTrue(ok);
        Observation memory o = _last();
        assertEq(o.elapsed, 1 hours);
        assertApproxEqRel(o.twapBnb, (p0 + p1) / 2, 1e12, "half the hour at each price");
        assertEq(o.spotBnb, p1);
    }

    /// @dev A flash loan cannot move it: a price moved and restored inside one block never enters the cumulative.
    function test_twap_ignoresAMoveUndoneInTheSameBlock() public {
        (bool ok,) = _pokeSink(0, 0, 0);
        assertTrue(ok);
        uint256 p0 = _spot(v);
        vm.warp(block.timestamp + 1 hours);
        _sell(token, whale, 200_000_000 ether); // crash...
        _buy(token, whale, 40 ether); // ...and undo it in the same block
        (ok,) = _pokeSink(0, 0, 0);
        assertTrue(ok);
        assertApproxEqRel(_last().twapBnb, p0, 1e12, "the TWAP saw only the price that survived blocks");
    }

    function test_depthGate_followsThePoolsBnbReserve() public {
        (bool ok,) = _pokeSink(atlasKey, BNB_USD, block.timestamp);
        assertTrue(ok);
        assertTrue(_last().deep);
        _sell(token, whale, token.balanceOf(whale));
        vm.warp(block.timestamp + 1 hours);
        (ok,) = _pokeSink(atlasKey, BNB_USD, block.timestamp);
        assertTrue(ok);
        Observation memory o = _last();
        assertFalse(o.deep, "under half the seed");
        assertTrue(o.atlas);
        assertFalse(o.strict, "depth guards the team's rules");
        assertTrue(o.trusted, "not the holders' exit");
    }

    function test_aFakeVault_cannotTouchARealVaultsPoint() public {
        _poke(v, BNB_USD);
        (uint256 cum, uint32 ts,,,,) = _point(address(v));
        ObservationSink fake = new ObservationSink(v.pair(), address(token), 0, 0);
        oracle.poke(address(fake));
        vm.warp(block.timestamp + 10);
        oracle.poke(address(fake));
        (uint256 cum2, uint32 ts2,,,,) = _point(address(v));
        assertEq(cum2, cum);
        assertEq(ts2, ts);
    }

    function test_unlaunchedVault_isNotLive() public {
        CovenantLauncher l2 = _create(prod, _terms("not-live"));
        l2;
        ObservationSink dead = new ObservationSink(address(0), address(token), 0, 0);
        vm.expectRevert(abi.encodeWithSelector(CovenantOracle.NotLive.selector, address(dead)));
        oracle.poke(address(dead));
    }

    function test_constructor_rejectsAZeroSigner() public {
        vm.expectRevert(CovenantOracle.ZeroSigner.selector);
        new CovenantOracle(DEV_BNB_USD_FEED, address(0), address(0), 0);
    }

    function _point(address vault)
        internal
        view
        returns (uint256 cum, uint32 ts, uint64 pokedAt, uint64 atlasTs, bool init, uint256 dummy)
    {
        (cum, ts, atlasTs, pokedAt, init) = oracle.points(vault);
        dummy = 0;
    }
}
