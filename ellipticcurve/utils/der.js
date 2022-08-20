// @ts-check

const Base64 = require("./base");
const BinaryAscii = require("./binary");
const modulo = require("./integer").modulo;
const BigInt = require("big-integer");

const hexAt = "\x00";
const hexB = "\x02";
const hexC = "\x03";
const hexD = "\x04";
const hexF = "\x06";
const hex0 = "\x30";

const hex31 = 0x1f;
const hex127 = 0x7f;
const hex129 = 0xa0;
const hex160 = 0x80;
const hex224 = 0xe0;

const bytesHex0 = Buffer.from(hex0).toString("binary");
const bytesHexB = Buffer.from(hexB).toString("binary");
const bytesHexC = Buffer.from(hexC).toString("binary");
const bytesHexD = Buffer.from(hexD).toString("binary");
const bytesHexF = Buffer.from(hexF).toString("binary");

exports.encodeSequence = function () {
    let sequence = [];
    let totalLengthLen = 0;
    for (let i = 0; i < arguments.length; i++) {
        sequence.push(arguments[i]);
        totalLengthLen += arguments[i].length;
    }
    return hex0 + _encodeLength(totalLengthLen) + sequence.join("");
};

/**
 *
 * @param {BigInt.BigInteger} x
 * @returns
 */
exports.encodeInteger = function (x) {
    if (x.lesser(0)) {
        throw new Error("x cannot be negative");
    }

    let t = x.toString(16);

    if (t.length % 2) {
        t = "0" + t;
    }

    let tBin = BinaryAscii.binaryFromHex(t);

    let num;
    if (typeof tBin[0] === "number") {
        num = tBin[0];
    } else {
        num = tBin.charCodeAt(0);
    }

    if (num <= hex127) {
        return hexB + String.fromCharCode(tBin.length) + tBin;
    }
    return hexB + String.fromCharCode(tBin.length + 1) + hexAt + tBin;
};

/** @param {number[]} pieces */
exports.encodeOid = function (pieces) {
    let first = pieces.shift();
    let second = pieces.shift();

    if (!first || !second) {
        throw new Error("encodeOid: param must have at least two elements");
    }

    if (first > 2) {
        throw new Error("first has to be <= 2");
    }
    if (second > 39) {
        throw new Error("second has to be <= 39");
    }

    /**
     * @type {Array<string>}
     */
    let encodedPieces = [];

    pieces.forEach((x) => {
        encodedPieces.push(_encodeNumber(x));
    });

    let body = [String.fromCharCode(40 * first + second)]
        .concat(encodedPieces)
        .join("");

    return hexF + _encodeLength(body.length) + body;
};

/**
 *
 * @param {string} t
 * @returns
 */
exports.encodeBitstring = function (t) {
    return hexC + _encodeLength(t.length) + t;
};

/**
 *
 * @param {string} t
 * @returns
 */
exports.encodeOctetString = function (t) {
    return hexD + _encodeLength(t.length) + t;
};

/**
 *
 * @param {number} tag
 * @param {string} value
 * @returns
 */
exports.encodeConstructed = function (tag, value) {
    return (
        String.fromCharCode(hex129 + tag) + _encodeLength(value.length) + value
    );
};

/**
 *
 * @param {string} string
 * @returns
 */
exports.removeSequence = function (string) {
    _checkSequenceError(string, bytesHex0, "03");

    let result = _readLength(string.slice(1));
    let length = result[0];
    let lengthLen = result[1];

    let endSeq = 1 + lengthLen + length;

    return [string.slice(1 + lengthLen, endSeq), string.slice(endSeq)];
};

/**
 *
 * @param {string} string
 * @returns {[BigInt.BigInteger, string]}
 */
exports.removeInteger = function (string) {
    _checkSequenceError(string, bytesHexB, "02");

    let result = _readLength(string.slice(1));
    let length = result[0];
    let lengthLen = result[1];

    let numberBytes = string.slice(1 + lengthLen, 1 + lengthLen + length);
    let rest = string.slice(1 + lengthLen + length);
    let nBytes;
    if (typeof numberBytes[0] === "number") {
        nBytes = numberBytes[0];
    } else {
        nBytes = numberBytes.charCodeAt(0);
    }

    if (nBytes >= hex160) {
        throw new Error("nBytes must be < 160");
    }

    return [BigInt(BinaryAscii.hexFromBinary(numberBytes), 16), rest];
};

/**
 *
 * @param {string} string
 * @returns
 */
exports.removeObject = function (string) {
    _checkSequenceError(string, bytesHexF, "06");

    let result = _readLength(string.slice(1));
    let length = result[0];
    let lengthLen = result[1];

    let body = string.slice(1 + lengthLen, 1 + lengthLen + length);
    let rest = string.slice(1 + lengthLen + length);

    let numbers = [];
    while (body) {
        let results = _readNumber(body);
        let n = results[0];
        let lengthLength = results[1];
        numbers.push(n);
        body = body.slice(lengthLength);
    }

    let n0 = numbers.shift();

    if (!n0) {
        throw new Error("der.removeObject: first number is missing");
    }

    let first = Math.floor(n0 / 40);
    let second = n0 - 40 * first;
    numbers = [first, second].concat(numbers);

    return [numbers, rest];
};

/**
 *
 * @param {string} string
 * @returns
 */
exports.removeBitString = function (string) {
    _checkSequenceError(string, bytesHexC, "03");

    let result = _readLength(string.slice(1));
    let length = result[0];
    let lengthLen = result[1];

    let body = string.slice(1 + lengthLen, 1 + lengthLen + length);
    let rest = string.slice(1 + lengthLen + length);

    return [body, rest];
};

/**
 *
 * @param {string} string
 * @returns
 */
exports.removeOctetString = function (string) {
    _checkSequenceError(string, bytesHexD, "04");

    let result = _readLength(string.slice(1));
    let length = result[0];
    let lengthLen = result[1];

    let body = string.slice(1 + lengthLen, 1 + lengthLen + length);
    let rest = string.slice(1 + lengthLen + length);

    return [body, rest];
};

/**
 *
 * @param {string} string
 * @returns
 */
exports.removeConstructed = function (string) {
    let s0 = _extractFirstInt(string);
    if ((s0 & hex224) != hex129) {
        throw new Error("wanted constructed tag (0xa0-0xbf), got 0x" + s0);
    }

    let tag = s0 & hex31;
    let result = _readLength(string.slice(1));
    let length = result[0];
    let lengthLen = result[1];

    let body = string.slice(1 + lengthLen, 1 + lengthLen + length);
    let rest = string.slice(1 + lengthLen + length);

    return [tag, body, rest];
};

/**
 *
 * @param {string} pem
 * @returns
 */
exports.fromPem = function (pem) {
    let split = pem.split("\n");
    let stripped = "";

    let i;
    for (i = 0; i < split.length; i++) {
        // @ts-ignore
        if (!split[i].startsWith("-----")) {
            // @ts-ignore
            stripped += split[i].trim();
        }
    }

    return Base64.decode(stripped);
};

/**
 * @param {string} der
 * @param {string} name
 * @returns {string}
 */
exports.toPem = function (der, name) {
    let b64 = Base64.encode(der);
    let lines = ["-----BEGIN " + name + "-----\n"];

    for (let start = 0; start <= b64.length; start += 64) {
        lines.push(b64.slice(start, start + 64) + "\n");
    }

    lines.push("-----END " + name + "-----\n");

    return lines.join("");
};

/**
 * @param {number} length
 */
function _encodeLength(length) {
    if (length < 0) {
        throw new Error("length cannot be negative");
    }

    if (length < hex160) {
        return String.fromCharCode(length);
    }

    let s = length.toString(16);

    if (modulo(s.length, 2)) {
        s = "0" + s;
    }

    s = BinaryAscii.binaryFromHex(s);
    let lengthLen = s.length;

    // Not sure what was going on with the previous line, but toString() does not expect a param
    // return String.fromCharCode(hex160 | lengthLen) + toString(lengthLen);
    return String.fromCharCode(hex160 | lengthLen) + lengthLen.toString();
}

/**
 *
 * @param {number} n
 * @returns
 */
function _encodeNumber(n) {
    let b128Digits = [];
    while (n) {
        b128Digits.unshift((n & hex127) | hex160);
        n >>= 7;
    }

    if (!b128Digits.length) {
        b128Digits.push(0);
    }

    b128Digits[b128Digits.length - 1] &= hex127;

    /**
     * @type {string[]}
     */
    let encodedDigits = [];
    b128Digits.forEach((d) => {
        encodedDigits.push(String.fromCharCode(d));
    });

    return encodedDigits.join("");
}

/**
 *
 * @param {string} string
 * @returns {[number, number]}
 */
function _readLength(string) {
    let num = _extractFirstInt(string);
    if (!(num & hex160)) {
        return [num & hex127, 1];
    }

    let lengthLen = num & hex127;

    if (lengthLen > string.length - 1) {
        throw new Error("ran out of length bytes");
    }

    return [
        parseInt(BinaryAscii.hexFromBinary(string.slice(1, 1 + lengthLen)), 16),
        1 + lengthLen,
    ];
}

/**
 *
 * @param {string} string
 * @returns
 */
function _readNumber(string) {
    let number = 0;
    let lengthLen = 0;
    let d;
    while (true) {
        if (lengthLen > string.length) {
            throw new Error("ran out of length bytes");
        }

        number <<= 7;

        d = string.charAt(lengthLen);
        if (typeof d !== "number") {
            d = d.charCodeAt(0);
        }

        number += d & hex127;
        lengthLen += 1;
        if (!(d & hex160)) {
            break;
        }
    }

    return [number, lengthLen];
}

/**
 *
 * @param {string} string
 * @param {string} start
 * @param {string} expected
 */
function _checkSequenceError(string, start, expected) {
    if (!string.startsWith(start)) {
        throw new Error(
            "wanted sequence (0x" +
                expected +
                "), got 0x" +
                _extractFirstInt(string).toString(16)
        );
    }
}

/**
 *
 * @param {string} string
 * @returns
 */
function _extractFirstInt(string) {
    const num = Number(string[0]);
    if (!isNaN(num)) {
        return num;
    }

    return string.charCodeAt(0);
}
