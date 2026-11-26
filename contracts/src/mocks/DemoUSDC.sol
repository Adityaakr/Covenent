// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title DemoUSDC
/// @notice LOCAL TEST FUNDS ONLY. A 6-decimal dollar token for the dev chain's faucet ("Get test funds") and a
///         USDC/WBNB pool on the local PancakeSwap, so the app can show wallet funding and swaps. It is never part of
///         a covenant: raises stay BNB-quoted as Flap requires, and no treasury holds it. Only the minter (the dev
///         stack's faucet account) can mint. Deployed by scripts/dev-funds.sh, never by Deploy.s.sol.
contract DemoUSDC {
    string public constant name = "Demo USDC (local test funds)";
    string public constant symbol = "dUSDC";
    uint8 public constant decimals = 6;

    address public immutable minter;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error NotMinter();
    error Insufficient();

    constructor(address minter_) {
        minter = minter_;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            if (a < amount) revert Insufficient();
            allowance[from][msg.sender] = a - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        uint256 b = balanceOf[from];
        if (b < amount) revert Insufficient();
        balanceOf[from] = b - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
