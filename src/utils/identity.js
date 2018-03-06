
const _ = require('lodash'); // eslint-disable-line
const {X509} = require('jsrsasign');
const {sha3_256} = require('js-sha3'); // eslint-disable-line

const logger = require('./logger').getLogger('utils/identity');

const ChaincodeError = require('./../lib/ChaincodeError');
const ERRORS = require('./../constants/errors');

const normalizeX509PEM = function(raw) {
    logger.debug(`[normalizeX509]raw cert: ${raw}`);

    const regex = /(-----\s*BEGIN ?[^-]+?-----)([\s\S]*)(-----\s*END ?[^-]+?-----)/;
    let matches = raw.match(regex);

    if (!matches || matches.length !== 4) {

        throw new ChaincodeError(ERRORS.INVALID_CERTIFICATE, {
            'cert': raw
        });
    }

    // remove the first element that is the whole match
    matches.shift();
    // remove LF or CR
    matches = matches.map((element) => {
        return element.trim();
    });

    // make sure '-----BEGIN CERTIFICATE-----' and '-----END CERTIFICATE-----' are in their own lines
    // and that it ends in a new line
    return `${matches.join('\n')}\n`;
};

const getCertificateFromPEM = function(pem) {
    const normalizedPEM = normalizeX509PEM(pem);

    const cert = new X509();
    cert.readCertPEM(normalizedPEM);

    return cert;
};

const getCertificateFromStub = function(stub) {

    return getCertificateFromPEM(getPEMFromStub(stub));
};

const getPublicKeyHashFromPEM = function(pem) {
    const cert = getCertificateFromPEM(pem);
    const publicKey = cert.getPublicKeyHex();
    const publicKeyHash = sha3_256(publicKey);

    logger.info(`Public key: ${publicKey}`);
    logger.info(`Public key Hash: ${publicKeyHash}`);

    return publicKeyHash;
};

const getPublicKeyHashFromStub = function(stub) {

    return getPublicKeyHashFromPEM(getPEMFromStub(stub));
};

const validatePublicKeyHash = function(hash) {
    if (!_.isString(hash)) {

        return false;
    }

    // sha3_256 = 32 bytes long
    if (hash.length !== 64) {

        return false;
    }

    // check for hexadecimal signs
    if (!/^(\d|[A-F]|[a-f])+$/.test(hash)) {

        return false;
    }

    return true;
};

module.exports = {
    normalizeX509PEM,

    validatePublicKeyHash,

    getCertificateFromStub,
    getCertificateFromPEM,

    getPublicKeyHashFromStub,
    getPublicKeyHashFromPEM
};

function getPEMFromStub(stub) {
    const signingId = stub.getCreator();
    const idBytes = signingId.getIdBytes().toBuffer();

    return idBytes.toString();
}
