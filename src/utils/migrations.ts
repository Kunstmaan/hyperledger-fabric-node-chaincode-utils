import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import getLogger from './getLogger';

import TransactionHelper from './../lib/TransactionHelper';
import {ChaincodeStub} from 'fabric-shim';

const logger = getLogger('migrations/runMigrations');

export const MIGRATION_FILE_REGEX = /^Version-([0-9]+)\.js/i;
export const MIGRATION_STATE_KEY = 'last-update-time';

// @todo, args any?
export async function runMigrations(migrationsDir: string, contract: string, stub: ChaincodeStub, txHelper: TransactionHelper, args: Array<any>): Promise<Array<string>> {
    const lastUpdateTime = await txHelper.getStateAsDate(MIGRATION_STATE_KEY);

    const files = await loadFiles(migrationsDir);
    const migrationFiles = getMigrationFiles(files, lastUpdateTime);

    if (migrationFiles.length === 0) {

        return []; // @todo? return 'No migrations to execute';
    }

    for (const file of migrationFiles) {
        const migrate = require(path.join(migrationsDir, file));
        logger.info(`Running migration for file ${file}`);
        await migrate(contract, stub, txHelper, args);
    }

    txHelper.putState(MIGRATION_STATE_KEY, txHelper.getTxDate());

    return migrationFiles;
}

function getMigrationFiles(files: Array<string>, lastUpdateTime: Date): Array<string> {
    const versionFiles = sortMigrationFiles(files.filter((file) => MIGRATION_FILE_REGEX.test(file)));
    const migrationsToRun = [];
    for (const versionFile of versionFiles) {
        const dateMigrationFile = getDateTime(versionFile);

        if (!lastUpdateTime || dateMigrationFile > lastUpdateTime) {
            migrationsToRun.push(versionFile);
        }
    }

    return migrationsToRun;
}

function loadFiles(migrationsDir: string): Promise<Array<string>> {

    return new Promise((resolve, reject) => {
        fs.stat(migrationsDir, (statErr, stats) => {
            if (statErr || !stats.isDirectory()) {
                resolve([]);

                return;
            }
            fs.readdir(migrationsDir, (readErr, files) => {
                if (readErr) {
                    reject(new Error('Failed to read migrations directory'));

                    return;
                }
                resolve(files);
            });
        });
    });
}

function getDateTime(fileName: string): Date {
    const timeStamp = fileName.match(MIGRATION_FILE_REGEX)[1];
    const year = timeStamp.substr(0, 4);
    // The argument month is 0-based. This means that January = 0 and December = 11
    const month = timeStamp.substr(4, 2);
    const day = timeStamp.substr(6, 2);
    const hour = timeStamp.substr(8, 2);
    const min = timeStamp.substr(10, 2);
    const sec = timeStamp.substr(12, 2);

    if (!_.isInteger(year) || !_.isInteger(month) || !_.isInteger(day)
        || !_.isInteger(hour) || !_.isInteger(min) || !_.isInteger(sec)) {

        throw new Error(`Cannot parse migration filename ${fileName}`);
    }

    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(min, 10), parseInt(sec, 10));
}

function compare(a: string, b: string): number {
    const dateA = getDateTime(a);
    const dateB = getDateTime(b);

    if (dateA < dateB) {
        return -1;
    }
    if (dateA > dateB) {
        return 1;
    }
    return 0;
}

function sortMigrationFiles(files: Array<string>): Array<string> {

    return files.sort(compare);
}
