// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Minimal mock of a UniswapV3/PancakeSwap V3 pool with slot0()
contract MockPool {
    uint160 private _sqrtPriceX96;
    int24 private _tick;

    constructor(uint160 sqrtPriceX96_, int24 tick_) {
        _sqrtPriceX96 = sqrtPriceX96_;
        _tick = tick_;
    }

    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        return (_sqrtPriceX96, _tick, 0, 1, 1, 0, true);
    }

    // allow updating for test purposes
    function setSlot0(uint160 sqrtPriceX96_, int24 tick_) external {
        _sqrtPriceX96 = sqrtPriceX96_;
        _tick = tick_;
    }
}
