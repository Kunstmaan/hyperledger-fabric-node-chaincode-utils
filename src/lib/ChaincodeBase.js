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

    /**
     * @returns the name of the current chaincode.
     */
    get name() {

        return this.constructor.name;
    }

    /**
     * @returns the path where the migrations can be found for the current chaincode.
     */
    get migrationsPath() {

        throw new ChaincodeError(ERRORS.MIGRATION_PATH_NOT_DEFINED);
    }

    /**
     * @returns the transaction helper for the given stub. This can be used to extend
     * the Default TransactionHelper with extra functionality and return your own instance.
     */
    getTransactionHelperFor(stub) {

        return new TransactionHelper(stub);
    }

    /**
     * @param {Array} params
     * @returns the parsed parameters
     */
    parseParameters(params) {
        const parsedParams = [];

        params.forEach((param) => {
            try {
                // try to parse ...
                parsedParams.push(JSON.parse(param));
            } catch (err) {
                // if it fails fall back to original param
                this.logger.error(`failed to parse param ${param}`);
                parsedParams.push(param);
            }
        });

        return parsedParams;
    }

    /**
     * Called when Instantiating chaincode
     */
    async Init() {
        this.logger.info(`=========== Instantiated Chaincode ${this.name} ===========`);

        return shim.success();
    }

    /**
     * Basic implementation that redirects Invocations to the right functions on this instance
     */
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

            let parsedParameters;
            try {
                parsedParameters = this.parseParameters(ret.params);
            } catch (err) {
                throw new ChaincodeError(ERRORS.PARSING_PARAMETERS_ERROR, {
                    'message': err.message
                });
            }

            let payload = await method.call(this, stub, this.getTransactionHelperFor(stub), ...parsedParameters);

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

    /**
     * Run Migrations for the current chaincode.
     *
     * @param {Stub} stub
     * @param {TransactionHelper} txHelper
     * @param {Array} args
     */
    async runMigrations(stub, txHelper, ...args) {
        this.migrating = true;
        const result = await migrations.runMigrations(this.migrationsPath, this, stub, txHelper, args);
        this.migrating = false;

        return result;
    }

    /**
     * Returns 'pong' when everything is correct.
     */
    async ping() {

        return 'pong';
    }

}

module.exports = ChaincodeBase;
