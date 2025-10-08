#!/usr/bin/env node

/**
 * Setup script to generate secure encryption key for wallet private keys
 * Run this once during initial setup
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('\n🔐 Magic World Token - Wallet Encryption Key Generator\n');
console.log('═'.repeat(60));
console.log('\nThis script generates a secure 256-bit encryption key for');
console.log('encrypting wallet private keys in the database.\n');
console.log('⚠️  IMPORTANT: Store this key securely and NEVER commit it to git!\n');
console.log('═'.repeat(60));
console.log('\n');

// Generate 32-byte (256-bit) random key
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('✅ Generated encryption key:\n');
console.log('WALLET_ENCRYPTION_KEY=' + encryptionKey);
console.log('\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envLocalPath = path.join(__dirname, '..', '.env.local');

let envContent = '';
try {
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    } else if (fs.existsSync(envLocalPath)) {
        envContent = fs.readFileSync(envLocalPath, 'utf8');
    }
} catch (error) {
    // Ignore errors
}

// Check if key already exists
if (envContent.includes('WALLET_ENCRYPTION_KEY=')) {
    console.log('⚠️  WARNING: WALLET_ENCRYPTION_KEY already exists in your .env file!');
    console.log('   If you replace it, existing encrypted wallets will be unrecoverable.');
    console.log('   Only proceed if you want to start fresh.\n');
} else {
    console.log('📝 Add this line to your .env or .env.local file:\n');
    console.log('   WALLET_ENCRYPTION_KEY=' + encryptionKey);
    console.log('\n');
}

console.log('═'.repeat(60));
console.log('\n📋 Security Checklist:\n');
console.log('  ✓ Add WALLET_ENCRYPTION_KEY to your .env file');
console.log('  ✓ Ensure .env is in .gitignore');
console.log('  ✓ Back up the key in a secure location (password manager)');
console.log('  ✓ Use environment-specific keys (dev, staging, production)');
console.log('  ✓ NEVER share or commit the encryption key');
console.log('\n');
console.log('═'.repeat(60));
console.log('\n💡 Tips:\n');
console.log('  • If you lose this key, you cannot decrypt existing wallets');
console.log('  • Use different keys for development and production');
console.log('  • Consider using a secrets management service in production');
console.log('  • Rotate keys periodically (requires re-encrypting wallets)');
console.log('\n');

// Optionally write to .env.example
const examplePath = path.join(__dirname, '..', '.env.example');
try {
    let exampleContent = '';
    if (fs.existsSync(examplePath)) {
        exampleContent = fs.readFileSync(examplePath, 'utf8');
    }

    if (!exampleContent.includes('WALLET_ENCRYPTION_KEY=')) {
        const additionalContent = '\n# Wallet encryption key (32 bytes / 64 hex characters)\n# Generate with: node scripts/generate-wallet-key.js\nWALLET_ENCRYPTION_KEY=your_64_character_hex_key_here\n';
        fs.writeFileSync(examplePath, exampleContent + additionalContent);
        console.log('✅ Added WALLET_ENCRYPTION_KEY to .env.example\n');
    }
} catch (error) {
    // Ignore errors
}

console.log('🚀 You can now use the wallet generation endpoints!\n');
