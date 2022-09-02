import { setupLogger, LoggerOptions, LogLevel, ILogger } from 'the-logger';
import dotenv from 'dotenv'

import { KubernetesClient, KubernetesClientConfig } from '../../src'

const loggerOptions = new LoggerOptions().enableFile(true).pretty(true)
    // .level(LogLevel.debug)
    ;
const logger = setupLogger('Test', loggerOptions);

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
    if (!process.env['K8S_CA_DATA']) {
        throw new Error('Missing env variable K8S_CA_DATA');
    }

    const config : KubernetesClientConfig = {
        server: process.env['K8S_APISERVER'],
        httpAgent: {
            ca: decodeBase64(process.env['K8S_CA_DATA']!),
        }
    }

    if (process.env['K8S_TOKEN']) {
        config.token = process.env['K8S_TOKEN'];
    }
    if (process.env['K8S_CLIENT_CERT']) {
        config.httpAgent!.cert = decodeBase64(process.env['K8S_CLIENT_CERT']);
    }
    if (process.env['K8S_CLIENT_KEY']) {
        config.httpAgent!.key = decodeBase64(process.env['K8S_CLIENT_KEY']);
    }

    logger.info("Client Config: ", config);

    const client = new KubernetesClient(xLogger ?? logger.sublogger("K8sClient"), config)

    return client.init();
}

interface Context {
    client?: KubernetesClient
}


function decodeBase64(str : string)
{
    return Buffer.from(str, 'base64').toString('ascii');
}