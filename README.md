# Magic World Token

A play-to-earn ERC20 token system deployed on Polygon, designed for casual players with gas-efficient batch operations and role-based access control.

## Features

- **ERC20 Token** with batch transfer capabilities
- **Role-based access control** using OpenZeppelin AccessControl
- **Gas-optimized** for Polygon network
- **Fixed supply** with no inflation
- **Game contract** manages all token distribution
- **Non-upgradeable** for maximum security

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Compile contracts:**
   ```bash
   npm run compile
   ```

4. **Run tests:**
   ```bash
   npm run test
   ```

5. **Deploy to Polygon Mumbai (testnet):**
   ```bash
   npm run deploy:mumbai
   ```

6. **Deploy to Polygon mainnet:**
   ```bash
   npm run deploy:polygon
   ```

## Architecture

- **MagicWorldToken.sol**: ERC20 token with batch operations and RBAC
- **MagicWorldGame.sol**: Game logic contract that owns and distributes tokens
- **Polygon Network**: Chosen for low gas costs suitable for casual players

## Development

See [Copilot Instructions](.github/copilot-instructions.md) for detailed development guidance.

## License

MIT