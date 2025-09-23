#!/usr/bin/env node

/**
 * MongoDB Atlas Setup Helper
 * Helps configure MongoDB Atlas connection for the Magic World Token API
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function setupMongoDB() {
    console.log('🔧 MongoDB Atlas Setup for Magic World Token API');
    console.log('================================================\n');

    console.log('This script will help you configure MongoDB Atlas for your API.\n');

    console.log('📋 Prerequisites:');
    console.log('1. Create a MongoDB Atlas account at https://cloud.mongodb.com');
    console.log('2. Create a new cluster (free tier is fine)');
    console.log('3. Create a database user');
    console.log('4. Whitelist your IP address (or 0.0.0.0/0 for testing)');
    console.log('5. Get your connection string from the "Connect" button\n');

    const hasAtlasAccount = await ask('Do you have a MongoDB Atlas account set up? (y/n): ');

    if (hasAtlasAccount.toLowerCase() !== 'y') {
        console.log('\n❌ Please set up MongoDB Atlas first, then run this script again.');
        console.log('Visit: https://cloud.mongodb.com');
        rl.close();
        return;
    }

    const connectionString = await ask('Enter your MongoDB Atlas connection string: ');

    if (!connectionString.includes('mongodb+srv://') && !connectionString.includes('mongodb://')) {
        console.log('\n❌ Invalid connection string format. It should start with mongodb+srv:// or mongodb://');
        rl.close();
        return;
    }

    // Update .env file
    const envPath = path.join(__dirname, '.env');

    try {
        let envContent = fs.readFileSync(envPath, 'utf8');

        // Replace or add MONGODB_URI
        const mongoUriRegex = /^MONGODB_URI=.*/m;
        if (mongoUriRegex.test(envContent)) {
            envContent = envContent.replace(mongoUriRegex, `MONGODB_URI=${connectionString}`);
        } else {
            envContent += `\nMONGODB_URI=${connectionString}`;
        }

        fs.writeFileSync(envPath, envContent);

        console.log('\n✅ MongoDB Atlas configured successfully!');
        console.log(`📝 Updated ${envPath} with your connection string`);

        console.log('\n🧪 Testing connection...');
        console.log('Run: npm run dev');
        console.log('Then check: curl http://localhost:3000/health/detailed');

        console.log('\n📚 Next steps:');
        console.log('1. The API will automatically create the database and collections');
        console.log('2. A default development API key will be created on first run');
        console.log('3. Check the logs for the generated API key');

    } catch (error) {
        console.error('\n❌ Error updating .env file:', error.message);
    }

    rl.close();
}

// Handle Ctrl+C
rl.on('SIGINT', () => {
    console.log('\n\n👋 Setup cancelled.');
    rl.close();
    process.exit(0);
});

setupMongoDB().catch(console.error);