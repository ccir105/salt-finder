import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bip39 from 'bip39';
import * as BTC from 'bitcoinjs-lib';
import {ethers} from "ethers";
import Crypto from "./crypto";

class WalletApp {
    prepareWallet(phrase: string) {

        const keys = phrase;

        const beforeEncryption = ethers.Wallet.fromPhrase(phrase);

        const decryptionKey = Crypto.getRandom32();

        const keysArray = keys.split(" ");

        const reversed = keysArray.reverse();

        const firstAndLastWord = [reversed[0], reversed[reversed.length - 1]];

        const keysWithoutLastAndFirst = keysArray.slice(1, keysArray.length - 1);

        const keyEncrypted = Crypto.encrypt(JSON.stringify(keysWithoutLastAndFirst), decryptionKey);

        const firstAndLastWordEncrypted = Crypto.encrypt(JSON.stringify(firstAndLastWord), decryptionKey);

        const firtAndLastWordDecrypted = Crypto.decrypt(firstAndLastWordEncrypted!, decryptionKey);

        const keysDecrypted = Crypto.decrypt(keyEncrypted!, decryptionKey);

        const keysDecryptedArray = JSON.parse(keysDecrypted);

        const lastAndFirstDecryptedArray = JSON.parse(firtAndLastWordDecrypted);

        keysDecryptedArray.unshift(lastAndFirstDecryptedArray[0])

        keysDecryptedArray.push(lastAndFirstDecryptedArray[1])

        const finalKey = keysDecryptedArray.reverse().join(" ");

        const wallet = ethers.Wallet.fromPhrase(finalKey);

        if (beforeEncryption.address !== wallet.address) {
            console.log("Decryption failed");
            return
        }

        console.log("Wallet Address:", wallet.address);
        console.log("Secret Key:", decryptionKey);
        console.log("Phrase Encrypted:", keyEncrypted)
        console.log("2 Words Encrypted:", firstAndLastWordEncrypted)
        console.log("Recovery Key:", finalKey)
    }

    decodeBtc(phrase: string) {

        const seed = bip39.mnemonicToSeedSync(phrase);

        const bip32 = BIP32Factory(ecc);

        const node = bip32.fromSeed(seed);

        const derivationPath = "m/44'/0'/0'/0/0";
        const keyPair = node.derivePath(derivationPath);

        const {address} = BTC.payments.p2pkh({pubkey: keyPair.publicKey, network: BTC.networks.bitcoin});
        const privateKeyWIF = keyPair.toWIF();

        console.log("Bitcoin wallet: ", address, privateKeyWIF);

        console.log("Seed Phrase: ", phrase);
        console.log("\n");
    }
}

export default new WalletApp;
