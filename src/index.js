const ChaincodeBase = require('./lib/ChaincodeBase');
const ChaincodeError = require('./lib/ChaincodeError');
const TransactionHelper = require('./lib/TransactionHelper');

const logger = require('./utils/logger');
const normalizePayload = require('./utils/normalizePayload');
const identity = require('./utils/identity');
const migrations = require('./utils/migrations');
const {iteratorToList} = require('./utils/db')

module.exports = {
    ChaincodeBase,
    ChaincodeError,
    TransactionHelper,
    utils: {
        logger,
        normalizePayload,
        identity,
        migrations,
        db: {iteratorToList}
    }
};
