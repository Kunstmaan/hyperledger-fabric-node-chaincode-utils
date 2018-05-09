# Hyperledger Fabric Node.js Chaincode utils [![npm version](https://badge.fury.io/js/%40kunstmaan%2Fhyperledger-fabric-node-chaincode-utils.svg)](https://badge.fury.io/js/%40kunstmaan%2Fhyperledger-fabric-node-chaincode-utils) [![Build Status](https://travis-ci.org/Kunstmaan/hyperledger-fabric-node-chaincode-utils.svg?branch=master)](https://travis-ci.org/Kunstmaan/hyperledger-fabric-node-chaincode-utils)

This repository consists out of a set of utilities functions which can be used to create Node.js chaincode on a Fabric blockchain network. Node.js chaincode is only supported since Hyperledger Fabric 1.1.0.

## API

This Library exposes 2 main classes and some useful utilities.

### ChaincodeBase

ChaincodeBase is a super class that can be used for all your Node.js chaincode. It has a default implementation for `Invoke` that catches the transaction and redirect it to the right function with parameter on the Chaincode class. It also reads the respond from the function and wraps it into a `shim.error()` when an error was thrown or a `shim.success()` when a regular object was returned from the function. By extending this class you don't need to worry anymore about the Chaincode details.

An instance of `fabric-shim` needs to be passed as an argument on the constructor. This is required to ensure that both the chaincode as the `ChaincodeBase` use the same version.
To ensure compatibility `fabric-shim` is set as a peer dependency of this package.

```javascript
const shim = require('fabric-shim');

const FooChaincode = class extends ChaincodeBase {

    constructor() {
        super(shim);
    }

    async yourFunction(stub, txHelper, param1, param2) {

        this.logger.info('execution of yourFunction!');

        return {
            'foo': 'bar'
        };
    }

}

shim.start(new FooChaincode());
```

when a function is called the stub is given together with the params. But also a txHelper is provided, a wrapper around the stub with a lot of helpful functions (see TransactionHelper).

ChaincodeBase has a default logger that you can use which is prefixed with the ChaincodeName (the classname in the case of the example 'chaincode/FooChaincode').

Furthermore the ChaincodBase class exposes some default behaviour for your Chaincode:

#### Ping

A simple function that you can use to ping your chaincode, by using this you can see that the chaincode is working properly and is accessible. When everything is ok this chaincode function should return 'pong'.

#### Migrations

There is a migration system build in that will read the migration files `<chaincodepath>/migrations/Version-yyyyMMddhhmmss.js` where `yyyyMMddhhmmss` stands for the date the migration was made. [hyperledger-fabric-chaincode-dev-setup](https://github.com/Kunstmaan/hyperledger-fabric-chaincode-dev-setup) has a good helper command build in for creating this migration files. 

When you trigger the migrations all migration files since the last execution of the command will be executed. The date of the last execution is stored in the state db.

A migration file needs expose a function like this:

```javascript
module.exports = async function migrate(contract, stub, txHelper, args) {
    // migrate your data here ...
};
```

### TransactionHelper

The TransactionHelper is a wrapper class around the stub class of Hyperledger Fabric. That has some helper functions build in and some wrappers around functions from the stub class.

```javascript
const txHelper = new TransactionHelper(stub)
```

#### UUID

```javascript
txHelper.uuid('FOO');
-> FOO_5b8460e25e1892ceaf658b3e41d06a9933831806cbbd5fc49ccfbccda4d8bbaa_0
txHelper.uuid('FOO');
-> FOO_5b8460e25e1892ceaf658b3e41d06a9933831806cbbd5fc49ccfbccda4d8bbaa_1
```

This function will return a unique key that can be used to store something to the state database. The key will exists out of the prefix, the transaction id and a sequence number. All the DBKeys generated within the same Transaction will have the same txid. 

#### Invoke chaincode

```javascript
invokeChaincode(chaincodeName, functionName, args = undefined, channel = undefined)
```

A helper function around the invokeChaincode of the stub that will throw a ChaincodeError if the invocation failed or return the parsed result when it succeeded.

### Invoked by chaincode

```javascript
invokedByChaincode(chaincodeName, functionName = undefined)
```

Check if the current invocation is invoked from another chaincode. It's also possible to check if it was invoked from a particular function within that chaincode.

### Execute query and return list

```javascript
getQueryResultAsList(query)
```

Execute the given query on the state db and return the results as an array containing of objects `[{key: '', record: {}}]`. 

#### Delete results returned by query

```javascript
deleteAllReturnedByQuery(query)
```

Delete all records returned by that query.

#### GET/PUT State

```javascript
putState(key, value)
getStateAsObject(key)
getStateAsString(key)
getStateAsDate(key)
```

Helper functions to put and get state from the database, that will handle the serialisation/deserialisation of the values.

#### Transaction Date

```javascript
getTxDate()
```

Return the Date of the transaction as a [Javascript Date Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date).

#### Creator Public Key

```javascript
getCreatorPublicKey();
```

Returns the Public Key from the Transaction creator as a SHA3 256 Hash.

#### Publish Event

```javascript
setEvent(name, payload)
```

Wraps the payload into a Buffer and then calls setEvent on the `stub`.

### Utils

Exposes some utilities that are used by the ChaincodeBase and can be useful for other parts of the chaincode as well.

#### Logger

```javascript
const {logger} = require('@kunstmaan/hyperledger-fabric-node-chaincode-utils').utils;
const myLogger = logger.getLogger('myLogger');
myLogger.info('foo');
```

Can be used to create a log4j logger object that prefixes the logs with a certain name. It reads the `CHAINCODE_LOGGING_LEVEL` environment variable to set the right log level (critical, error, warning, debug). The default value is debug.

#### Normalize Payload

```javascript
const {normalizePayload} = require('@kunstmaan/hyperledger-fabric-node-chaincode-utils').utils;
normalizePayload({'foo': 'bar'});
```

The function used by invoke to normalize the payload before returning the payload back to the client. This will normalize Javascript Date Objects to a UNIX timestamp.

#### Identity

```javascript
const {identity} = require('@kunstmaan/hyperledger-fabric-node-chaincode-utils').utils;
identity.getPublicKeyHashFromStub(stub);
```

Exposes helper functions to get the public key from the Transaction.

#### Migrations

```javascript
const {migrations} = require('@kunstmaan/hyperledger-fabric-node-chaincode-utils').utils;
console.log(migrations.MIGRATION_STATE_KEY);
migrations.runMigrations(migrationsDir, contract, stub, txHelper, args);
```

Exposes the function used to run the migrations. It also exposes the key `MIGRATION_STATE_KEY` on which the date is stored when the last migrations where run.

#### Db

```javascript
const {db} = require('@kunstmaan/hyperledger-fabric-node-chaincode-utils').utils;
// Converts a db query result into an array of objects
db.iteratorToList(queryIterator);
// Converts a db query result into an array of objects (with the timestamp of the transaction)
db.iteratorToList(queryIterator, true);
```
