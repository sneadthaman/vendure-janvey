import { bootstrapWorker } from '@vendure/core';
import { config } from './vendure-config';

const workerHealthPort = Number(process.env.VENDURE_WORKER_HEALTH_PORT || 3020);

if (!Number.isInteger(workerHealthPort) || workerHealthPort < 1 || workerHealthPort > 65535) {
    throw new Error('VENDURE_WORKER_HEALTH_PORT must be a valid TCP port.');
}

bootstrapWorker(config)
    .then(worker => worker.startJobQueue())
    .then(worker => worker.startHealthCheckServer({
        port: workerHealthPort,
        hostname: '0.0.0.0',
        route: '/health',
    }))
    .catch(err => {
        console.log(err);
        process.exitCode = 1;
    });
