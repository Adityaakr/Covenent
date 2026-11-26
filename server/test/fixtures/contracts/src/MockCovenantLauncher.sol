// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// Fake-chain stand-in for CovenantLauncher: commitments, a deadline, pro-rata settlement views.
contract MockCovenantLauncher {
    enum State { RAISING, FAILED, LAUNCHED }

    State public state;
    uint256 public minRaise;
    uint256 public cap;
    uint256 public deadline;
    uint256 public committed;
    uint256 public saleTokens;
    address public token;
    address public vault;
    mapping(address => uint256) public contributions;
    mapping(address => bool) public refunded;

    event Contributed(address indexed who, uint256 amount);
    event Finalized(uint8 state, uint256 accepted);
    event Refunded(address indexed who, uint256 amount);

    constructor(uint256 min_, uint256 cap_, uint256 duration, uint256 saleTokens_) {
        minRaise = min_;
        cap = cap_;
        deadline = block.timestamp + duration;
        saleTokens = saleTokens_;
    }

    function setLaunched(address token_, address vault_) external {
        token = token_;
        vault = vault_;
    }

    function contribute() external payable {
        require(state == State.RAISING && block.timestamp < deadline, "closed");
        contributions[msg.sender] += msg.value;
        committed += msg.value;
        emit Contributed(msg.sender, msg.value);
    }

    function accepted() public view returns (uint256) {
        return committed < cap ? committed : cap;
    }

    function acceptedOf(address a) public view returns (uint256) {
        if (state == State.FAILED || committed == 0) return 0;
        return contributions[a] * accepted() / committed;
    }

    function allocationOf(address a) external view returns (uint256) {
        uint256 q = accepted();
        return q == 0 ? 0 : saleTokens * acceptedOf(a) / q;
    }

    function finalize() external {
        require(state == State.RAISING && block.timestamp >= deadline, "not yet");
        state = committed < minRaise ? State.FAILED : State.LAUNCHED;
        emit Finalized(uint8(state), state == State.LAUNCHED ? accepted() : 0);
    }

    function claimRefund() external {
        require(state != State.RAISING && !refunded[msg.sender], "no refund");
        uint256 amt = contributions[msg.sender] - acceptedOf(msg.sender);
        refunded[msg.sender] = true;
        (bool ok,) = msg.sender.call{value: amt}("");
        require(ok, "send");
        emit Refunded(msg.sender, amt);
    }
}
