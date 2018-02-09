/*
const path = require('path');
const {MIGRATION_STATE_KEY, runMigrations} = require('./../src/utils/migrations');
const {serialize, toObject, toDate} = require('./../src/utils/db');
const ChaincodeStub = require('./../src/mocks/ChaincodeStub');
const TransactionHelper = require('./../src/lib/TransactionHelper');


test('runs no migrations for the ground contours when last update time was today', async () => {
    let lastUpdateTimeChanged = false;
    const chainCodeStubMiddleware = (functionName, args) => {
        if (functionName === 'getState') {
            return serialize(new Date());
        }
        if (args.key === MIGRATION_STATE_KEY) {
            lastUpdateTimeChanged = true;
        }

        return undefined;
    };

    const migrationsDir = path.join(__dirname, '/../ground_contours/migrations');
    const txHelper = new TransactionHelper(new ChaincodeStub(chainCodeStubMiddleware));
    const result = await runMigrations(
        migrationsDir,
        null,
        new ChaincodeStub(chainCodeStubMiddleware),
        txHelper,
        []
    );
    expect(result).toBe('No migrations to execute');
    // Migration state updates
    expect(lastUpdateTimeChanged).not.toBeTruthy();
});

test('runs all migrations for the ground contours when last update time was in the past', async () => {
    let putStateTimesCalled = 0;
    let lastUpdateTimeChanged = false;
    const chainCodeStubMiddleware = (functionName, args) => {
        if (functionName === 'getState') {
            return serialize(new Date(1970, 1, 1));
        }
        if (functionName === 'putState') {
            expect(args.key).toBeDefined();
            if (args.key.indexOf(CONSTANTS.CONTOUR_TYPE_PREFIX) === 0) {
                putStateTimesCalled += 1;
                expect(toObject(args.value).policy).toBeDefined();
                expect(toObject(args.value).roles).toBeDefined();
            }
            if (args.key === MIGRATION_STATE_KEY) {
                expect(toDate(args.value)).toBeDefined();
                lastUpdateTimeChanged = true;
            }
        }

        return undefined;
    };

    const migrationsDir = path.join(__dirname, '/../src/chaincodes/contours/migrations');
    const txHelper = new TransactionHelper(new ChaincodeStub(chainCodeStubMiddleware));
    const result = await runMigrations(migrationsDir, null, new ChaincodeStub(chainCodeStubMiddleware), txHelper, []);
    expect(result).toEqual(['Version-20171122161550.js']);

    expect(putStateTimesCalled).toBe(Object.values(CONSTANTS.CONTOUR_TYPES).length);
    // Migration state updates
    expect(lastUpdateTimeChanged).toBeTruthy();
});
*/
