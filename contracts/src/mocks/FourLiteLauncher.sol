// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

interface IV2FactoryLike {
    function createPair(address a, address b) external returns (address);
}

interface IV2PairLike {
    function mint(address to) external returns (uint256);
}

interface IV2RouterLike {
    function factory() external view returns (address);
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256, uint256, address[] calldata, address, uint256)
        external;
}

interface IWBNBLike {
    function deposit() external payable;
    function transfer(address, uint256) external returns (bool);
}

interface IForwardVaultLike {
    function initialize(address token, address quote, address founder, address[] calldata, bytes calldata vaultData)
        external;
    function clonedVault() external view returns (address);
}

/// @title FourStyleTaxToken
/// @notice LOCAL STAND-IN for a Four.meme tax token on the dev chain (creating a real one needs Four.meme's backend
///         signature). It does what matters for Covenant Lite: a buy or sell on its PancakeSwap pair pays `taxBps` in
///         tokens to this contract, and `dispatch()` swaps them to BNB and sends the BNB to the founder recipient,
///         which is the token's ForwardVault clone, exactly where Four.meme sends a founder's tax share.
contract FourStyleTaxToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public immutable launcher;
    address public immutable router;
    address public immutable wbnb;
    uint16 public immutable taxBps;
    address public pair;
    address public founderRecipient;
    uint256 public taxDispatched; // BNB sent to the founder recipient so far

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TaxDispatched(address indexed recipient, uint256 tokens, uint256 bnb);

    constructor(string memory n, string memory s, uint256 supply, address router_, address wbnb_, uint16 taxBps_) {
        require(taxBps_ <= 1000, "Token: tax above 10%");
        launcher = msg.sender;
        name = n;
        symbol = s;
        router = router_;
        wbnb = wbnb_;
        taxBps = taxBps_;
        totalSupply = supply;
        balanceOf[msg.sender] = supply;
        emit Transfer(address(0), msg.sender, supply);
    }

    function wire(address pair_, address recipient) external {
        require(msg.sender == launcher && pair == address(0), "Token: wired");
        pair = pair_;
        founderRecipient = recipient;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            require(a >= amount, "Token: allowance");
            allowance[from][msg.sender] = a - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "Token: balance");
        balanceOf[from] -= amount;
        uint256 tax;
        // trades on the pair pay tax; the token's own dispatch swap and the launcher's pool seed do not
        if (pair != address(0) && (from == pair || to == pair) && from != address(this) && from != launcher) {
            tax = amount * taxBps / 10_000;
            balanceOf[address(this)] += tax;
            emit Transfer(from, address(this), tax);
        }
        balanceOf[to] += amount - tax;
        emit Transfer(from, to, amount - tax);
    }

    /// @notice Anyone: swap the collected tax to BNB and send it to the founder recipient (the ForwardVault clone).
    function dispatch() external returns (uint256 bnb) {
        uint256 amount = balanceOf[address(this)];
        require(amount > 0 && founderRecipient != address(0), "Token: nothing to dispatch");
        allowance[address(this)][router] = amount;
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = wbnb;
        uint256 before = address(this).balance;
        IV2RouterLike(router).swapExactTokensForETHSupportingFeeOnTransferTokens(
            amount, 0, path, address(this), block.timestamp
        );
        bnb = address(this).balance - before;
        taxDispatched += bnb;
        (bool ok,) = founderRecipient.call{value: bnb}("");
        require(ok, "Token: forward failed");
        emit TaxDispatched(founderRecipient, amount, bnb);
    }

    receive() external payable {}
}

/// @title FourLiteLauncher
/// @notice LOCAL STAND-IN for Four.meme's token creation on the Unverified Royalty path, for the dev chain only. One
///         call does what Four.meme and the OpenFour registry do for a founder who picks a tax vault template: deploy
///         the tax token, clone the platform's ForwardVault, initialize it with the template and its init data (the
///         tuple `(address template, bytes initData)`, as the live ForwardVault decodes it), route the founder's tax
///         share to it, and seed a PancakeSwap pool. The ForwardVault is the live implementation on a BNB Chain fork.
contract FourLiteLauncher {
    struct InitParams {
        address template;
        bytes initData;
    }

    struct Launch {
        address token;
        address forwardVault;
        address liteVault;
        address pair;
        address founder;
        uint64 at;
    }

    address public immutable forwardVaultImpl;
    address public immutable router;
    address public immutable wbnb;
    Launch[] internal _launches;

    event LiteLaunched(
        address indexed founder, address indexed token, address forwardVault, address liteVault, address pair
    );

    constructor(address forwardVaultImpl_, address router_, address wbnb_) {
        forwardVaultImpl = forwardVaultImpl_;
        router = router_;
        wbnb = wbnb_;
    }

    /// @param vaultData abi.encode(InitParams(template, initData)), what Four.meme passes to ForwardVault.
    /// @param poolTokens tokens to seed the pool with, against msg.value BNB; the rest of the supply goes to the founder.
    function launch(
        string calldata name,
        string calldata symbol,
        uint256 supply,
        uint16 taxBps,
        bytes calldata vaultData,
        uint256 poolTokens
    ) external payable returns (Launch memory l) {
        require(msg.value > 0 && poolTokens > 0 && poolTokens < supply, "Launcher: pool");
        FourStyleTaxToken token = new FourStyleTaxToken(name, symbol, supply, router, wbnb, taxBps);
        address fv = Clones.clone(forwardVaultImpl);
        IForwardVaultLike(fv).initialize(address(token), wbnb, msg.sender, new address[](0), vaultData);
        address pair = IV2FactoryLike(IV2RouterLike(router).factory()).createPair(address(token), wbnb);
        token.wire(pair, fv);
        token.transfer(pair, poolTokens);
        IWBNBLike(wbnb).deposit{value: msg.value}();
        IWBNBLike(wbnb).transfer(pair, msg.value);
        IV2PairLike(pair).mint(msg.sender);
        token.transfer(msg.sender, supply - poolTokens);
        l = Launch(address(token), fv, IForwardVaultLike(fv).clonedVault(), pair, msg.sender, uint64(block.timestamp));
        _launches.push(l);
        emit LiteLaunched(msg.sender, address(token), fv, l.liteVault, pair);
    }

    function launchCount() external view returns (uint256) {
        return _launches.length;
    }

    function launches() external view returns (Launch[] memory) {
        return _launches;
    }

    /// @notice The bytes Four.meme passes as ForwardVault's vaultData for a Covenant Lite vault: the tuple
    ///         (template, abi.encode(tapBps, tapPeriod, heartbeat, redeemFeeBps)), wrapped as one struct.
    function encodeVaultData(address template, uint16 tapBps, uint32 tapPeriod, uint32 heartbeat, uint16 redeemFeeBps)
        external
        pure
        returns (bytes memory)
    {
        return abi.encode(InitParams(template, abi.encode(tapBps, tapPeriod, heartbeat, redeemFeeBps)));
    }
}
