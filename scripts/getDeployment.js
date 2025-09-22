const fs = require('fs');
const path = require('path');

/**
 * Get deployed contract addresses for a specific network
 * @param {string} network - Network name (e.g., 'polygonAmoy', 'polygon')
 * @returns {object} Deployment info including contract addresses
 */
function getDeployment(network) {
    const deploymentFile = path.join(__dirname, '..', 'deployments', `${network}.json`);

    if (!fs.existsSync(deploymentFile)) {
        throw new Error(`No deployment found for network: ${network}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    return deployment;
}

/**
 * Get all available deployments
 * @returns {object} All deployments indexed by network name
 */
function getAllDeployments() {
    const deploymentsDir = path.join(__dirname, '..', 'deployments');

    if (!fs.existsSync(deploymentsDir)) {
        return {};
    }

    const deployments = {};
    const files = fs.readdirSync(deploymentsDir);

    files.forEach(file => {
        if (file.endsWith('.json')) {
            const network = file.replace('.json', '');
            deployments[network] = getDeployment(network);
        }
    });

    return deployments;
}

/**
 * Print deployment summary for a network
 * @param {string} network - Network name
 */
function printDeployment(network) {
    try {
        const deployment = getDeployment(network);

        console.log(`\n=== ${network.toUpperCase()} DEPLOYMENT ===`);
        console.log(`Deployer: ${deployment.deployer}`);
        console.log(`Deployed: ${new Date(deployment.timestamp).toLocaleString()}`);
        console.log(`\nContract Addresses:`);
        console.log(`Token Contract: ${deployment.contracts.token.address}`);
        console.log(`Game Contract: ${deployment.contracts.game.address}`);
        console.log(`\nToken Details:`);
        console.log(`Name: ${deployment.contracts.token.name}`);
        console.log(`Symbol: ${deployment.contracts.token.symbol}`);
        console.log(`Total Supply: ${deployment.contracts.token.totalSupply}`);

    } catch (error) {
        console.error(`Error reading deployment for ${network}:`, error.message);
    }
}

module.exports = {
    getDeployment,
    getAllDeployments,
    printDeployment
};

// CLI usage
if (require.main === module) {
    const network = process.argv[2];

    if (!network) {
        console.log('Usage: node scripts/getDeployment.js <network>');
        console.log('Available networks:', Object.keys(getAllDeployments()));
        process.exit(1);
    }

    printDeployment(network);
}