const _ = require('lodash');

class ChaincodeError extends Error {

    constructor(key, data, stack) {
        super(key);

        if (!_.isUndefined(stack)) {
            this.stack = stack;
        }
        this.data = data || {};
    }

    get serialized() {

        return JSON.stringify({
            'key': this.message,
            'data': this.data,
            'stack': this.stack
        });
    }

}

module.exports = ChaincodeError;
