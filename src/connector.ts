import { ILogger } from 'the-logger';
import * as fs from 'fs';
import dotenv from 'dotenv'

import { KubernetesClient } from './client';

dotenv.config()

export function connectFromPod(logger : ILogger) : KubernetesClient
{
    var k8sConfig = {
        server: 'https://' + process.env.KUBERNETES_SERVICE_HOST + ':' + process.env.KUBERNETES_SERVICE_PORT_HTTPS,
        token: fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8'),
        caData: fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt', 'utf8')
    };
    var client = new KubernetesClient(logger, k8sConfig);
    return client;
}