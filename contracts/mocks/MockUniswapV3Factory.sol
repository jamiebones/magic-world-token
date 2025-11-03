// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockUniswapV3Factory {
    mapping(address => mapping(address => mapping(uint24 => address)))
        private pools;

    function setPool(
        address tokenA,
        address tokenB,
        uint24 fee,
        address pool
    ) external {
        pools[tokenA][tokenB][fee] = pool;
        pools[tokenB][tokenA][fee] = pool;
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address) {
        return pools[tokenA][tokenB][fee];
    }
}
