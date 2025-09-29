# Contract ABIs

This folder contains the Application Binary Interface (ABI) files for the Magic World Token smart contracts. These ABIs are used by the API to interact with the deployed contracts on the blockchain.

## Files

- **MagicWorldToken.json** - ABI for the main ERC20 token contract with batch transfer functionality
- **MagicWorldGame.json** - ABI for the game contract that manages token distribution and player statistics
- **IMagicWorldToken.json** - Interface ABI for type checking and development

## Usage

These files are automatically imported by the blockchain service (`src/services/blockchain.js`) to create contract instances for interacting with the deployed contracts.

## Updating ABIs

When contracts are redeployed or modified:

1. Recompile contracts with Hardhat: `npm run compile`
2. Copy updated ABI files from `../../../artifacts/contracts/` to this folder
3. Test the API to ensure compatibility
4. Commit the updated ABIs

## Note

These ABI files are specific to the deployed contract versions and should be kept in sync with the actual deployed contracts.