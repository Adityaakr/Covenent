// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @notice The PancakeSwap V2 (Uniswap V2) pair surface the oracle reads.
interface IV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function price0CumulativeLast() external view returns (uint256);
    function price1CumulativeLast() external view returns (uint256);
}

/// @title PairTwap
/// @notice Time-weighted pool price in the style of the Uniswap V2 oracle. The pair's cumulative price only records
///         prices that survived to the end of a block, so a flash loan inside one transaction cannot move it.
library PairTwap {
    uint256 internal constant Q112 = 2 ** 112;

    struct Reading {
        uint256 cumulative; // UQ112x112 seconds, of the launch token priced in the quote
        uint32 timestamp; // block.timestamp mod 2^32
        uint256 tokenReserve;
        uint256 quoteReserve;
    }

    /// @notice The counterfactual cumulative price of `token` in the other asset as of this block, plus reserves.
    function read(address pair, address token) internal view returns (Reading memory r) {
        IV2Pair p = IV2Pair(pair);
        bool tokenIs0 = p.token0() == token;
        (uint112 r0, uint112 r1, uint32 last) = p.getReserves();
        r.timestamp = uint32(block.timestamp);
        r.cumulative = tokenIs0 ? p.price0CumulativeLast() : p.price1CumulativeLast();
        (uint256 rt, uint256 rq) = tokenIs0 ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        r.tokenReserve = rt;
        r.quoteReserve = rq;
        if (last != r.timestamp && rt > 0 && rq > 0) {
            unchecked {
                // Overflow is desired, exactly as in the pair: only differences of cumulative values are used.
                uint32 dt = r.timestamp - last;
                r.cumulative += ((rq << 112) / rt) * dt;
            }
        }
    }

    /// @notice Average price between two readings, BNB per token in 1e18. 0 when no time elapsed.
    function average(uint256 cumBefore, uint256 cumNow, uint32 elapsed) internal pure returns (uint256) {
        if (elapsed == 0) return 0;
        uint256 avgQ112;
        unchecked {
            avgQ112 = (cumNow - cumBefore) / elapsed;
        }
        return FixedPointMathLib.fullMulDiv(avgQ112, 1e18, Q112);
    }

    /// @notice Spot price from reserves, BNB per token in 1e18.
    function spot(Reading memory r) internal pure returns (uint256) {
        if (r.tokenReserve == 0) return 0;
        return FixedPointMathLib.fullMulDiv(r.quoteReserve, 1e18, r.tokenReserve);
    }
}
