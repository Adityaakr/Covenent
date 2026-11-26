// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice The subset of the ERC-8004 IdentityRegistry Covenant reads. Matches
///         erc-8004/erc-8004-contracts IdentityRegistryUpgradeable (an ERC-721 whose token id is the agent id).
///         BNB Chain 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432, BNB testnet 0x8004A818BFB912233c491871b3d84c89A494BD9e.
interface IERC8004Identity {
    function ownerOf(uint256 agentId) external view returns (address);
    function tokenURI(uint256 agentId) external view returns (string memory);
    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool);
    function register(string memory agentURI) external returns (uint256 agentId);
}

/// @notice The subset of the ERC-8004 ReputationRegistry Covenant writes and reads. Matches
///         ReputationRegistryUpgradeable. BNB Chain 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63,
///         BNB testnet 0x8004B663056A597Dffe9eCcC1965A193B7388713.
/// @dev `giveFeedback` refuses feedback from the agent's owner or operators. A vault is neither, so it may record.
interface IERC8004Reputation {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64);

    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked);

    function getIdentityRegistry() external view returns (address);
}
