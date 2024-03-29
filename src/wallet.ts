import cluster from 'cluster';
import os from 'os';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bip39 from 'bip39';
import * as BTC from 'bitcoinjs-lib';
import {ethers} from "ethers";

let numCPUs = os.cpus().length;

//
interface KeyPair {
    phrase: string;
    password: string;
}

class WalletApp {

    async initFinder(expectedPassword: string) {

        if (cluster.isMaster) {
            console.log(`Master ${process.pid} is running`);
            let totalTries = 0;
            let lastPhrase = "";
            let lastPassword = '';
            setInterval(() => {
                console.log("Total tries:", totalTries, "Last Password:", lastPassword);
                console.log("Last Phrase:", lastPhrase);
            }, 10000);
            for (let i = 0; i < numCPUs; i++) {
                const worker = cluster.fork();

                worker.on('message', (message) => {
                    if (typeof message.tries === 'number') {
                        totalTries += message.tries;
                        lastPassword = message.password;
                        lastPhrase = message.phrase;
                    }
                });
            }
            cluster.on('exit', (worker) => {
                console.log(`Worker ${worker.process.pid} finished`);
            });
        } else {
            console.log(`Worker ${process.pid} started`);
            await this.generateAndFind();
        }
    }

    async generateAndFind(expectedPhrase = "weed") {
        let searching = true;
        let tries = 0;
        let batchSize = 100;
        while (searching) {
            let keyPairs: KeyPair[] = [];

            for (let i = 0; i < batchSize; i++) {
                const wallet = ethers.Wallet.createRandom();
                const fullPhrase = wallet.mnemonic!.phrase.split(" ");
                const password = fullPhrase.pop();

                let pair: KeyPair = {phrase: wallet.mnemonic!.phrase, password: password!};
                keyPairs.push(pair);
            }

            for (let pair of keyPairs) {
                tries++;
                if (tries == 50) {
                    if (cluster.worker) {
                        this.decode(pair.phrase, pair.password);
                    }
                    searching = false;
                }
            }

            process.send!({
                tries,
                phrase: keyPairs[keyPairs.length - 1].phrase,
                password: keyPairs[keyPairs.length - 1].password
            });

        }
    }

    decode(phrase: string, password: string) {
        const combinedPhrase = `${phrase} ${password}`;

        const wallet = ethers.Wallet.fromPhrase(combinedPhrase);

        console.log("Ethereum wallet: ", wallet.address, wallet.privateKey);

        const seed = bip39.mnemonicToSeedSync(combinedPhrase);

        const bip32 = BIP32Factory(ecc);

        const node = bip32.fromSeed(seed);

        const derivationPath = "m/44'/0'/0'/0/0"; // Standard Bitcoin derivation path
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
walletApp.initFinder("weed");
