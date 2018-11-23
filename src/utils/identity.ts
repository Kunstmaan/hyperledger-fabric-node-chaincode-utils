
import _ from 'lodash'; // eslint-disable-line
import {X509} from 'jsrsasign';
import {sha3_256} from 'js-sha3'; // eslint-disable-line

import getLogger from './getLogger';
import ChaincodeError from './../lib/ChaincodeError';
import ERRORS from './../constants/errors';
import { ChaincodeStub } from 'fabric-shim';

const logger = getLogger('utils/identity');

export function normalizeX509PEM(raw: string): string {
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

export function getCertificateFromPEM(pem: string): X509 {
    const normalizedPEM = normalizeX509PEM(pem);

    const cert = new X509();
    cert.readCertPEM(normalizedPEM);

    return cert;
};

export function getCertificateFromStub(stub: ChaincodeStub): X509 {

    return getCertificateFromPEM(getPEMFromStub(stub));
};

export function getPublicKeyHashFromPEM(pem: string): string {
    const cert = getCertificateFromPEM(pem);
    const publicKey = cert.getPublicKeyHex();
    const publicKeyHash = sha3_256(publicKey);

    logger.info(`Public key: ${publicKey}`);
    logger.info(`Public key Hash: ${publicKeyHash}`);

    return publicKeyHash;
};

export function getPublicKeyHashFromStub(stub: ChaincodeStub): string {

    return getPublicKeyHashFromPEM(getPEMFromStub(stub));
};

export function validatePublicKeyHash(hash: string): boolean {
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

function getPEMFromStub(stub: ChaincodeStub): string {
    const signingId = stub.getCreator();
    const idBytes = signingId.getIdBytes();

    return idBytes.toString();
}
