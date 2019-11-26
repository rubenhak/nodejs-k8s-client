const _ = require('the-lodash');

module.exports = function(logger, endpoint, config) {

    const KubernetesClient = require('./kubernetes-client');

    if (config) {
        config = _.clone(config);
    } else {
        config = {}
    }
    if (endpoint) {
        config.server = endpoint;
    }
    return new KubernetesClient(logger, config);

}