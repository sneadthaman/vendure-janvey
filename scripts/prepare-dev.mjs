import net from 'node:net';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const serverDirectory = fileURLToPath(new URL('../apps/server/', import.meta.url));
const require = createRequire(new URL('../apps/server/package.json', import.meta.url));

export function checkPort(port, label) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', error => reject(new Error(error.code === 'EADDRINUSE'
            ? `${label} port ${port} is already in use. Reuse the running app or stop it in its original terminal before starting another instance.`
            : `Cannot check ${label} port ${port}: ${error.message}`)));
        server.listen(port, () => server.close(resolve));
    });
}

export async function prepareDev(scope) {
    require('dotenv').config({path: `${serverDirectory}/.env`, quiet: true});
    const apiPort = Number(process.env.PORT || process.env.VENDURE_SERVER_PORT || 3000);
    if (scope === 'all') await checkPort(3001, 'Storefront');
    if (scope !== 'worker') await checkPort(apiPort, 'Vendure API');
    if (scope === 'all' || scope === 'server') await checkPort(5173, 'Dashboard');

    const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD'];
    const missing = required.filter(key => !process.env[key]?.trim());
    if (missing.length) throw new Error(`Missing backend environment settings: ${missing.join(', ')}. Set them in apps/server/.env.`);

    const {Client} = require('pg');
    const connect = async () => {
        const client = new Client({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            database: process.env.DB_NAME,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            connectionTimeoutMillis: 3000,
        });
        try {
            await client.connect();
            await client.query('SELECT 1');
        } finally {
            await client.end();
        }
    };

    try {
        await connect();
    } catch (error) {
        const localCompose = ['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
            && Number(process.env.DB_PORT) === 6543;
        if (!localCompose || error.code !== 'ECONNREFUSED') {
            throw new Error(`Database connection failed (${error.code || 'connection error'}). Check DB_* in apps/server/.env and that PostgreSQL is available.`);
        }
        const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
            encoding: 'utf8', timeout: 15000,
        });
        if (docker.error || docker.status !== 0) {
            throw new Error('PostgreSQL is unavailable and Docker is not ready. Start Docker Desktop, wait for its engine to be running, then run npm run dev again.');
        }
        console.log('[dev] Starting local PostgreSQL and waiting for its health check...');
        const result = spawnSync('docker', ['compose', 'up', '-d', '--wait', '--wait-timeout', '60', 'postgres_db'], {
            cwd: serverDirectory, stdio: 'inherit', timeout: 90000,
        });
        if (result.error || result.status !== 0) throw new Error('Could not start PostgreSQL. Check docker compose logs postgres_db in apps/server.');
        try {
            await connect();
        } catch (error) {
            throw new Error(`PostgreSQL started but the configured login failed (${error.code || 'connection error'}). Check DB_* against the existing database; changing .env does not reset its password.`);
        }
    }
    console.log('[dev] Ports available; database connection verified.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    prepareDev(process.argv[2] || 'all').catch(error => {
        console.error(`[dev] ${error.message}`);
        process.exitCode = 1;
    });
}
