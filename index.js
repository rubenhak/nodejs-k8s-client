const _ = require('the-lodash');
const container = require('@google-cloud/container');

function getLogger(logger) {
    var logger = require('the-logger').setup('k8s-client',
    {
        enableFile: false,
        pretty: true
    });
    logger.level = 'silly';
    return logger;
}

/**
 * Connects to Kubernetes server. 
 * Arguments:
 *  logger: 
 *  endpoint: server url
 *  config: additional parameters:
 *     caData: cluster CA certificate
 *     token: access token
 */
module.exports.connect = function(logger, endpoint, config) {
    logger = getLogger(logger);

    const connector = require('./lib/connector-remote');
    return connector(logger, endpoint, config);
}

/**
 * Connects to GCP server. 
 * Arguments:
 *  logger: 
 *  endpoint: server url
 *  config: additional parameters:
 *     caData: cluster CA certificate
 *     token: access token
 */
module.exports.connect = function(logger, endpoint, config) {
    logger = getLogger(logger);

    const connector = require('./lib/connector-gcp');
    return connector(logger, endpoint, config);
}

/**
 * Connects to GCP server. 
 * Arguments:
 *  logger: 
 *  credentials: gcp credentials
 *  id: cluster name
 *  region: cluster region
 */
module.exports.connectToGKE = function(logger, credentials, id, region) {
    logger = getLogger(logger);

    const connector = require('./lib/connector-gke');
    return connector(logger, credentials, id, region);
}

