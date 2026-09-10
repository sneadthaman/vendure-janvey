import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkPort} from './prepare-dev.mjs';

test('missing database credentials fail before app startup without printing secrets', () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./prepare-dev.mjs', import.meta.url)), 'worker'], {
        env: {...process.env, DB_PASSWORD: '', DB_USERNAME: 'test-private-username'},
        encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing backend environment settings: DB_PASSWORD/);
    assert.doesNotMatch(result.stderr, /test-private-username/);
});

test('an occupied port produces actionable guidance without stopping its owner', async () => {
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, resolve));
    try {
        const port = listener.address().port;
        await assert.rejects(checkPort(port, 'Storefront'), /already in use.*original terminal/);
        assert.equal(listener.listening, true);
    } finally {
        await new Promise(resolve => listener.close(resolve));
    }
});

test('a successful port check releases its socket', async () => {
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, resolve));
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    await checkPort(port, 'Test');
    await checkPort(port, 'Test');
});
