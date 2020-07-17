const _ = require('the-lodash');

module.exports = function(logger, config) {
    const KubernetesClient = require('./kubernetes-client');
    var client = new KubernetesClient(logger, config);
    return Promise.resolve()
        .then(() => client.init())
        ;
}