const mongoose = require('mongoose');
const logger = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.isConnected = false;
        this.connection = null;
    }

    /**
     * Connect to MongoDB Atlas
     */
    async connect() {
        try {
            if (this.isConnected) {
                logger.info('Database already connected');
                return;
            }

            const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
            if (!mongoUri) {
                throw new Error('MONGODB_URI or MONGO_URL environment variable is not set');
            }

            logger.info('Connecting to MongoDB Atlas...');

            // Connect with options for better performance and reliability
            this.connection = await mongoose.connect(mongoUri, {
                maxPoolSize: 10, // Maintain up to 10 socket connections
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
                dbName: 'magic-world-db',
                // Removed deprecated bufferCommands and bufferMaxEntries options
            });

            this.isConnected = true;
            logger.info('✅ Connected to MongoDB Atlas successfully');

            mongoose.connection.on('error', (error) => {
                logger.error('MongoDB connection error:', error);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                logger.info('MongoDB reconnected');
                this.isConnected = true;
            });

        } catch (error) {
            logger.error('Failed to connect to MongoDB:', error);
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }


    /**
     * Disconnect from MongoDB
     */
    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.disconnect();
                this.isConnected = false;
                logger.info('Disconnected from MongoDB');
            }
        } catch (error) {
            logger.error('Error disconnecting from MongoDB:', error);
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            readyState: mongoose.connection.readyState,
            name: mongoose.connection.name,
            host: mongoose.connection.host,
            port: mongoose.connection.port
        };
    }

    /**
     * Health check for database
     */
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'disconnected' };
            }

            // Simple ping to check if database is responsive
            await mongoose.connection.db.admin().ping();

            const collections = await mongoose.connection.db.listCollections().toArray();
            const dbStats = await mongoose.connection.db.stats();

            // Check if database was initialized by our service
            let isInitialized = false;
            try {
                const initDoc = await mongoose.connection.db.collection('__db_init__').findOne({ _id: 'database_created' });
                isInitialized = !!initDoc;
            } catch (error) {
                // Collection might not exist, that's okay
            }

            // Get connection pool info safely
            let connectionPool = { size: 0, available: 0 };
            try {
                const serverConfig = mongoose.connection.db?.serverConfig;
                if (serverConfig?.s) {
                    connectionPool = {
                        size: serverConfig.s.poolSize || 0,
                        available: serverConfig.s.availableConnections?.length || 0
                    };
                }
            } catch (poolError) {
                // Ignore connection pool info errors
                logger.debug('Could not get connection pool info:', poolError.message);
            }

            return {
                status: 'healthy',
                database: mongoose.connection.name,
                collections: collections.length,
                documents: dbStats.objects || 0,
                dataSize: dbStats.dataSize || 0,
                storageSize: dbStats.storageSize || 0,
                initialized: isInitialized,
                connectionPool
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

// Export singleton instance
const databaseService = new DatabaseService();
module.exports = databaseService;