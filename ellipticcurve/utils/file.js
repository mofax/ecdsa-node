const fs = require("fs");

/**
 *
 * @param {string} path
 * @param {BufferEncoding} encoding
 * @returns
 */
exports.read = function (path, encoding = "utf-8") {
    return fs.readFileSync(path, encoding);
};
