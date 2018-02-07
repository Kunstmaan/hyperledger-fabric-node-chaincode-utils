const ChaincodeBase = require('./lib/ChaincodeBase');
const ChaincodeError = require('./lib/ChaincodeError');

const logger = require('./utils/logger');
const normalizePayload = require('./utils/normalizePayload');
const identity = require('./utils/identity');
const migrations = require('./utils/migrations');

module.exports = {
    ChaincodeBase,
    ChaincodeError,
    utils: {
        logger,
        normalizePayload,
        identity,
        migrations
    }
};
