require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();


const fs = require("fs");
const path = require("path");
const { Wallet } = require("ethers");

function loadWalletFromKeystore() {
    const keystorePath = path.join(__dirname, "keystore");
    const files = fs.readdirSync(keystorePath).filter(f => f.endsWith(".json"));
    if (files.length === 0) throw new Error("No keystore file found in keystore/");
    const json = fs.readFileSync(path.join(keystorePath, files[0]), "utf8");
    const password = process.env.KEY_PASSWORD;
    if (!password) throw new Error("Set KEY_PASSWORD in .env");
    const wallet = Wallet.fromEncryptedJsonSync(json, password);
    return wallet;
}

const wallet = loadWalletFromKeystore();



/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 800, // Increased from 200 - optimizes for runtime gas efficiency
            },
            
            viaIR: true,
        },
    },
    networks: {
        hardhat: {
            chainId: 31337,
            gas: "auto",
            gasPrice: "auto",
            accounts: {
                mnemonic: process.env.MNEMONIC || "test test test test test test test test test test test junk",
                count: 20,
            },
            forking: {
                url: process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org/",
                enabled: process.env.FORK === "true",
                blockNumber: process.env.FORK_BLOCK_NUMBER ? Number(process.env.FORK_BLOCK_NUMBER) : undefined,
            },
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 31337,
        },
        polygonAmoy: {
            url: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
            accounts: wallet.privateKey ? [wallet.privateKey] : [],
            chainId: 80002,
            gasPrice: 35000000000, // 35 gwei
            gas: 6000000,
        },
        polygon: {
            url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
            accounts: wallet.privateKey ? [wallet.privateKey] : [],
            chainId: 137,
            gasPrice: 200000000000, // 200 gwei (adjust based on network conditions)
            gas: 6000000,
        },
        bscTestnet: {
            url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
            accounts: wallet.privateKey ? [wallet.privateKey] : [],
            chainId: 97,
            gasPrice: 10000000000, // 10 gwei
            gas: 6000000,
        },
        bsc: {
            url: process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org/",
            accounts: wallet.privateKey ? [wallet.privateKey] : [],
            chainId: 56,
            gasPrice: 5000000000, // 5 gwei
            gas: 6000000,
        },
    },
    etherscan: {
        apiKey: process.env.BSCSCAN_API_KEY || "",
        customChains: [
            {
                network: "polygonAmoy",
                chainId: 80002,
                urls: {
                    apiURL: "https://api-amoy.polygonscan.com/api",
                    browserURL: "https://amoy.polygonscan.com"
                }
            },
            {
                network: "bscTestnet",
                chainId: 97,
                urls: {
                    apiURL: "https://api-testnet.bscscan.com/api",
                    browserURL: "https://testnet.bscscan.com"
                }
            },
            {
                network: "bsc",
                chainId: 56,
                urls: {
                    apiURL: "https://api.bscscan.com/api",
                    browserURL: "https://bscscan.com"
                }
            }
        ]
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD",
        gasPrice: 200, // gwei
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
        token: "MATIC",
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: true,
        strict: true,
    },
    mocha: {
        timeout: 40000,
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};