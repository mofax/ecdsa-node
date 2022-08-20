/**
 *
 * @param {string} string
 * @returns
 */
exports.decode = function (string) {
    return Buffer.from(string, "base64").toString("binary");
};

/**
 *
 * @param {string} string
 * @returns
 */
exports.encode = function (string) {
    return Buffer.from(string, "binary").toString("base64");
};
