import cluster from 'cluster';
import os from 'os';
import crypto from 'crypto';
import { keccak256, getCreate2Address } from 'ethers';

const numCPUs = os.cpus().length;

const SaltFinder = {
    predictContractAddress(deployerAddress: string, salt: string) {
        const INIT_HASH = keccak256('0x5860208158601c335a63aaf10f428752fa158151803b80938091923cf3');
        const factoryAddress = '0x00000000e82eb0431756271F0d00CFB143685e7B';
        const _salt = deployerAddress + salt;

        const address = getCreate2Address(
            factoryAddress,
            _salt,
            INIT_HASH
        );

        return {
            address,
            salt: _salt,
        };
    },

    findSalt(deployerAddress: string) {
        let tries = 0;
        let found = false;
        let lastAddress = '';

        while (!found) {
            tries++;
            const salt = crypto.randomBytes(12).toString('hex');
            const predictedAddress = this.predictContractAddress(deployerAddress, salt);
            lastAddress = predictedAddress.address;
            if (lastAddress.startsWith('0x00000000')) {
                found = true;
                if (cluster.worker) {
                    console.log(`[Worker ${cluster.worker.id}] Sexy Salt Found:`, salt, "Address:", predictedAddress.address);
                    console.log(`[Worker ${cluster.worker.id}] Using this salt`, predictedAddress.salt);
                }
                process.exit(); // Exit the worker process
            }

            if (tries % 1000 === 0 && cluster.worker) {
                process.send!({ workerId: cluster.worker.id, tries, address: lastAddress });
            }
        }
    }
};

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    let totalTries = 0;
    let lastFoundAddress = '';
    const logInterval = setInterval(() => {
        console.log("Total tries:", totalTries, "Last address:", lastFoundAddress);
    }, 5000); // Log total tries every 5 seconds

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();

        // Receive messages from workers
        worker.on('message', (message: { workerId: number; tries: number, address: string }) => {
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
    // Workers can share any TCP connection
    // In this case, it's a salt finding process
    console.log(`Worker ${process.pid} started`);
    SaltFinder.findSalt("0x37699c92f5d182BAA7E22AE645EeFf2e17518d2A");
}
