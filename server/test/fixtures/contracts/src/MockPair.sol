// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// Stand-in for a PancakeSwap V2 pair. Reserves are set directly by the fixture,
/// and the cumulative price accrues the UQ112x112 way so a TWAP can be read.
contract MockPair {
    address public token0;
    address public token1;
    uint112 private r0;
    uint112 private r1;
    uint32 private tsLast;
    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;

    constructor(address a, address b) {
        (token0, token1) = a < b ? (a, b) : (b, a);
        tsLast = uint32(block.timestamp);
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (r0, r1, tsLast);
    }

    function setReserves(uint112 n0, uint112 n1) external {
        _update();
        r0 = n0;
        r1 = n1;
    }

    function _update() internal {
        uint32 nowTs = uint32(block.timestamp);
        uint32 dt = nowTs - tsLast;
        if (dt > 0 && r0 != 0 && r1 != 0) {
            price0CumulativeLast += (uint256(r1) << 112) / r0 * dt;
            price1CumulativeLast += (uint256(r0) << 112) / r1 * dt;
        }
        tsLast = nowTs;
    }
}
