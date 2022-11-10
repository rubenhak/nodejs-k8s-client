import { ILogger } from 'the-logger';
import * as fs from 'fs';
import dotenv from 'dotenv'

import { KubernetesClient, KubernetesClientConfig } from './client';
import { ClusterConnectParams } from './connector-types';

dotenv.config()

export function connectFromPod(logger : ILogger, params? : ClusterConnectParams) : Promise<KubernetesClient>
{
    params = params || {};
    params.skipAPIFetch = params.skipAPIFetch ?? false;

    const k8sConfig : KubernetesClientConfig = {
        server: 'https://' + process.env.KUBERNETES_SERVICE_HOST + ':' + process.env.KUBERNETES_SERVICE_PORT_HTTPS,
        token: fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8'),
        httpAgent: {
            ca: fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt', 'utf8')
        }
    };
    const client = new KubernetesClient(logger, k8sConfig);


    return Promise.resolve()
        .then(() => {
            if (!params?.skipAPIFetch) {
                return client.init()
            }
        })
        .then(() => {
            return client;
        });
}