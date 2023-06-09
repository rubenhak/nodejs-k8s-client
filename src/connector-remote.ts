import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import dotenv from 'dotenv'
import { KubeConfig } from '@kubernetes/client-node';

import { KubernetesClient, KubernetesClientConfig } from './client';
import { ClusterConnectParams } from './connector-types';
import { ClientOptions as WebSocketClientOptions } from 'ws';
import { RequestOptions as HttpsRequestOptions } from 'https';

dotenv.config();

export async function  connectDefaultRemoteCluster(logger : ILogger, params? : ClusterConnectParams) : Promise<KubernetesClient>
{
    const kubeConfigPath = process.env.KUBECONFIG ?? `${process.env.HOME}/.kube/config`;

    return connectRemoteCluster(logger, kubeConfigPath, process.env.KUBE_CONTEXT_NAME, params);
}

export async function connectRemoteCluster(logger : ILogger, kubeConfigPath: string, overrideKubeConfigContext?: string, params? : ClusterConnectParams) : Promise<KubernetesClient>
{
    params = params || {};
    params.skipAPIFetch = params.skipAPIFetch ?? false;
    params.skipTLSVerify = params.skipTLSVerify ?? false;
    
    logger.info("KUBE CONFIG FILE: %s", kubeConfigPath);

    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromFile(kubeConfigPath);

    if (overrideKubeConfigContext) {
        kubeConfig.currentContext = overrideKubeConfigContext;
    }

    const cluster = kubeConfig.getCurrentCluster();
    if (!cluster) {
        throw new Error(`Invalid cluster config: ${kubeConfigPath}`);
    }

    const skipTLSVerify = false || cluster.skipTLSVerify || params.skipTLSVerify;

    const requestOptions: HttpsRequestOptions | WebSocketClientOptions = {}; 
    kubeConfig.applytoHTTPSOptions(requestOptions);

    const k8sLogger = logger.sublogger('k8s');

    const clientConfig : KubernetesClientConfig = {
        server: cluster.server,
        httpAgent: {
            ca: requestOptions.ca,
            cert: requestOptions.cert,
            key: requestOptions.key,
            rejectUnauthorized: skipTLSVerify!
        }
    }

    if (requestOptions.headers?.Authorization)
    {
        const parts = requestOptions.headers?.Authorization.toString().split(' ');
        clientConfig.token = _.last(parts);
    }

    const client = new KubernetesClient(k8sLogger, clientConfig);
    if (!params?.skipAPIFetch) {
        await client.init()
    }

    return client;
}