const { isAddress } = require('ethers');

/**
 * Validate Ethereum address
 */
function validateAddress(req, res, next) {
    const { address } = req.params;

    if (!address || !isAddress(address)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Ethereum address'
        });
    }

    next();
}

/**
 * Validate pagination parameters
 */
function validatePagination(req, res, next) {
    const { limit, offset } = req.query;

    if (limit && (isNaN(limit) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid limit parameter (must be between 1 and 100)'
        });
    }

    if (offset && (isNaN(offset) || parseInt(offset) < 0)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid offset parameter (must be >= 0)'
        });
    }

    next();
}

/**
 * Validate order type parameter
 */
function validateOrderType(req, res, next) {
    const { orderType } = req.query;

    if (orderType !== undefined && orderType !== null) {
        const type = parseInt(orderType);
        if (isNaN(type) || (type !== 0 && type !== 1)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid orderType (must be 0 for Buy or 1 for Sell)'
            });
        }
    }

    next();
}

/**
 * Validate status parameter
 */
function validateStatus(req, res, next) {
    const { status } = req.query;

    if (status !== undefined && status !== null) {
        const statusValue = parseInt(status);
        if (isNaN(statusValue) || statusValue < 0 || statusValue > 3) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status (must be 0-3: Active, Filled, Cancelled, Expired)'
            });
        }
    }

    next();
}

/**
 * Validate date range parameters
 */
function validateDateRange(req, res, next) {
    const { startDate, endDate } = req.query;

    if (startDate && isNaN(Date.parse(startDate))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid startDate format'
        });
    }

    if (endDate && isNaN(Date.parse(endDate))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid endDate format'
        });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({
            success: false,
            error: 'startDate must be before endDate'
        });
    }

    next();
}

module.exports = {
    validateAddress,
    validatePagination,
    validateOrderType,
    validateStatus,
    validateDateRange
};
