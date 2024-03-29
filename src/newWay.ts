import cluster from 'cluster';
import os from 'os';
import { ethers } from 'ethers';
import Wallet from "./wallet";

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

    findSalt(batchSize = 1000, str = "0xbad") {
        let tries = 0;
        let lastAddress = '';

        while (true) {
            tries += batchSize;

            let batch = this.generateKeyPairs(batchSize);
            for (let { address, phrase } of batch) {

                const deployerAddress = address;

                lastAddress = deployerAddress.toLowerCase();

                if (lastAddress.startsWith(str)) {

                    if (cluster.worker) {

                        Wallet.prepareWallet(phrase);

                        console.log(`[Worker ${cluster.worker.id}] Sexy Address Found:`, {
                            deployerAddress: deployerAddress,
                        });
                    }
                }
            }

            if (tries % 20 === 0 && cluster.worker) {
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
    const argv = process.argv.slice(2);
    const strToFind = `0x${argv[0] || "bad"}`;
    console.log("Finding address starting with:", strToFind);
    SaltFinder.findSalt(100, strToFind);
}
