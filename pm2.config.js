module.exports = {
    apps: [
        {
            name: 'salt',
            script: './node_modules/.bin/ts-node-dev',
            node_args: '-r ts-node/register -r tsconfig-paths/register ./src/newWay.ts badbeef',
            autorestart: true
        },
    ],
};
