const _ = require('the-lodash');

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

    const KubernetesClient = require('./kubernetes-client');

    config = {} || _.clone(config);
    if (endpoint) {
        config.server = endpoint;
    }
    return new KubernetesClient(logger, config);
}