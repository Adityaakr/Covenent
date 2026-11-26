// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Local stand-ins for the ERC-8004 IdentityRegistry and ReputationRegistry, with the behavior Covenant
///         relies on: `ownerOf` reverts for an unknown agent, `register(uri)` mints to the caller, and
///         `giveFeedback` refuses the agent's owner and operators. On a BNB Chain fork the real registries are used.
///         Agent ids start at 1 here (the real registry starts at 0). Not for production.
contract MockIdentityRegistry {
    uint256 public nextId = 1;
    mapping(uint256 => address) internal _owner;
    mapping(uint256 => string) internal _uri;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error ERC721NonexistentToken(uint256 tokenId);

    function register(string memory agentURI) external returns (uint256 agentId) {
        agentId = nextId++;
        _owner[agentId] = msg.sender;
        _uri[agentId] = agentURI;
        emit Transfer(address(0), msg.sender, agentId);
        emit Registered(agentId, agentURI, msg.sender);
    }

    function ownerOf(uint256 agentId) public view returns (address o) {
        o = _owner[agentId];
        if (o == address(0)) revert ERC721NonexistentToken(agentId);
    }

    function tokenURI(uint256 agentId) external view returns (string memory) {
        ownerOf(agentId);
        return _uri[agentId];
    }

    function approve(address to, uint256 agentId) external {
        require(msg.sender == ownerOf(agentId), "not owner");
        getApproved[agentId] = to;
    }

    function setApprovalForAll(address operator, bool ok) external {
        isApprovedForAll[msg.sender][operator] = ok;
    }

    function transferFrom(address from, address to, uint256 agentId) external {
        address o = ownerOf(agentId);
        require(o == from, "wrong from");
        require(msg.sender == o || isApprovedForAll[o][msg.sender] || getApproved[agentId] == msg.sender, "denied");
        _owner[agentId] = to;
        getApproved[agentId] = address(0);
        emit Transfer(from, to, agentId);
    }

    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool) {
        address o = ownerOf(agentId);
        return spender == o || isApprovedForAll[o][spender] || getApproved[agentId] == spender;
    }
}

contract MockReputationRegistry {
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        bool isRevoked;
        string tag1;
        string tag2;
    }

    address internal immutable _identity;
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) internal _feedback;
    mapping(uint256 => mapping(address => uint64)) internal _lastIndex;
    mapping(uint256 => address[]) internal _clients;
    mapping(uint256 => mapping(address => bool)) internal _clientExists;

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    constructor(address identity_) {
        _identity = identity_;
    }

    function getIdentityRegistry() external view returns (address) {
        return _identity;
    }

    struct FB {
        uint256 agentId;
        int128 value;
        uint8 valueDecimals;
        uint64 index;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        _give(FB(agentId, value, valueDecimals, 0, tag1, tag2, endpoint, feedbackURI, feedbackHash));
    }

    function _give(FB memory f) internal {
        require(f.valueDecimals <= 18, "too many decimals");
        require(!MockIdentityRegistry(_identity).isAuthorizedOrOwner(msg.sender, f.agentId), "Self-feedback not allowed");
        f.index = ++_lastIndex[f.agentId][msg.sender];
        _feedback[f.agentId][msg.sender][f.index] = Feedback(f.value, f.valueDecimals, false, f.tag1, f.tag2);
        if (!_clientExists[f.agentId][msg.sender]) {
            _clients[f.agentId].push(msg.sender);
            _clientExists[f.agentId][msg.sender] = true;
        }
        _emitFeedback(f);
    }

    function _emitFeedback(FB memory f) internal {
        emit NewFeedback(
            f.agentId, msg.sender, f.index, f.value, f.valueDecimals, f.tag1, f.tag1, f.tag2, f.endpoint,
            f.feedbackURI, f.feedbackHash
        );
    }

    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        return _lastIndex[agentId][clientAddress];
    }

    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked)
    {
        require(feedbackIndex > 0 && feedbackIndex <= _lastIndex[agentId][clientAddress], "index out of bounds");
        Feedback storage f = _feedback[agentId][clientAddress][feedbackIndex];
        return (f.value, f.valueDecimals, f.tag1, f.tag2, f.isRevoked);
    }

    function getClients(uint256 agentId) external view returns (address[] memory) {
        return _clients[agentId];
    }
}

/// @notice A Chainlink-style push feed with a settable answer, standing in for an Atlas push feed.
contract MockAggregator {
    uint8 public immutable decimals;
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId;

    constructor(uint8 decimals_) {
        decimals = decimals_;
    }

    function set(int256 answer_, uint256 updatedAt_) external {
        answer = answer_;
        updatedAt = updatedAt_;
        ++roundId;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}
