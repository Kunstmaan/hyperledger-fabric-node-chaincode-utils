import _ from 'lodash'; // eslint-disable-line
import getLogger from './getLogger';
import normalizePayload from './normalizePayload';
import timestampToDate from './timestampToDate';
import {Iterators} from 'fabric-shim';

const logger = getLogger('utils/db');

export function serialize(value: any): Buffer {
    if (_.isDate(value) || _.isString(value)) {

        return Buffer.from(normalizePayload(value).toString());
    }

    return Buffer.from(JSON.stringify(normalizePayload(value)));
};

export function toObject(buffer: Buffer): any {
    if (buffer == null) {

        return undefined;
    }

    const bufferString = buffer.toString();
    if (bufferString.length <= 0) {

        return undefined;
    }

    return JSON.parse(bufferString);
};

export function toDate(buffer: Buffer): Date {
    if (buffer == null) {

        return undefined;
    }

    const bufferString = buffer.toString();
    if (bufferString.length <= 0) {

        return undefined;
    }

    if (/\d+/g.test(bufferString)) {

        return new Date(parseInt(bufferString, 10));
    }

    return undefined;
};

export function toString(buffer): string {
    if (buffer == null) {

        return null;
    }

    return buffer.toString();
};

/**
 *   Creates an array of objects from the query iterator.
 *   Each object has two keys:
 *   - key: the key of the object in the database
 *   - record: the value associated to that key in the database,
 *           according to the query
 *   @param {StateQueryIterator} iterator the query iterator
 *   @return {Array[Object]} an array with the result of the query
 */
export async function iteratorToList(iterator: Iterators.StateQueryIterator): Promise<any> {
    const allResults = [];
    let res;
    while (res == null || !res.done) {
        res = await iterator.next();
        if (res.value && res.value.value.toString()) {
            const jsonRes = {};
            logger.debug(res.value.value.toString('utf8'));

            jsonRes['key'] = res.value.key;
            try {
                jsonRes['record'] = JSON.parse(res.value.value.toString('utf8'));
            } catch (err) {
                logger.debug(err);
                jsonRes['record'] = res.value.value.toString('utf8');
            }

            if (res.value.timestamp) {
                jsonRes['lastModifiedOn'] = timestampToDate(res.value.timestamp);
            }

            allResults.push(jsonRes);
        }
    }

    logger.debug('end of data');
    await iterator.close();
    logger.info(JSON.stringify(allResults));

    return allResults;
};
