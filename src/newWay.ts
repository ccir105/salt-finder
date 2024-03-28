import cluster from 'cluster';
import os from 'os';
import { keccak256, getCreate2Address, ethers } from 'ethers';
import secp256k1 from 'secp256k1';
import crypto from 'crypto';

const numCPUs = os.cpus().length;

const SaltFinder = {

    generateKeyPairs(batchSize) {
        let keyPairs: any = [];
        for (let i = 0; i < batchSize; i++) {
            let privateKey;
            do {
                privateKey = crypto.randomBytes(32);
            } while (!secp256k1.privateKeyVerify(privateKey));

            const publicKey = secp256k1.publicKeyCreate(privateKey, false).slice(1); // uncompressed, slice(1) to remove the prefix
            keyPairs.push({ privateKey, publicKey });
        }
        return keyPairs;
    },

    findSalt(batchSize = 10) {
        let tries = 0;
        let lastAddress = '';

        while (true) {
            tries += batchSize;

            let batch = this.generateKeyPairs(batchSize);
            for (let { privateKey, publicKey } of batch) {
                const publicKeyHex = Buffer.from(publicKey).toString('hex');
                const deployerAddress = ethers.getAddress('0x' + keccak256('0x' + publicKeyHex).slice(-40));

                lastAddress = deployerAddress.toLowerCase();

                if (lastAddress.startsWith('0xbadcafe')) {
                    if (cluster.worker) {
                        console.log(`[Worker ${cluster.worker.id}] Sexy Address Found:`, {
                            deployerAddress: deployerAddress,
                            privateKey: privateKey.toString('hex')
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
