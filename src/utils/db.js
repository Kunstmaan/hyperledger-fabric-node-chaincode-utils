const logger = require('./logger').getLogger('utils/db');
const normalizePayload = require('./normalizePayload');

const serialize = (value) => {
    if (_.isDate(value) || _.isString(value)) {

        return Buffer.from(normalizePayload(value).toString());
    }

    return Buffer.from(JSON.stringify(normalizePayload(value)));
};

const toObject = (buffer) => {
    if (buffer == null) {

        return undefined;
    }

    const bufferString = buffer.toString();
    if (bufferString.length <= 0) {

        return undefined;
    }

    return JSON.parse(bufferString);
};

const toDate = (buffer) => {
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

const toString = (buffer) => {
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
const iteratorToList = async function iteratorToList(iterator) {
    const allResults = [];
    let res;
    while (res == null || !res.done) {
        res = await iterator.next();
        if (res.value && res.value.value.toString()) {
            const jsonRes = {};
            logger.debug(res.value.value.toString('utf8'));

            jsonRes.key = res.value.key;
            try {
                jsonRes.record = JSON.parse(res.value.value.toString('utf8'));
            } catch (err) {
                logger.debug(err);
                jsonRes.record = res.value.value.toString('utf8');
            }
            allResults.push(jsonRes);
        }
    }

    logger.debug('end of data');
    await iterator.close();
    logger.info(JSON.stringify(allResults));

    return allResults;
};

module.exports = {
    iteratorToList,
    toObject,
    toDate,
    toString,
    serialize
};
