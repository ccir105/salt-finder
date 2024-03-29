import CryptoJS from 'crypto-js';

const Crypto = {


    getRandom32(): string {
        // Generate 16 random bytes as a WordArray, then convert to a hexadecimal string
        // Since each byte is 2 hex characters, 16 bytes will produce a 32-character string
        return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
    },

    encrypt(str: string, keyStr: string ) {
        try {
            // Generate a hash of the string
            const hash = CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
            // Append the hash to the original string
            const dataWithHash = `${str}$${hash}`;

            const key = CryptoJS.enc.Utf8.parse(keyStr);
            const iv = CryptoJS.lib.WordArray.random(128 / 8);
            const encrypted = CryptoJS.AES.encrypt(dataWithHash, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7,
            });

            return iv.toString() + '$' + encrypted.toString();
        } catch (error) {
            console.error('crypto_error', { error });
        }
    },

    decrypt(str: string, keyStr: string) {
        try {
            const arr = str.split('$');
            const iv = CryptoJS.enc.Hex.parse(arr[0]);
            const encryptedText = arr[1];

            const key = CryptoJS.enc.Utf8.parse(keyStr);
            const decrypted = CryptoJS.AES.decrypt(encryptedText, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7,
            });

            const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
            // Separate the original string and the hash
            const splitIndex = decryptedStr.lastIndexOf('$');
            const originalStr = decryptedStr.substring(0, splitIndex);
            const originalHash = decryptedStr.substring(splitIndex + 1);

            // Validate the hash
            const validationHash = CryptoJS.SHA256(originalStr).toString(CryptoJS.enc.Hex);
            if (originalHash !== validationHash) {
                throw new Error('Decryption failed due to integrity check failure.');
            }

            return originalStr;
        } catch (error) {
            console.log('crypto_error', { error });
        }
    },
}

export default Crypto;
