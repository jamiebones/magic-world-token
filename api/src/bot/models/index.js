/**
 * Bot Models Index
 * Exports all database models for the bot system
 */

const Trade = require('./Trade');
const PriceHistory = require('./PriceHistory');
const BotConfig = require('./BotConfig');

module.exports = {
    Trade,
    PriceHistory,
    BotConfig
};
