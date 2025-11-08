// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockUniswapV3Pool {
    address public token0;
    address public token1;
    uint24 public fee;

    uint160 private sqrtPriceX96;
    int24 private tick;
    bool private shouldRevert;

    constructor(address _token0, address _token1, uint24 _fee) {
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
    }

    function setSlot0(uint160 _sqrtPriceX96, int24 _tick) external {
        sqrtPriceX96 = _sqrtPriceX96;
        tick = _tick;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function slot0()
        external
        view
        returns (
            uint160 _sqrtPriceX96,
            int24 _tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        require(!shouldRevert, "Mock pool slot0 reverted");
        return (sqrtPriceX96, tick, 0, 0, 0, 0, true);
    }
}
