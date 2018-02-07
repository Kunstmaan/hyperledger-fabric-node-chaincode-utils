const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger').getLogger('migrations/runMigrations');

const MIGRATION_FILE_REGEX = /^Version-([0-9]+)\.js/i;
const MIGRATION_STATE_KEY = 'last-update-time';

async function runMigrations(migrationsDir, contract, stub, txHelper, args) {
    const lastUpdateTime = await txHelper.getStateAsDate(MIGRATION_STATE_KEY);

    const files = await loadFiles(migrationsDir);
    const migrationFiles = getMigrationFiles(files, lastUpdateTime);

    if (migrationFiles.length === 0) {

        return 'No migrations to execute';
    }

    for (const file of migrationFiles) {
        const migrate = require(path.join(migrationsDir, file));
        logger.info(`Running migration for file ${file}`);
        await migrate(contract, stub, txHelper, args);
    }

    txHelper.putState(MIGRATION_STATE_KEY, Date.now());

    return migrationFiles;
}

module.exports = {
    MIGRATION_STATE_KEY,
    MIGRATION_FILE_REGEX,
    runMigrations
};

function getMigrationFiles(files, lastUpdateTime) {
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

function loadFiles(migrationsDir) {
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

function getDateTime(fileName) {
    const timeStamp = fileName.match(MIGRATION_FILE_REGEX)[1];
    const year = timeStamp.substr(0, 4);
    // The argument month is 0-based. This means that January = 0 and December = 11
    const month = timeStamp.substr(4, 2) - 1;
    const day = timeStamp.substr(6, 2);
    const hour = timeStamp.substr(8, 2);
    const min = timeStamp.substr(10, 2);
    const sec = timeStamp.substr(12, 2);
    return new Date(year, month, day, hour, min, sec);
}

function compare(a, b) {
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

function sortMigrationFiles(files) {
    return files.sort(compare);
}
