const log4js = require('log4js');

/**
 * @param {String} name
 *
 * @return a log4j logger object prefixed with the given name.
 */
module.exports.getLogger = function(name) {
    const logger = log4js.getLogger(`chaincode-utils/${name}`);

    // set the logging level based on the environment variable
    // configured by the peer
    const level = process.env.CHAINCODE_LOGGING_LEVEL;
    let loglevel = 'debug';
    if (typeof level === 'string') {
        switch (level.toUpperCase()) {
            case 'CRITICAL':
                loglevel = 'fatal';
                break;
            case 'ERROR':
                loglevel = 'error';
                break;
            case 'WARNING':
                loglevel = 'warn';
                break;
            case 'DEBUG':
                loglevel = 'debug';
        }
    }

    logger.level = loglevel;

    return logger;
};
