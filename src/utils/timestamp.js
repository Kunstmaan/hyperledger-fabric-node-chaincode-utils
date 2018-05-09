function toDate(timestamp) {
    const milliseconds = (timestamp.seconds.low + ((timestamp.nanos / 1000000) / 1000)) * 1000;

    return new Date(milliseconds);
}

module.exports = {toDate};
