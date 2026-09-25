import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const repositoryDirectory = fileURLToPath(new URL('../', import.meta.url));
const serverDirectory = fileURLToPath(new URL('../apps/server/', import.meta.url));
const require = createRequire(new URL('../apps/server/package.json', import.meta.url));

export async function waitForApi(url, options = {}) {
    const timeoutMs = options.timeoutMs ?? 180_000;
    const intervalMs = options.intervalMs ?? 500;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(url, {signal: AbortSignal.timeout(2_000)});
            if (response.ok) return;
        } catch {
            // Vendure has not opened its HTTP listener yet.
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Vendure API did not become healthy within ${Math.ceil(timeoutMs / 1000)} seconds (${url}).`);
}

export async function startStorefront() {
    require('dotenv').config({path: `${serverDirectory}/.env`, quiet: true});
    const apiPort = Number(process.env.PORT || process.env.VENDURE_SERVER_PORT || 3000);
    const healthUrl = process.env.VENDURE_HEALTH_URL || `http://127.0.0.1:${apiPort}/health`;

    console.log(`[dev] Waiting for Vendure API at ${healthUrl} before starting the storefront...`);
    await waitForApi(healthUrl);
    console.log('[dev] Vendure API is healthy; starting the storefront.');

    const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmExecutable, ['run', 'dev', '-w', 'storefront'], {
        cwd: repositoryDirectory,
        stdio: 'inherit',
        windowsHide: true,
    });

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => child.kill(signal));
    }

    await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', code => {
            process.exitCode = code ?? 1;
            resolve();
        });
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    startStorefront().catch(error => {
        console.error(`[dev] ${error.message}`);
        process.exitCode = 1;
    });
}
