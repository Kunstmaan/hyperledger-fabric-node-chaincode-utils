import grpc from 'grpc';
import path from 'path';
import _ from 'lodash';

import ChaincodeError from './ChaincodeError';
import ERRORS from './../constants/errors';

import getLogger from './../utils/getLogger';
import * as dbUtils from './../utils/db';
import * as identityUtils from './../utils/identity';
import parseErrorMessage from './../utils/parseErrorMessage';
import timestampToDate from './../utils/timestampToDate';

const chaincodeProto = grpc.load({
    root: path.join(process.cwd(), 'node_modules/fabric-shim/lib/protos'),
    file: 'peer/chaincode.proto'
}).protos;

import { ChaincodeStub } from 'fabric-shim';
import { Logger } from 'log4js';

// Keep track of sequence number
// This needs to be a global variable as every time a
// new chaincode is invoked this should not be resetted
// for example if this chaincode is invoked multiple times from
// within another chaincode.
let cachedIdSequences = {};
const ID_SEQUENCE_TTL = (30 * 60 * 1000);

export default class TransactionHelper {

    stub: ChaincodeStub
    logger: Logger

    constructor(stub: ChaincodeStub) {
        this.stub = stub;
        this.logger = getLogger('lib/TransactionHelper');
    }

    /**
     * Generate a UUID for the given prefix.
     *
     * @param {String} prefix
     */
    uuid(prefix: string): string {
        validateRequiredString({prefix});

        const txId = this.stub.getTxID();
        const txTimestamp = this.getTxDate().getTime();

        cachedIdSequences[prefix] = cachedIdSequences[prefix] || {};
        const latestId = cachedIdSequences[prefix][txId] != null ? cachedIdSequences[prefix][txId] : {
            'value': -1
        };

        latestId.value += 1;
        latestId.lastUsed = txTimestamp;

        cachedIdSequences[prefix][txId] = latestId;

        // clean up old transaction ids;
        const cleanedIdSequences = {};
        _.each(cachedIdSequences, (txs, p) => {
            _.each(txs, (id, t) => {
                if (id.lastUsed > txTimestamp - ID_SEQUENCE_TTL) {
                    cleanedIdSequences[p] = cleanedIdSequences[p] || {};
                    cleanedIdSequences[p][t] = id;
                }
            });
        });

        cachedIdSequences = cleanedIdSequences;

        return `${prefix}_${txId}_${latestId.value}`;
    }

    /**
     * A helper function around the invokeChaincode of the stub that will throw a ChaincodeError
     * if the invocation failed or return the parsed result when it succeeded.
     *
     * @param {String} chaincodeName
     * @param {String} functionName
     * @param {Array} args
     * @param {String} channel
     */
    async invokeChaincode(chaincodeName: string, functionName: string, args: Array<any> = undefined, channel: string = undefined): Promise<any> {
        validateRequiredString({chaincodeName});
        validateRequiredString({functionName});

        let invokeArgs = [functionName];
        if (_.isArray(args)) {
            invokeArgs = invokeArgs.concat(args.map((a) => {
                if (!_.isString(a)) {

                    return JSON.stringify(a);
                }

                return a;
            }));
        }

        return new Promise((fulfill, reject) => {
            // do this in a timeout to make sure the txId
            // is released when another chaincode is invoked before.
            // @ref https://jira.hyperledger.org/browse/FAB-7437
            setTimeout(async () => {
                const invokeChannel = channel || this.stub.getChannelID();

                try {
                    const invokeResult = await this.stub.invokeChaincode(chaincodeName, invokeArgs, invokeChannel);

                    if (invokeResult == null || invokeResult.status !== 200) {

                        throw new ChaincodeError(ERRORS.CHAINCODE_INVOKE_ERROR, {
                            'chaincodeName': chaincodeName,
                            'args': invokeArgs,
                            'channel': invokeChannel,
                            'status': invokeResult ? invokeResult.status : undefined,
                            'payload': invokeResult ? invokeResult.payload : undefined
                        });
                    }

                    fulfill(JSON.parse(invokeResult.payload.toString('utf8')));
                } catch (error) {
                    let ccError;

                    if (error instanceof ChaincodeError) {
                        ccError = error;
                    } else {
                        this.logger.error(`Error while calling ${chaincodeName} with args ${args} on channel ${invokeChannel}`);

                        // @todo what happens here? where does key, data, stack come from?
                        const errorData = parseErrorMessage(error.message);
                        if (_.isUndefined(errorData.key)) {
                            ccError = new ChaincodeError(ERRORS.CHAINCODE_INVOKE_ERROR, {'message': error.message}, error.stack);
                        } else {
                            ccError = new ChaincodeError(errorData.key, errorData.data, errorData.stack);
                        }
                    }
                    reject(ccError);
                }
            }, 100);
        });
    }

    /**
     * This function checks if the current chaincode is invoked by another chaincode.
     *
     * @param {String} chaincodeName the name of the chaincode
     * @param {String} functionName the name of the function. If undefined, will be ignored
     *
     * @return true if this function is called from the chaincode and function given.
     *         if func is undefined, will ignore the function.
     */
    invokedByChaincode(chaincodeName: string, functionName: string = undefined): boolean {
        validateRequiredString({chaincodeName});

        validate({functionName}, (value) => {
            return _.isUndefined(value) || _.isString(value);
        }, 'string');

        const proposal = this.stub.getSignedProposal().getProposalBytes();
        const input = chaincodeProto.ChaincodeInput.decode(_.clone(proposal.payload.input));
        const args = input.args.map((entry) => {

            return entry.toBuffer().toString('utf8');
        });

        this.logger.debug(`Chaincode parent args: ${args}`);
        const idxOfCC = args[0].indexOf(chaincodeName);
        const idxOfFunc = args[0].indexOf(functionName);

        if (_.isUndefined(functionName)) {

            return idxOfCC > -1;
        }

        return idxOfCC < idxOfFunc && idxOfCC > -1;
    }

    /**
     * Query the state and return a list of results.
     *
     * @param {Object} query
     *
     * @return a list of objects in the following format
     * {
     *   key: [String] <DB ID>
     *   record: [Object] <DB content for that ID>
     * }
     */
    async getQueryResultAsList(query: object): Promise<any> {
        validateQuery(query);

        const queryString = JSON.stringify(query);
        this.logger.debug(`Query: ${queryString}`);
        const iterator = await this.stub.getQueryResult(queryString);

        return dbUtils.iteratorToList(iterator);
    }

    /**
    *   Deletes all objects returned by the query
    *   @param {Object} query the query
    */
    async deleteAllReturnedByQuery(query: object): Promise<void> {
        validateQuery(query);

        const allResults = await this.getQueryResultAsList(query);

        return Promise.all(allResults.map((record) => this.stub.deleteState(record.key))).then(() => { return });
    }

    /**
     * Serializes the value and store it on the state db.
     *
     * @param {String} key
     */
    async putState(key, value): Promise<void> {
        validateRequiredString({key});

        return this.stub.putState(key, dbUtils.serialize(value));
    }

    /**
     * @param {String} key
     *
     * @return the state for the given key parsed as an Object
     */
    async getStateAsObject(key: string): Promise<any> {
        validateRequiredString({key});

        const rawValue = await this.stub.getState(key);

        return dbUtils.toObject(rawValue);
    }

    /**
     * @param {String} key
     *
     * @return the state for the given key parsed as a String
     */
    async getStateAsString(key: string): Promise<string> {
        validateRequiredString({key});

        const rawValue = await this.stub.getState(key);

        return dbUtils.toString(rawValue);
    }

    /**
     * @param {String} key
     *
     * @return the state for the given key parsed as a Date
     */
    async getStateAsDate(key: string): Promise<Date> {
        validateRequiredString({key});

        const rawValue = await this.stub.getState(key);

        return dbUtils.toDate(rawValue);
    }

    /**
     * @return the Transaction date as a Javascript Date Object.
     */
    getTxDate(): Date {
        const timestamp = this.stub.getTxTimestamp();

        return timestampToDate(timestamp);
    }

    /**
     * Returns the Certificate from the Transaction creator
     *
     * @todo fix this ... types from jrsasign
     */
    getCreatorCertificate(): X509 {

        return identityUtils.getCertificateFromStub(this.stub);
    }

    /**
     * Returns the Public Key from the Transaction creator as a SHA3 256 Hash
     */
    getCreatorPublicKey(): string {

        return identityUtils.getPublicKeyHashFromStub(this.stub);
    }

    /**
     * Publish an event to the Blockchain
     *
     * @param {String} name
     * @param {Object} payload
     */
    setEvent(name: string, payload: object): void {
        let bufferedPayload;

        if (Buffer.isBuffer(payload)) {
            bufferedPayload = payload;
        } else {
            bufferedPayload = Buffer.from(JSON.stringify(payload));
        }

        this.logger.debug(`Setting Event ${name} with payload ${JSON.stringify(payload)}`);

        return this.stub.setEvent(name, bufferedPayload);
    }

};

function validateRequiredString(params: object) {
    return validate(params, (value) => {
        return _.isString(value) && !_.isEmpty(value);
    }, 'string');
}

function validateQuery(query: object): void {
    validate({query}, _.isObject, 'object');
}

function validate(params: object, validator: Function, expected: string): void {
    for (const paramName in params) {
        if ({}.hasOwnProperty.call(params, paramName)) {
            const paramValue = params[paramName];

            if (!validator(paramValue)) {

                throw new ChaincodeError(ERRORS.TYPE_ERROR, {
                    'arg': paramName,
                    'value': paramValue,
                    'expected': expected
                });
            }
        }
    }
}
