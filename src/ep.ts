import cluster from 'cluster';
import os from 'os';
import { keccak256, getCreate2Address, ethers } from 'ethers';
import secp256k1 from 'secp256k1';
import crypto from 'crypto';

const numCPUs = os.cpus().length;

const SaltFinder = {
    predictContractAddress(deployerAddress, salt) {
        const INIT_HASH = keccak256('0x5860208158601c335a63aaf10f428752fa158151803b80938091923cf3');
        const factoryAddress = '0x00000000e82eb0431756271F0d00CFB143685e7B';
        const _salt = deployerAddress + salt;

        return getCreate2Address(factoryAddress, _salt, INIT_HASH);
    },

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

                const salt = publicKeyHex.slice(-24).padStart(24, '0');
                const predictedAddress = this.predictContractAddress(deployerAddress, salt);
                lastAddress = predictedAddress;

                if (lastAddress.startsWith('0x0000000000')) {
                    if (cluster.worker) {
                        console.log(`[Worker ${cluster.worker.id}] Sexy Salt Found:`, {
                            salt: salt,
                            contractAddress: predictedAddress,
                            deployerAddress: deployerAddress,
                            privateKey: privateKey.toString('hex')
                        });
			process.exit();
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
