import { setupLogger, LoggerOptions, LogLevel, ILogger } from 'the-logger';
import dotenv from 'dotenv'

import { KubernetesClient, KubernetesClientConfig } from '../../src'

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true); //.level(LogLevel.debug);
const logger = setupLogger('ClientTest', loggerOptions);

const context : Context = {};

dotenv.config();

export function fetchClient(xLogger? : ILogger)
{
    if (context.client) {
        return Promise.resolve(context.client);
    }
 
    if (!process.env['K8S_APISERVER']) {
        throw new Error('Missing env variable K8S_APISERVER');
    }
    if (!process.env['K8S_TOKEN']) {
        throw new Error('Missing env variable K8S_TOKEN');
    }
    if (!process.env['K8S_CA_DATA']) {
        throw new Error('Missing env variable K8S_CA_DATA');
    }

    const config : KubernetesClientConfig = {
        server: process.env['K8S_APISERVER'],
        token : process.env['K8S_TOKEN'],
        httpAgent: {
            ca: Buffer.from(process.env['K8S_CA_DATA']!, 'base64').toString('ascii'),
        }
    }
    logger.info("Client Config: ", config);

    const client = new KubernetesClient(xLogger ?? logger, config)

    return client.init();
}

interface Context {
    client?: KubernetesClient
}
