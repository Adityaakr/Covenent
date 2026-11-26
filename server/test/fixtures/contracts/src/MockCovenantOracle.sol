// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {MockCovenantVault} from "./MockCovenantVault.sol";

interface IPairLike {
    function token0() external view returns (address);
    function getReserves() external view returns (uint112, uint112, uint32);
    function price0CumulativeLast() external view returns (uint256);
    function price1CumulativeLast() external view returns (uint256);
}

/// Fake-chain stand-in for CovenantOracle. It verifies the Atlas pull report riding in trailing
/// calldata in exactly the byte layout of oracle-atlas/pull-oracle-consumer
/// ([packages: feedId u32 | value u80 | ts u48]... [count u8] [sig 65] [marker 0x7096]),
/// signature over keccak256(packages ++ count) with no EIP-191 prefix.
/// A missing or bad report makes the observation untrusted; it never blocks the poke, because the
/// exit step needs no oracle (fix 3).
contract MockCovenantOracle {
    struct VaultCfg {
        address pair;
        address quote;
        uint256 seedBnb;
        uint256 lastCum;
        uint256 lastTs;
        uint256 lastAtlasTs;
    }

    bytes4 public immutable bnbUsdFeed;
    address public immutable atlasSigner;
    uint256 public immutable minInterval;
    uint256 public constant MAX_DELAY = 180;
    uint256 public constant MAX_FUTURE_DRIFT = 60;

    mapping(address => VaultCfg) public cfg;
    mapping(address => uint256) public lastPokeAt;

    event Poked(address indexed vault, uint256 twapBnb, uint256 bnbUsd, bool trusted, bool strict);

    error TooSoon();
    error UnknownVault();

    constructor(bytes4 feed, address signer, uint256 interval) {
        bnbUsdFeed = feed;
        atlasSigner = signer;
        minInterval = interval;
    }

    function register(address vault, address pair, address quote, uint256 seedBnb) external {
        cfg[vault] = VaultCfg(pair, quote, seedBnb, 0, 0, 0);
    }

    function poke(address vault) external {
        VaultCfg storage c = cfg[vault];
        if (c.pair == address(0)) revert UnknownVault();
        if (lastPokeAt[vault] != 0 && block.timestamp < lastPokeAt[vault] + minInterval) revert TooSoon();

        (uint256 bnbUsd, uint256 atlasTs, bool atlasOk) = _readAtlas();
        if (atlasOk && atlasTs < c.lastAtlasTs) atlasOk = false; // monotonic timestamps
        if (atlasOk) c.lastAtlasTs = atlasTs;

        (uint256 cum, uint256 spot, uint256 reserveBnb) = _cumulative(c);
        uint256 twap;
        uint256 elapsed;
        if (c.lastTs == 0 || block.timestamp == c.lastTs) {
            twap = spot;
            elapsed = 0;
        } else {
            elapsed = block.timestamp - c.lastTs;
            twap = ((cum - c.lastCum) / elapsed) * 1e18 >> 112;
        }
        c.lastCum = cum;
        c.lastTs = block.timestamp;
        lastPokeAt[vault] = block.timestamp;

        bool trusted = atlasOk;
        // Fix 2: pool depth guards the strict gate (tap rate, unlocks) only.
        bool strict = atlasOk && reserveBnb * 2 >= c.seedBnb;
        MockCovenantVault(payable(vault)).onObservation(
            MockCovenantVault.Observation(uint32(elapsed), twap, atlasOk ? bnbUsd : 0, trusted, strict)
        );
        emit Poked(vault, twap, bnbUsd, trusted, strict);
    }

    function _cumulative(VaultCfg storage c) internal view returns (uint256 cum, uint256 spot, uint256 reserveBnb) {
        IPairLike p = IPairLike(c.pair);
        (uint112 r0, uint112 r1, uint32 ts) = p.getReserves();
        bool quoteIs0 = p.token0() == c.quote;
        // price of the covenant token in BNB, UQ112x112
        uint256 px = quoteIs0 ? (uint256(r0) << 112) / r1 : (uint256(r1) << 112) / r0;
        cum = quoteIs0 ? p.price1CumulativeLast() : p.price0CumulativeLast();
        cum += px * (block.timestamp - ts);
        spot = px * 1e18 >> 112;
        reserveBnb = quoteIs0 ? r0 : r1;
    }

    function _readAtlas() internal view returns (uint256 price, uint256 ts, bool ok) {
        uint256 len = msg.data.length;
        if (len < 4 + 32 + 20 + 68) return (0, 0, false);
        if (bytes2(msg.data[len - 2:len]) != bytes2(0x7096)) return (0, 0, false);
        uint256 count = uint8(msg.data[len - 68]);
        uint256 start = len - 68 - count * 20;
        if (count == 0 || start < 36) return (0, 0, false);
        bytes32 h = keccak256(msg.data[start:len - 67]);
        bytes32 r = bytes32(msg.data[len - 67:len - 35]);
        bytes32 s = bytes32(msg.data[len - 35:len - 3]);
        uint8 v = uint8(msg.data[len - 3]);
        if (v < 27) v += 27;
        if (ecrecover(h, v, r, s) != atlasSigner) return (0, 0, false);
        for (uint256 i; i < count; i++) {
            uint256 o = start + i * 20;
            if (bytes4(msg.data[o:o + 4]) != bnbUsdFeed) continue;
            price = uint256(uint80(bytes10(msg.data[o + 4:o + 14])));
            ts = uint256(uint48(bytes6(msg.data[o + 14:o + 20])));
            if (block.timestamp > ts + MAX_DELAY) return (0, 0, false);
            if (ts > block.timestamp + MAX_FUTURE_DRIFT) return (0, 0, false);
            return (price, ts, true);
        }
        return (0, 0, false);
    }
}
