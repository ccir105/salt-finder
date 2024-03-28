import crypto from "crypto";
import {keccak256, getCreate2Address} from "ethers";

const SaltFinder = {
    predictContractAddress(deployerAddress: string, salt: string) {
        const INIT_HASH = keccak256('0x5860208158601c335a63aaf10f428752fa158151803b80938091923cf3');
        const factoryAddress = "0x00000000e82eb0431756271F0d00CFB143685e7B";
        const _salt = deployerAddress + salt;

        const address = getCreate2Address(
            factoryAddress, // Factory address (contract creator)
            _salt,
            INIT_HASH // init code hash
        );

        return  {
            address,
            salt: _salt,
        }
    },


    async findSalt() {
        const deployerAddress = "0x37699c92f5d182BAA7E22AE645EeFf2e17518d2A";
        let tries = 0;
        const logInterval = setInterval(() => {
            console.log("[-] Tries:", tries);
        }, 5000); // Log every 5 seconds

        let found = false;

        while (!found) {
            tries++;
            const salt = crypto.randomBytes(12).toString('hex');
            const predictedAddress = SaltFinder.predictContractAddress(deployerAddress, salt);

            if (predictedAddress.address.startsWith('0x00000000')) {
                clearInterval(logInterval); // Clear the interval once found
                found = true;
                console.log("[-] Sexy Salt Found:", salt, "Address:", predictedAddress.address);
                console.log("[-] Using this salt", predictedAddress.salt);
            } else {
                // Yield control to the event loop
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }
}

SaltFinder.findSalt();
