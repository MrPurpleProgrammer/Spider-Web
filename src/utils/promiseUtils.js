const sleep = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

function all(items, fn, filename) {
    const promises = items.map((item, i, arr) => fn(item, i, arr, filename));
    return Promise.all(promises);
}

function series(items, fn) {
    let result = [];
    return items.reduce((acc, item) => {
        acc = acc.then(() => {
            return fn(item).then(res => result.push(res));
        });
        return acc;
    }, Promise.resolve())
        .then(() => result);
}

function splitToChunks(items, chunkSize = 10) {
    const result = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        result.push(items.slice(i, i + chunkSize));
    }
    return result;
}

function chunks(items, fn, chunkSize = 10, filename = null) {
    let result = [];
    const chunks = splitToChunks(items, chunkSize);
    return series(chunks, chunk => {
        return all(chunk, fn, filename)
            .then(res => result = result.concat(res))
    })
        .then(() => result);
}

module.exports = {
    sleep,
    all,
    series,
    chunks
}