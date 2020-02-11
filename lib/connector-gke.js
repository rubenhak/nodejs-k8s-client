const _ = require('the-lodash');
const container = require('@google-cloud/container');
const jwt = require('jsonwebtoken');
const base64 = require("base-64");
const axios = require('axios');

module.exports = function(logger, credentials, id, region) {

    return queryCluster(logger, credentials, id, region)
        .then(cluster => {
            return connectToGKE(logger, cluster, credentials);
        });

}

function queryCluster(logger, credentials, id, region)
{
    var client = new container.ClusterManagerClient({
        credentials: credentials
    });

    var params = {
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

function connectToGKE(logger, cluster, credentials)
{
    logger.silly('[connectToRemoteKubernetes] Cluster: ', cluster);

    return loginToK8s(logger, credentials)
        .then(result => {
            logger.silly('[connectToRemoteKubernetes] LoginResult: ', result);

            var endpoint = 'https://' + cluster.endpoint;
            var config = {
                caData: base64.decode(cluster.masterAuth.clusterCaCertificate),
                token: result.access_token
            }

            const connector = require('./connector-remote');
            return connector(logger, endpoint, config);
        });
}

function loginToK8s(logger, credentials)
{
    var token = buildK8sToken(credentials);

    const options = {
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
    var issuedAt = Math.floor(Date.now() / 1000);
    var token = jwt.sign(
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