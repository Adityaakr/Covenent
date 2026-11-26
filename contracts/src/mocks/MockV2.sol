// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Local stand-ins for WBNB and PancakeSwap V2 (pair, factory, router), used only when the dev chain has no
///         BNB Chain fork. Same math and cumulative-price bookkeeping as Uniswap V2, with PancakeSwap's 0.25% fee.
///         Not for production.

interface IERC20Min {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

contract MockWBNB {
    string public constant name = "Wrapped BNB";
    string public constant symbol = "WBNB";
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Transfer(address(0), msg.sender, msg.value);
    }

    function withdraw(uint256 wad) external {
        balanceOf[msg.sender] -= wad;
        emit Transfer(msg.sender, address(0), wad);
        (bool ok,) = msg.sender.call{value: wad}("");
        require(ok, "WBNB: send failed");
    }

    function totalSupply() external view returns (uint256) {
        return address(this).balance;
    }

    function approve(address spender, uint256 wad) external returns (bool) {
        allowance[msg.sender][spender] = wad;
        emit Approval(msg.sender, spender, wad);
        return true;
    }

    function transfer(address to, uint256 wad) external returns (bool) {
        return transferFrom(msg.sender, to, wad);
    }

    function transferFrom(address from, address to, uint256 wad) public returns (bool) {
        if (from != msg.sender) {
            uint256 a = allowance[from][msg.sender];
            if (a != type(uint256).max) allowance[from][msg.sender] = a - wad;
        }
        balanceOf[from] -= wad;
        balanceOf[to] += wad;
        emit Transfer(from, to, wad);
        return true;
    }
}

contract MockV2Pair {
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    address public factory;
    address public token0;
    address public token1;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    uint256 private unlocked = 1;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    modifier lock() {
        require(unlocked == 1, "Pair: LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    constructor() {
        factory = msg.sender;
    }

    function initialize(address t0, address t1) external {
        require(msg.sender == factory, "Pair: FORBIDDEN");
        token0 = t0;
        token1 = t1;
    }

    function getReserves() public view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function _update(uint256 balance0, uint256 balance1, uint112 r0, uint112 r1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "Pair: OVERFLOW");
        uint32 ts = uint32(block.timestamp);
        unchecked {
            uint32 elapsed = ts - blockTimestampLast;
            if (elapsed > 0 && r0 != 0 && r1 != 0) {
                price0CumulativeLast += ((uint256(r1) << 112) / r0) * elapsed;
                price1CumulativeLast += ((uint256(r0) << 112) / r1) * elapsed;
            }
        }
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = ts;
        emit Sync(reserve0, reserve1);
    }

    function mint(address to) external lock returns (uint256 liquidity) {
        (uint112 r0, uint112 r1,) = getReserves();
        uint256 b0 = IERC20Min(token0).balanceOf(address(this));
        uint256 b1 = IERC20Min(token1).balanceOf(address(this));
        uint256 a0 = b0 - r0;
        uint256 a1 = b1 - r1;
        if (totalSupply == 0) {
            liquidity = _sqrt(a0 * a1) - MINIMUM_LIQUIDITY;
            balanceOf[address(0)] = MINIMUM_LIQUIDITY;
            totalSupply = MINIMUM_LIQUIDITY;
        } else {
            uint256 l0 = a0 * totalSupply / r0;
            uint256 l1 = a1 * totalSupply / r1;
            liquidity = l0 < l1 ? l0 : l1;
        }
        require(liquidity > 0, "Pair: INSUFFICIENT_LIQUIDITY_MINTED");
        balanceOf[to] += liquidity;
        totalSupply += liquidity;
        _update(b0, b1, r0, r1);
        emit Mint(msg.sender, a0, a1);
    }

    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata) external lock {
        require(amount0Out > 0 || amount1Out > 0, "Pair: INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 r0, uint112 r1,) = getReserves();
        require(amount0Out < r0 && amount1Out < r1, "Pair: INSUFFICIENT_LIQUIDITY");
        require(to != token0 && to != token1, "Pair: INVALID_TO");
        if (amount0Out > 0) IERC20Min(token0).transfer(to, amount0Out);
        if (amount1Out > 0) IERC20Min(token1).transfer(to, amount1Out);
        uint256 b0 = IERC20Min(token0).balanceOf(address(this));
        uint256 b1 = IERC20Min(token1).balanceOf(address(this));
        _checkK(b0, b1, r0, r1, amount0Out, amount1Out);
        _update(b0, b1, r0, r1);
        emit Swap(msg.sender, 0, 0, amount0Out, amount1Out, to);
    }

    function _checkK(uint256 b0, uint256 b1, uint112 r0, uint112 r1, uint256 o0, uint256 o1) private pure {
        uint256 in0 = b0 > r0 - o0 ? b0 - (r0 - o0) : 0;
        uint256 in1 = b1 > r1 - o1 ? b1 - (r1 - o1) : 0;
        require(in0 > 0 || in1 > 0, "Pair: INSUFFICIENT_INPUT_AMOUNT");
        require((b0 * 10_000 - in0 * 25) * (b1 * 10_000 - in1 * 25) >= uint256(r0) * r1 * 1e8, "Pair: K");
    }

    function skim(address to) external lock {
        IERC20Min(token0).transfer(to, IERC20Min(token0).balanceOf(address(this)) - reserve0);
        IERC20Min(token1).transfer(to, IERC20Min(token1).balanceOf(address(this)) - reserve1);
    }

    function sync() external lock {
        _update(
            IERC20Min(token0).balanceOf(address(this)), IERC20Min(token1).balanceOf(address(this)), reserve0, reserve1
        );
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

contract MockV2Factory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

    function createPair(address a, address b) external returns (address pair) {
        require(a != b, "Factory: IDENTICAL_ADDRESSES");
        (address t0, address t1) = a < b ? (a, b) : (b, a);
        require(getPair[t0][t1] == address(0), "Factory: PAIR_EXISTS");
        pair = address(new MockV2Pair{salt: keccak256(abi.encodePacked(t0, t1))}());
        MockV2Pair(pair).initialize(t0, t1);
        getPair[t0][t1] = pair;
        getPair[t1][t0] = pair;
        allPairs.push(pair);
        emit PairCreated(t0, t1, pair, allPairs.length);
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
}

/// @notice The two PancakeSwap router calls the demo and the tests use, for fee-on-transfer (tax) tokens.
contract MockV2Router {
    address public immutable factory;
    address public immutable WETH;

    constructor(address factory_, address weth_) {
        factory = factory_;
        WETH = weth_;
    }

    receive() external payable {
        require(msg.sender == WETH, "Router: only WETH");
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        uint256 inWithFee = amountIn * 9975;
        return inWithFee * reserveOut / (reserveIn * 10_000 + inWithFee);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory a) {
        require(path.length == 2, "Router: 2-hop only");
        a = new uint256[](2);
        a[0] = amountIn;
        (uint256 rIn, uint256 rOut) = _reserves(path[0], path[1]);
        a[1] = getAmountOut(amountIn, rIn, rOut);
    }

    function _reserves(address input, address output) internal view returns (uint256 rIn, uint256 rOut) {
        MockV2Pair pair = MockV2Pair(MockV2Factory(factory).getPair(input, output));
        (uint112 r0, uint112 r1,) = pair.getReserves();
        (rIn, rOut) = input == pair.token0() ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
    }

    function _swapSupportingFee(address input, address output, address to) internal {
        MockV2Pair pair = MockV2Pair(MockV2Factory(factory).getPair(input, output));
        (uint256 rIn, uint256 rOut) = _reserves(input, output);
        uint256 amountIn = IERC20Min(input).balanceOf(address(pair)) - rIn;
        uint256 out = getAmountOut(amountIn, rIn, rOut);
        (uint256 o0, uint256 o1) = input == pair.token0() ? (uint256(0), out) : (out, uint256(0));
        pair.swap(o0, o1, to, "");
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable {
        require(block.timestamp <= deadline, "Router: EXPIRED");
        require(path.length == 2 && path[0] == WETH, "Router: INVALID_PATH");
        MockWBNB(payable(WETH)).deposit{value: msg.value}();
        MockWBNB(payable(WETH)).transfer(MockV2Factory(factory).getPair(path[0], path[1]), msg.value);
        uint256 before = IERC20Min(path[1]).balanceOf(to);
        _swapSupportingFee(path[0], path[1], to);
        require(IERC20Min(path[1]).balanceOf(to) - before >= amountOutMin, "Router: INSUFFICIENT_OUTPUT_AMOUNT");
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external {
        require(block.timestamp <= deadline, "Router: EXPIRED");
        require(path.length == 2 && path[1] == WETH, "Router: INVALID_PATH");
        IERC20Min(path[0]).transferFrom(msg.sender, MockV2Factory(factory).getPair(path[0], path[1]), amountIn);
        _swapSupportingFee(path[0], path[1], address(this));
        uint256 out = IERC20Min(WETH).balanceOf(address(this));
        require(out >= amountOutMin, "Router: INSUFFICIENT_OUTPUT_AMOUNT");
        MockWBNB(payable(WETH)).withdraw(out);
        (bool ok,) = to.call{value: out}("");
        require(ok, "Router: ETH_TRANSFER_FAILED");
    }
}
