import cluster from 'cluster';
import os from 'os';
import { keccak256, getCreate2Address, ethers } from 'ethers';
import secp256k1 from 'secp256k1';
import crypto from 'crypto';
import Wallet from "./wallet";
import {HDNodeWallet} from "ethers/src.ts/wallet/hdwallet";

const numCPUs = os.cpus().length;

const SaltFinder = {

    generateKeyPairs(batchSize) {
        let keyPairs: any = [];

        for (let i = 0; i < batchSize; i++) {

            const wallet = ethers.Wallet.createRandom();
            const phrase = wallet.mnemonic!.phrase;
            const address = wallet.address;

            keyPairs.push({ address, phrase });
        }
        return keyPairs;
    },

    findSalt(batchSize = 10) {
        let tries = 0;
        let lastAddress = '';

        while (true) {
            tries += batchSize;

            let batch = this.generateKeyPairs(batchSize);
            for (let { address, phrase } of batch) {

                const deployerAddress = address;

                lastAddress = deployerAddress.toLowerCase();

                if (lastAddress.startsWith('0xbadcafe')) {

                    if (cluster.worker) {

                        Wallet.prepareWallet(phrase);

                        console.log(`[Worker ${cluster.worker.id}] Sexy Address Found:`, {
                            deployerAddress: deployerAddress,
                        });
                    }
                }
            }

            if (tries % 1000 === 0 && cluster.worker) {
                process.send!({ workerId: cluster.worker.id, tries, address: lastAddress });
            }
        }
    },
};

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    let totalTries = 0;
    let lastFoundAddress = '';
    const logInterval = setInterval(() => {
        console.log("Total tries:", totalTries, "Last address:", lastFoundAddress);
    }, 5000); // Log total tries every 5 seconds

    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();

        worker.on('message', (message) => {
            if (typeof message.tries === 'number') {
                totalTries += message.tries;
                lastFoundAddress = message.address;
            }
        });
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} finished`);
    });
} else {
    console.log(`Worker ${process.pid} started`);
    SaltFinder.findSalt(100);
}
