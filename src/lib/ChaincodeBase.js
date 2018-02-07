const path = require('path');
const util = require('util');

const shim = require('fabric-shim');

const ChaincodeError = require('./ChaincodeError');
const TransactionHelper = require('./TransactionHelper');

const migrations = require('./../utils/migrations');
const loggerUtils = require('./../utils/logger');
const normalizePayload = require('./../utils/normalizePayload');

const ERRORS = require('./../constants/errors');

class ChaincodeBase {

    constructor() {
        this.migrating = false;
        this.logger = loggerUtils.getLogger(`chaincode/${this.name}`);
    }

    get name() {

        return this.constructor.name;
    }

    get migrationsPath() {

        throw new ChaincodeError(ERRORS.MIGRATION_PATH_NOT_DEFINED);
    }

    getTransactionHelperFor(stub) {

        return new TransactionHelper(stub);
    }

    async Init() {
        this.logger.info(`=========== Instantiated Chaincode ${this.name} ===========`);

        return shim.success();
    }

    async Invoke(stub) {
        try {
            this.logger.info(`=========== Invoked Chaincode ${this.name} ===========`);
            this.logger.info(`Transaction ID: ${stub.getTxID()}`);
            this.logger.info(util.format('Args: %j', stub.getArgs()));

            const ret = stub.getFunctionAndParameters();
            this.logger.info(ret);

            const method = this[ret.fcn];
            if (!method) {
                this.logger.error(`Unknown function ${ret.fcn}.`);

                return shim.error(new ChaincodeError(ERRORS.UNKNOWN_FUNCTION, {
                    'fn': ret.fcn
                }).serialized);
            }

            let payload = await method.call(this, stub, this.getTransactionHelperFor(stub), ...ret.params);

            if (!Buffer.isBuffer(payload)) {
                payload = Buffer.from(JSON.stringify(normalizePayload(payload)));
            }

            return shim.success(payload);
        } catch (err) {
            let error = err;

            const stacktrace = err.stack;

            if (!(err instanceof ChaincodeError)) {
                error = new ChaincodeError(ERRORS.UNKNOWN_ERROR, {
                    'message': err.message
                });
            }
            this.logger.error(stacktrace);
            this.logger.error(`Data of error ${err.message}: ${JSON.stringify(err.data)}`);

            return shim.error(error.serialized);
        }
    }

    async runMigrations(stub, txHelper, ...args) {
        this.migrating = true;
        const result = await migrations.runMigrations(this.migrationsPath, this, stub, txHelper, args);
        this.migrating = false;

        return result;
    }

    async ping() {

        return 'pong';
    }

}

module.exports = ChaincodeBase;
