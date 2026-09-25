import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import {waitForApi} from './start-storefront-after-api.mjs';

test('waits through unavailable responses until the API is healthy', async () => {
    let requests = 0;
    const server = http.createServer((_request, response) => {
        requests += 1;
        response.statusCode = requests < 3 ? 503 : 200;
        response.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    try {
        await waitForApi(`http://127.0.0.1:${address.port}/health`, {timeoutMs: 1_000, intervalMs: 10});
        assert.equal(requests, 3);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('fails clearly when the API never becomes healthy', async () => {
    await assert.rejects(
        waitForApi('http://127.0.0.1:1/health', {timeoutMs: 30, intervalMs: 5}),
        /did not become healthy within 1 seconds/,
    );
});
