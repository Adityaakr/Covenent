// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// Minimal ERC-8004 Identity Registry stand-in: register(agentURI) mints an agent id to the caller.
contract MockIdentityRegistry {
    uint256 public nextId = 1;
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => string) internal _uri;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = nextId++;
        ownerOf[agentId] = msg.sender;
        _uri[agentId] = agentURI;
        emit Transfer(address(0), msg.sender, agentId);
        emit Registered(agentId, agentURI, msg.sender);
    }

    function tokenURI(uint256 agentId) external view returns (string memory) {
        require(ownerOf[agentId] != address(0), "no agent");
        return _uri[agentId];
    }
}

/// Minimal ERC-8004 Reputation Registry stand-in. Feedback from the agent's own owner is refused,
/// as ERC-8004 requires; summaries are filtered by the client addresses the reader trusts.
contract MockReputationRegistry {
    struct Feedback {
        address client;
        int128 value;
        uint8 decimals;
        string tag1;
        string tag2;
    }

    MockIdentityRegistry public immutable identity;
    mapping(uint256 => Feedback[]) internal _fb;

    event NewFeedback(uint256 indexed agentId, address indexed clientAddress, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash);

    constructor(MockIdentityRegistry id) {
        identity = id;
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
        require(identity.ownerOf(agentId) != address(0), "no agent");
        require(identity.ownerOf(agentId) != msg.sender, "self feedback");
        _fb[agentId].push(Feedback(msg.sender, value, valueDecimals, tag1, tag2));
        emit NewFeedback(agentId, msg.sender, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash);
    }

    function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2)
        external
        view
        returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
    {
        Feedback[] storage all = _fb[agentId];
        for (uint256 i; i < all.length; i++) {
            bool allowed = clientAddresses.length == 0;
            for (uint256 j; j < clientAddresses.length && !allowed; j++) allowed = clientAddresses[j] == all[i].client;
            if (!allowed) continue;
            if (bytes(tag1).length != 0 && keccak256(bytes(tag1)) != keccak256(bytes(all[i].tag1))) continue;
            if (bytes(tag2).length != 0 && keccak256(bytes(tag2)) != keccak256(bytes(all[i].tag2))) continue;
            count++;
            summaryValue += all[i].value;
        }
        summaryValueDecimals = 0;
    }
}
