import cluster from 'cluster';
import os from 'os';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bip39 from 'bip39';
import * as BTC from 'bitcoinjs-lib';
import {ethers} from "ethers";
import Crypto from "./crypto";

let numCPUs = os.cpus().length;

interface KeyPair {
    phrase: string;
    password: string;
}

const targetHexPattern = "0xbaddad"

class WalletApp {

    async initFinder() {

        if (cluster.isMaster) {
            console.log(`Master ${process.pid} is running`);
            let totalTries = 0;

            for (let i = 0; i < numCPUs; i++) {
                cluster.fork();
            }

            cluster.on('message', (worker, message) => {
                if (message.type === 'FOUND') {
                    console.log(`Found matching address: ${message.address} with phrase: ${message.phrase}`);
                    // Implement your logic here, e.g., saving the address or shutting down the workers.
                } else if (message.type === 'PROGRESS') {
                    totalTries += message.tries;
                    console.log(`Total tries: ${totalTries}`);
                }
            });

            cluster.on('exit', (worker) => {
                console.log(`Worker ${worker.process.pid} finished`);
            });
        } else {
            console.log(`Worker ${process.pid} started`);
            await this._generateAndFind();
        }
    }

    async _generateAndFind() {
        let tries = 0;
        let progressUpdateInterval = 1000; // Update the master every 1000 tries
        while (true) {
            const wallet = ethers.Wallet.createRandom(); // Adjust based on the actual ethers.js v6 API
            const phrase = wallet.mnemonic!.phrase; // Adjust according to actual API
            tries++;

            if (tries % progressUpdateInterval === 0) {
                process.send? process.send({type: 'PROGRESS', tries}): null;
                tries = 0; // Reset tries after sending progress update
            }

            if (wallet.address.toLowerCase().startsWith(targetHexPattern)) {
                this.prepareWallet(phrase)
            }
        }
    }

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

    decode(phrase: string, password: string) {
        const combinedPhrase = `${phrase} ${password}`;

        const wallet = ethers.Wallet.fromPhrase(combinedPhrase);

        console.log("Ethereum wallet: ", wallet.address, wallet.privateKey);

        const seed = bip39.mnemonicToSeedSync(combinedPhrase);

        const bip32 = BIP32Factory(ecc);

        const node = bip32.fromSeed(seed);

        const derivationPath = "m/44'/0'/0'/0/0";
        const keyPair = node.derivePath(derivationPath);

        const {address} = BTC.payments.p2pkh({pubkey: keyPair.publicKey, network: BTC.networks.bitcoin});
        const privateKeyWIF = keyPair.toWIF();

        console.log("Bitcoin wallet: ", address, privateKeyWIF);

        console.log("Seed Phrase: ", phrase);
        console.log("Password: ", password);
        console.log("\n");
    }
}

const walletApp = new WalletApp();
walletApp.initFinder();
