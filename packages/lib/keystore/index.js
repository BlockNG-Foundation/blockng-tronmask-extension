import { pbkdf2Sync as _pbkdf2Sync } from 'pbkdf2';
import { utils } from 'ethers';
import * as scrypt from 'scrypt-js';
import aes from 'aes-js';
import { get as lodashGet } from 'lodash';
import TronWeb from 'tronweb';
import randomUUID from 'uuid/v4';

const {arrayify, concat, hexlify, toUtf8Bytes, UnicodeNormalizationForm, keccak256, randomBytes} = utils


function pbkdf2Sync(passwordBytes, salt, count, dkLen, prfFunc) {
    return arrayify(_pbkdf2Sync(passwordBytes, salt, count, dkLen, prfFunc));
}

function _decrypt(data, key, ciphertext) {
    const cipher = lodashGet(data, "crypto.cipher");
    if (cipher === "aes-128-ctr") {
        const iv = looseArrayify(lodashGet(data, "crypto.cipherparams.iv"))
        const counter = new aes.Counter(iv);

        const aesCtr = new aes.ModeOfOperation.ctr(key, counter);
        return arrayify(aesCtr.decrypt(ciphertext));
    }
    return null;
}

function _computeKdfKey(data, password, pbkdf2Func, scryptFunc, progressCallback) {
    // console.log("arguments:", arguments)
    const passwordBytes = getPassword(password);

    const kdf = lodashGet(data, "crypto.kdf");

    if (kdf && typeof(kdf) === "string") {
        const throwError = function(name, value) {
            return new Error(`invalid key-derivation function parameters, ${name}, ${value}`);
        };

        if (kdf.toLowerCase() === "scrypt") {
            const salt = looseArrayify(lodashGet(data, "crypto.kdfparams.salt"));
            const N = parseInt(lodashGet(data, "crypto.kdfparams.n"));
            const r = parseInt(lodashGet(data, "crypto.kdfparams.r"));
            const p = parseInt(lodashGet(data, "crypto.kdfparams.p"));

            // Check for all required parameters
            if (!N || !r || !p) { throwError("kdf", kdf); }

            // Make sure N is a power of 2
            if ((N & (N - 1)) !== 0) { throwError("N", N); }

            const dkLen = parseInt(lodashGet(data, "crypto.kdfparams.dklen"));
            if (dkLen !== 32) { throwError("dklen", dkLen); }
            // console.log('scrypt:', passwordBytes, salt, N, r, p, 64, progressCallback)
            return scryptFunc(passwordBytes, salt, N, r, p, 64, progressCallback);

        } else if (kdf.toLowerCase() === "pbkdf2") {

            const salt = looseArrayify(lodashGet(data, "crypto.kdfparams.salt"));

            let prfFunc = null;
            const prf = lodashGet(data, "crypto.kdfparams.prf");
            if (prf === "hmac-sha256") {
                prfFunc = "sha256";
            } else if (prf === "hmac-sha512") {
                prfFunc = "sha512";
            } else {
                throwError("prf", prf);
            }

            const count = parseInt(lodashGet(data, "crypto.kdfparams.c"));

            const dkLen = parseInt(lodashGet(data, "crypto.kdfparams.dklen"));
            if (dkLen !== 32) { throwError("dklen", dkLen); }

            return pbkdf2Func(passwordBytes, salt, count, dkLen, prfFunc);
        }
    }

    return new Error(`unsupported key-derivation function, kdf, ${kdf}`);
}

function _getAccount(data, key) {
    const ciphertext = looseArrayify(lodashGet(data, "crypto.ciphertext"));

    const computedMAC = hexlify(keccak256(concat([ key.slice(16, 32), ciphertext ]))).substring(2);
    // console.log("computedMAC:", computedMAC)
    if (computedMAC !== lodashGet(data, "crypto.mac").toLowerCase()) {
        throw new Error("invalid password");
    }

    const privateKey = _decrypt(data, key.slice(0, 16), ciphertext);
    // console.log("privateKey:", privateKey)
    if (!privateKey) {
        throw new Error(`unsupported cipher`)
    }

    // const mnemonicKey = key.slice(32, 64);
    let privateKeyStr = hexlify(privateKey).replace('0x', '')
    const address = TronWeb.address.fromPrivateKey(privateKeyStr);
    // console.log('priveteKey:', hexlify(privateKey), Buffer.from(privateKey).toString('hex'))
    // console.log('address:', address, data.address)
    if (data.address) {
        let check = data.address.replace('0x', '');
        let checkAddress = TronWeb.address.fromHex(check);
        // console.log('compare', check, checkAddress, address)
        if (checkAddress !== address) {
            throw new Error("address mismatch");
        }
    }
    // console.log("finish:", hexlify(privateKey), address)
    return {
        _isKeystoreAccount: true,
        address: address,
        privateKey: privateKeyStr
    };
}

export function looseArrayify(hexString) {
    if (typeof(hexString) === 'string' && hexString.substring(0, 2) !== '0x') {
        hexString = '0x' + hexString;
    }
    return arrayify(hexString);
}

export function getPassword(password) {
    if (typeof(password) === 'string') {
        return toUtf8Bytes(password, UnicodeNormalizationForm.NFKC);
    }
    return arrayify(password);
}


export function isKeystoreWallet(json){
    let data = null;
    try {
        data = JSON.parse(json);
    } catch (error) {
        return false;
    }
    return !(!data.version || parseInt(data.version) !== data.version || parseInt(data.version) !== 3);
}

export function isTronscanKeystore(json) {
    let data = null;
    try {
        data = JSON.parse(json);
    } catch (error) {
        return false;
    }
    return !(!data.version || parseInt(data.version) !== data.version || parseInt(data.version) !== 1);
}

export function decryptSync(json, password) {
    const data = JSON.parse(json);
    // console.log("data:", data)
    const key = _computeKdfKey(data, password, pbkdf2Sync, scrypt.syncScrypt);
    // console.log("key:", key)
    return _getAccount(data, key);
}

export function encrypt(account, password, options = {}, progressCallback) {
    try {
        // Check the address matches the private key
        if (account.address !== TronWeb.address.fromPrivateKey(account.privateKey)) {
            throw new Error("address/privateKey mismatch");
        }
    } catch (e) {
        return Promise.reject(e);
    }

    // The options are optional, so adjust the call as needed
    if (typeof(options) === "function" && !progressCallback) {
        progressCallback = options;
        options = {};
    }

    let tempKey = account.privateKey;
    if(!tempKey.startsWith('0x')){
        tempKey = '0x' + tempKey
    }

    const privateKey = arrayify(tempKey);
    const passwordBytes = getPassword(password);

    let client = options.client;
    if (!client) { client = "tronmask-extension"; }

    // Check/generate the salt
    let salt = null;
    if (options.salt) {
        salt = arrayify(options.salt);
    } else {
        salt = randomBytes(32);;
    }

    // Override initialization vector
    let iv = null;
    if (options.iv) {
        iv = arrayify(options.iv);
        if (iv.length !== 16) { throw new Error("invalid iv"); }
    } else {
        iv = randomBytes(16);
    }

    // Override the uuid
    let uuidRandom = null;
    if (options.uuid) {
        uuidRandom = arrayify(options.uuid);
        if (uuidRandom.length !== 16) { throw new Error("invalid uuid"); }
    } else {
        uuidRandom = randomBytes(16);
    }

    // Override the scrypt password-based key derivation function parameters
    let N = (1 << 17), r = 8, p = 1;
    if (options.scrypt) {
        if (options.scrypt.N) { N = options.scrypt.N; }
        if (options.scrypt.r) { r = options.scrypt.r; }
        if (options.scrypt.p) { p = options.scrypt.p; }
    }

    // We take 64 bytes:
    //   - 32 bytes   As normal for the Web3 secret storage (derivedKey, macPrefix)
    //   - 32 bytes   AES key to encrypt mnemonic with (required here to be Ethers Wallet)
    return scrypt.scrypt(passwordBytes, salt, N, r, p, 64, progressCallback).then((key) => {
        key = arrayify(key);

        // This will be used to encrypt the wallet (as per Web3 secret storage)
        const derivedKey = key.slice(0, 16);
        const macPrefix = key.slice(16, 32);

        // This will be used to encrypt the mnemonic phrase (if any)
        // const mnemonicKey = key.slice(32, 64);

        // Encrypt the private key
        const counter = new aes.Counter(iv);
        const aesCtr = new aes.ModeOfOperation.ctr(derivedKey, counter);
        const ciphertext = arrayify(aesCtr.encrypt(privateKey));

        // Compute the message authentication code, used to check the password
        const mac = keccak256(concat([macPrefix, ciphertext]))

        // See: https://github.com/ethereum/wiki/wiki/Web3-Secret-Storage-Definition
        const data = {
            address: TronWeb.address.toHex(account.address),
            id: randomUUID({ random: uuidRandom }),
            version: 3,
            crypto: {
                cipher: "aes-128-ctr",
                cipherparams: {
                    iv: hexlify(iv).substring(2),
                },
                ciphertext: hexlify(ciphertext).substring(2),
                kdf: "scrypt",
                kdfparams: {
                    salt: hexlify(salt).substring(2),
                    n: N,
                    dklen: 32,
                    p: p,
                    r: r
                },
                mac: mac.substring(2)
            }
        };

        return JSON.stringify(data);
    });
}


