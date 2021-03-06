function getLogger(logger) {
    if (logger) {
        return logger;
    }
    var logger = require('the-logger').setup('k8s-client',
    {
        enableFile: false,
        pretty: true
    });
    return logger;
}

/**
 * Connects to Kubernetes server.
 * Arguments:
 *  logger:
 *  config: additional parameters:
 *     server: server url
 *     token: access token
 *     httpAgent: passed to http agent
 *       ca: cluster CA certificate
 *       cert: client certificate
 *       key: client private key
 *
 */
module.exports.connect = function(logger, config) {
    logger = getLogger(logger);

    const connector = require('./lib/connector-remote');
    return connector(logger, config);
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
