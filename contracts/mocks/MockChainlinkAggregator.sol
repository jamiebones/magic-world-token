// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockChainlinkAggregator {
    uint8 public decimals;
    int256 private answer;
    uint256 private updatedAt;
    bool private shouldRevert;

    constructor(uint8 _decimals) {
        decimals = _decimals;
        updatedAt = block.timestamp;
    }

    function setLatestAnswer(int256 _answer) external {
        answer = _answer;
    }

    function setUpdatedAt(uint256 _updatedAt) external {
        updatedAt = _updatedAt;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 _answer,
            uint256 startedAt,
            uint256 _updatedAt,
            uint80 answeredInRound
        )
    {
        require(!shouldRevert, "Mock revert");
        return (1, answer, block.timestamp, updatedAt, 1);
    }
}
