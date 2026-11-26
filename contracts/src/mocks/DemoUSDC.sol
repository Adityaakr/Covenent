// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title DemoUSDC
/// @notice TEST FUNDS ONLY, worthless anywhere. A 6-decimal dollar token for the dev chain's faucet ("Get test funds"),
///         a USDC/WBNB pool on the local PancakeSwap, and on BNB testnet the agent economy demo: a visitor mints
///         some, pays an issuer agent for a service in it, and sees the agent's dollar revenue next to its BNB
///         treasury. It is never part of a covenant: raises stay BNB-quoted as Flap requires, and no treasury holds
///         it. The minter (the dev stack's faucet account, or the testnet deployer) mints any amount; anyone else
///         gets FAUCET_AMOUNT from faucet(), at most once per FAUCET_COOLDOWN per address. Deployed by
///         scripts/dev-funds.sh on the dev chain and script/DemoUSDC.s.sol on BNB testnet, never by Deploy.s.sol.
contract DemoUSDC {
    string public constant name = "Demo USDC (test funds)";
    string public constant symbol = "dUSDC";
    uint8 public constant decimals = 6;

    /// @notice What faucet() mints: 1,000 dUSDC.
    uint256 public constant FAUCET_AMOUNT = 1_000e6;
    /// @notice How long an address waits between faucet() calls.
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    address public immutable minter;
    /// @notice When each address last used faucet() (0 = never).
    mapping(address => uint256) public lastFaucetAt;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error NotMinter();
    error Insufficient();
    error FaucetCooldown(uint256 nextAt);

    constructor(address minter_) {
        minter = minter_;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /// @notice Open test faucet: FAUCET_AMOUNT to the caller, once per FAUCET_COOLDOWN.
    function faucet() external returns (uint256) {
        uint256 last = lastFaucetAt[msg.sender];
        if (last != 0 && block.timestamp < last + FAUCET_COOLDOWN) revert FaucetCooldown(last + FAUCET_COOLDOWN);
        lastFaucetAt[msg.sender] = block.timestamp;
        totalSupply += FAUCET_AMOUNT;
        balanceOf[msg.sender] += FAUCET_AMOUNT;
        emit Transfer(address(0), msg.sender, FAUCET_AMOUNT);
        return FAUCET_AMOUNT;
    }

    /// @notice When `who` can next call faucet() (0 = now).
    function faucetAvailableAt(address who) external view returns (uint256) {
        uint256 last = lastFaucetAt[who];
        if (last == 0 || block.timestamp >= last + FAUCET_COOLDOWN) return 0;
        return last + FAUCET_COOLDOWN;
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
