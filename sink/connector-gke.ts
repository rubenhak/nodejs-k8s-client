import _ from 'the-lodash';
// const _ = require('the-lodash');
import { ClusterManagerClient } from '@google-cloud/container';

import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ILogger } from 'the-logger';

import { KubernetesClient } from '../../src'

const jwt = require('jsonwebtoken');
const base64 = require("base-64");

export function connectToGKE(logger: ILogger, credentials: any, id: string, region: string) {

    return queryCluster(logger, credentials, id, region)
        .then(cluster => {
            return connectToCluster(logger, cluster, credentials);
        });

}

function queryCluster(logger: ILogger, credentials: any, id: string, region: string)
{
    let client = new ClusterManagerClient({
        credentials: credentials
    });

    let params = {
        name: `projects/${credentials.project_id}/locations/${region}/clusters/${id}`
    }
    logger.info("[queryCluster] ", params);
    return client.getCluster(params)
        .then(results => {
            return _.head(results);
        })
        .catch(reason => {
            if (reason.code == 5) {
                // this.logger.warn(reason);
                return null;
            }
            throw reason;
        });
}

function connectToCluster(logger: ILogger, cluster: any, credentials: any)
{
    logger.silly('[connectToRemoteKubernetes] Cluster: ', cluster);

    return loginToK8s(logger, credentials)
        .then(result => {
            logger.silly('[connectToRemoteKubernetes] LoginResult: ', result);

            let config = {
                server: 'https://' + cluster.endpoint,
                token: result.access_token,
                httpAgent: {
                    ca: base64.decode(cluster.masterAuth.clusterCaCertificate),
                }
            }

            const client = new KubernetesClient(logger, config);
            return client.init();
        });
}

function loginToK8s(logger: ILogger, credentials: any)
{
    let token = buildK8sToken(credentials);

    const options : AxiosRequestConfig = {
        url: 'https://www.googleapis.com/oauth2/v4/token',
        method: 'POST',
        data: {
            'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion': token
        }
    };
    logger.silly('[loginToK8s] request: ', options);
    return axios(options)
        .then(result => {
            logger.silly('[loginToK8s] result: ', result);
            return result.data;
        })
}

function buildK8sToken(credentials)
{
    const TOKEN_DURATION_IN_SECONDS = 3600;
    let issuedAt = Math.floor(Date.now() / 1000);
    let token = jwt.sign(
        {
            'iss': credentials.client_email,
            'sub': credentials.client_email,
            'aud': 'https://www.googleapis.com/oauth2/v4/token',
            'scope': 'https://www.googleapis.com/auth/cloud-platform',
            'iat': issuedAt,
            'exp': issuedAt + TOKEN_DURATION_IN_SECONDS,
        },
        credentials.private_key,
        {
            algorithm: 'RS256',
            header: {
            'kid': credentials.private_key_id,
            'typ': 'JWT',
            'alg': 'RS256',
            },
        }
    );
    return token;
}