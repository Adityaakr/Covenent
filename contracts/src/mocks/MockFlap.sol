// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {IPortalTypes} from "src/flap/IPortal.sol";
import {LauncherRecord, ILauncherFactory, ILauncherDescription} from "src/flap/ILauncher.sol";
import {IDirectLaunchVaultFactory} from "src/flap/ILaunchVaultSpec.sol";
import {IStrategy} from "src/flap/IStrategy.sol";
import {Distribution, DistributionTarget} from "src/flap/Distribution.sol";
import {LaunchExtensionHelper} from "src/flap/LaunchExtensionHelper.sol";
import {MockWBNB, MockV2Factory, MockV2Pair} from "src/mocks/MockV2.sol";

/// @notice Local stand-ins for Flap's Pool Launch Portal, its tax token and tax processor, and the Token Dock
///         router, used only when the dev chain has no BNB Chain fork. They follow the parts of Flap's spec that
///         Covenant depends on (salt lock by the Launcher, the 0x7777 address rule, newVault before the token
///         exists, the pool seeded at launch with LP burned, the reserve hand-off with exact allowance, tax paid
///         to the VAULT slot in native BNB). Fork tests run the same contracts against the live Portal.
///         Not for production.

contract MockTaxToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public portal;
    address public pair;
    address public taxProcessor;
    uint16 public buyTaxRate;
    uint16 public sellTaxRate;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function initialize(string calldata n, string calldata s, uint256 supply) external {
        require(portal == address(0), "Token: initialized");
        portal = msg.sender;
        name = n;
        symbol = s;
        totalSupply = supply;
        balanceOf[msg.sender] = supply;
        emit Transfer(address(0), msg.sender, supply);
    }

    function setPool(address pair_, address processor_, uint16 buy, uint16 sell) external {
        require(msg.sender == portal && pair == address(0), "Token: forbidden");
        pair = pair_;
        taxProcessor = processor_;
        buyTaxRate = buy;
        sellTaxRate = sell;
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
        uint256 tax;
        address p = pair;
        if (p != address(0) && from != taxProcessor && to != taxProcessor && from != portal) {
            if (from == p) tax = amount * buyTaxRate / 10_000;
            else if (to == p) tax = amount * sellTaxRate / 10_000;
        }
        balanceOf[from] -= amount;
        if (tax > 0) {
            balanceOf[taxProcessor] += tax;
            emit Transfer(from, taxProcessor, tax);
        }
        balanceOf[to] += amount - tax;
        emit Transfer(from, to, amount - tax);
    }
}

/// @notice Liquidates collected tax tokens on the pool and pays the BNB to the launch's vault, as Flap's
///         TaxProcessor does for a VAULT slot at 10000 bps. Anyone may call `dispatch()`.
contract MockTaxProcessor {
    address public immutable token;
    address public immutable pair;
    address public immutable wbnb;
    address public immutable vault;
    uint256 public totalDispatched;

    event Dispatched(uint256 tokensSold, uint256 bnbToVault);

    constructor(address token_, address pair_, address wbnb_, address vault_) {
        token = token_;
        pair = pair_;
        wbnb = wbnb_;
        vault = vault_;
    }

    receive() external payable {}

    function feeQuoteBalance() external view returns (uint256) {
        return MockTaxToken(token).balanceOf(address(this));
    }

    function dispatch() external {
        uint256 bal = MockTaxToken(token).balanceOf(address(this));
        if (bal == 0) return;
        MockTaxToken(token).transfer(pair, bal);
        MockV2Pair p = MockV2Pair(pair);
        (uint112 r0, uint112 r1,) = p.getReserves();
        bool tokenIs0 = p.token0() == token;
        (uint256 rIn, uint256 rOut) = tokenIs0 ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        uint256 inWithFee = bal * 9975;
        uint256 out = inWithFee * rOut / (rIn * 10_000 + inWithFee);
        if (out == 0) return;
        (uint256 o0, uint256 o1) = tokenIs0 ? (uint256(0), out) : (out, uint256(0));
        p.swap(o0, o1, address(this), "");
        MockWBNB(payable(wbnb)).withdraw(out);
        totalDispatched += out;
        (bool ok,) = vault.call{value: out}("");
        require(ok, "Processor: vault refused");
        emit Dispatched(bal, out);
    }
}

/// @notice Flap's TokenDockRouter surface: per-owner custody of reserved tokens. `withdraw` is never gated.
contract MockTokenDockRouter {
    mapping(address token => mapping(address owner => uint256)) public balanceOf;
    mapping(address token => uint256) public totalReserved;

    event FlapTokenDockDeposited(address token, address owner, uint256 amount);
    event FlapTokenDockWithdrawn(address token, address owner, address to, uint256 amount);

    function deposit(address token, uint256 amount) external {
        uint256 before = MockTaxToken(token).balanceOf(address(this));
        MockTaxToken(token).transferFrom(msg.sender, address(this), amount);
        uint256 got = MockTaxToken(token).balanceOf(address(this)) - before;
        require(got == amount, "Dock: received less");
        balanceOf[token][msg.sender] += amount;
        totalReserved[token] += amount;
        emit FlapTokenDockDeposited(token, msg.sender, amount);
    }

    function withdraw(address token, uint256 amount, address to) external {
        balanceOf[token][msg.sender] -= amount;
        totalReserved[token] -= amount;
        MockTaxToken(token).transfer(to, amount);
        emit FlapTokenDockWithdrawn(token, msg.sender, to, amount);
    }

    function isWhitelisted(address, address) external pure returns (bool) {
        return true;
    }

    function dockFor(address, address) external view returns (address) {
        return address(this);
    }
}

/// @notice The Pool Launch Portal calls Covenant makes, and the admin calls a fork test uses to open a factory.
contract MockPortal {
    uint256 public constant SALT_LOCK_FEE = 0.005 ether;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address public immutable admin;
    address public immutable tokenImpl;
    address public immutable wbnb;
    address public immutable v2Factory;
    /// @notice Stand-in for Flap's liquidity floor: the least BNB a launch may seed.
    uint256 public minPoolQuote;
    uint256 public featureFlags;

    struct FactoryConfig {
        bool enabled;
        uint16 multiplier;
    }

    mapping(bytes32 salt => address locker) public saltLocker;
    mapping(address launcher => address factory) internal _launcherFactoryOf;
    mapping(address launcher => bool) public launcherLaunched;
    mapping(address factory => FactoryConfig) internal _launcherFactories;
    mapping(address factory => FactoryConfig) internal _vaultFactories;
    mapping(address token => address) internal _vaultOf;
    mapping(address token => address) internal _vaultFactoryOf;
    mapping(address token => address) public taxProcessorOf;

    event FlapNewLauncherCreated(address launcher, address launcherFactory, address creator, string description);
    event FlapDirectLaunched(address token, uint8 kind, address creator, bytes32 salt, bytes data);

    error CreationPaused();
    error FlapSaltLockedByAnotherUser();
    error LauncherAlreadyLaunched();
    error LauncherFactoryDisabled();
    error WrongValue();
    error BadSalt();
    error LaunchLiquidityTooLow();
    error LaunchQuotePairNotEnabled();
    error FeeConfigInvalid();
    error AllowanceNotFullyConsumed();
    error ExcessiveRemainder();
    error NotAdmin();

    constructor(address admin_, address wbnb_, address v2Factory_, uint256 minPoolQuote_) {
        admin = admin_;
        wbnb = wbnb_;
        v2Factory = v2Factory_;
        minPoolQuote = minPoolQuote_;
        tokenImpl = address(new MockTaxToken());
        featureFlags = 1; // creation paused for non-tester callers, as on BNB Chain
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ── admin ───────────────────────────────────────────────────────────────
    function setCreationPaused(bool paused) external onlyAdmin {
        featureFlags = paused ? featureFlags | 1 : featureFlags & ~uint256(1);
    }

    function setLauncherFactoryMultiplier(address factory, uint16 m, bool enabled) external onlyAdmin {
        _launcherFactories[factory] = FactoryConfig(enabled, m);
    }

    function setVaultFactoryMultiplier(address factory, uint16 m, bool enabled) external onlyAdmin {
        _vaultFactories[factory] = FactoryConfig(enabled, m);
    }

    function setMinPoolQuote(uint256 v) external onlyAdmin {
        minPoolQuote = v;
    }

    function launcherFactoryMultiplier(address factory) external view returns (bool, uint16) {
        FactoryConfig memory c = _launcherFactories[factory];
        return (c.enabled, c.multiplier);
    }

    // ── launchers ───────────────────────────────────────────────────────────
    function lockSalt(bytes32 salt, uint8) external payable {
        if (msg.value != SALT_LOCK_FEE) revert WrongValue();
        if (saltLocker[salt] != address(0)) revert FlapSaltLockedByAnotherUser();
        saltLocker[salt] = msg.sender;
    }

    function newLauncher(address launcherFactory, bytes calldata data) external payable returns (address launcher) {
        if (!_launcherFactories[launcherFactory].enabled) revert LauncherFactoryDisabled();
        launcher = ILauncherFactory(launcherFactory).newLauncher{value: msg.value}(msg.sender, data);
        require(launcher.code.length > 0, "Portal: launcher has no code");
        _launcherFactoryOf[launcher] = launcherFactory;
        string memory d;
        try ILauncherDescription(launcher).description() returns (string memory s) {
            if (bytes(s).length <= 4096) d = s;
        } catch {}
        emit FlapNewLauncherCreated(launcher, launcherFactory, msg.sender, d);
    }

    function getLauncher(address launcher) external view returns (LauncherRecord memory r) {
        r.launcherFactory = _launcherFactoryOf[launcher];
    }

    function getLaunchVault(address token) external view returns (address vault, address vaultFactory) {
        return (_vaultOf[token], _vaultFactoryOf[token]);
    }

    function predictToken(bytes32 salt) public view returns (address) {
        return Clones.predictDeterministicAddress(tokenImpl, salt, address(this));
    }

    // ── launch ──────────────────────────────────────────────────────────────
    function launchTaxTokenV2(
        IPortalTypes.CreateTaxTokenParams calldata p,
        Distribution calldata d,
        IPortalTypes.CreatorBuyParams calldata
    ) external payable returns (address token, address pool) {
        if (msg.value != p.poolQuote + p.creatorBuyQuote) revert WrongValue();
        if (p.quoteToken != address(0)) revert LaunchQuotePairNotEnabled();
        if (saltLocker[p.salt] != msg.sender) revert FlapSaltLockedByAnotherUser();
        address lf = _launcherFactoryOf[msg.sender];
        if (lf != address(0)) {
            if (launcherLaunched[msg.sender]) revert LauncherAlreadyLaunched();
            if (!_launcherFactories[lf].enabled) revert CreationPaused();
            launcherLaunched[msg.sender] = true;
        } else if (featureFlags & 1 != 0) {
            revert CreationPaused();
        }
        if (p.poolQuote < minPoolQuote) revert LaunchLiquidityTooLow();
        if (p.poolToken == 0 || p.poolToken > p.totalSupply) revert FeeConfigInvalid();

        address predicted = predictToken(p.salt);
        if (uint16(uint160(predicted)) != 0x7777) revert BadSalt();

        (address vault, address vf) = _createVault(predicted, p, d);

        token = Clones.cloneDeterministic(tokenImpl, p.salt);
        MockTaxToken(token).initialize(p.name, p.symbol, p.totalSupply);
        pool = MockV2Factory(v2Factory).createPair(token, wbnb);
        address processor = address(new MockTaxProcessor(token, pool, wbnb, vault == address(0) ? DEAD : vault));
        taxProcessorOf[token] = processor;
        MockTaxToken(token).setPool(pool, processor, p.buyTaxRate, p.sellTaxRate);

        // Seed the pool at the committed amounts and lock the liquidity by burning the LP.
        MockTaxToken(token).transfer(pool, p.poolToken);
        MockWBNB(payable(wbnb)).deposit{value: p.poolQuote}();
        MockWBNB(payable(wbnb)).transfer(pool, p.poolQuote);
        MockV2Pair(pool).mint(DEAD);

        _distribute(token, vault, p, d);
        _vaultOf[token] = vault;
        _vaultFactoryOf[token] = vf;

        (bool found, address declared) = LaunchExtensionHelper.decodeCreator(p.extensionID, p.extensionData);
        emit FlapDirectLaunched(token, 0, found ? declared : msg.sender, p.salt, "");
    }

    function _createVault(address predicted, IPortalTypes.CreateTaxTokenParams calldata p, Distribution calldata d)
        internal
        returns (address vault, address vf)
    {
        uint256 sum;
        for (uint256 i; i < p.feeConfigs.length; ++i) {
            sum += p.feeConfigs[i].bps;
            if (p.feeConfigs[i].feeType != IPortalTypes.FeeSlotType.VAULT) continue;
            if (vf != address(0)) revert FeeConfigInvalid();
            IPortalTypes.FeeConfigVault memory v = abi.decode(p.feeConfigs[i].configData, (IPortalTypes.FeeConfigVault));
            vf = v.vaultFactory;
        }
        if (p.feeConfigs.length > 4 || sum != 10_000) revert FeeConfigInvalid();
        if (vf != address(0)) {
            vault = IDirectLaunchVaultFactory(vf).newVault(predicted, msg.sender, 0, abi.encode(p, d));
            require(vault.code.length > 0, "Portal: vault has no code");
        }
    }

    function _distribute(
        address token,
        address vault,
        IPortalTypes.CreateTaxTokenParams calldata p,
        Distribution calldata d
    ) internal {
        uint256 remainder = p.totalSupply - p.poolToken;
        if (d.target == DistributionTarget.VAULT || d.target == DistributionTarget.EXPLICIT) {
            address strategy = d.target == DistributionTarget.VAULT ? vault : d.strategy;
            require(strategy != address(0), "Portal: no strategy");
            MockTaxToken(token).approve(strategy, d.amount);
            IStrategy(strategy).initializeDistribution(token, d.amount, d.configData, p.salt);
            if (MockTaxToken(token).allowance(address(this), strategy) != 0) revert AllowanceNotFullyConsumed();
            remainder -= d.amount;
        } else if (d.amount != 0) {
            revert ExcessiveRemainder();
        }
        if (remainder > 1 ether) revert ExcessiveRemainder();
        if (remainder > 0) MockTaxToken(token).transfer(DEAD, remainder);
    }
}
