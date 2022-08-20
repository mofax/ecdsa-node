// @ts-check

const BinaryAscii = require("./utils/binary");
const Base64 = require("./utils/base");
const der = require("./utils/der");

class Signature {
    /**
     *
     * @param {bigInt.BigInteger} r
     * @param {bigInt.BigInteger} s
     */
    constructor(r, s) {
        this.r = r;
        this.s = s;
    }

    toDer() {
        return der.encodeSequence(
            der.encodeInteger(this.r),
            der.encodeInteger(this.s)
        );
    }

    toBase64() {
        return Base64.encode(this.toDer());
    }

    /**
     * @param {string} string
     */
    static fromDer(string) {
        let result = der.removeSequence(string);
        let rs = result[0];
        let empty = result[1];
        if (empty) {
            throw new Error(
                "trailing junk after DER signature: " +
                    BinaryAscii.hexFromBinary(empty)
            );
        }

        let result1 = der.removeInteger(rs);
        let r = result1[0];
        let rest = result1[1];

        let result2 = der.removeInteger(rest);
        let s = result2[0];
        let empty2 = result2[1];

        if (empty2) {
            throw new Error(
                "trailing junk after DER numbers: " +
                    BinaryAscii.hexFromBinary(empty)
            );
        }

        return new Signature(r, s);
    }

    /**
     * @param {string} string
     */
    static fromBase64(string) {
        let derString = Base64.decode(string);
        return this.fromDer(derString);
    }
}

exports.Signature = Signature;
