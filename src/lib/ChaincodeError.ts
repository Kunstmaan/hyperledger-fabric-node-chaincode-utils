import _ from 'lodash';

export default class ChaincodeError extends Error {

    data: object

    constructor(key: string, data: object, stack: string) {
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
