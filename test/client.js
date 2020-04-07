const K8sClient = require('../');

module.exports = function() {
 
    if (!process.env['GCP_SERVICE_ACCOUNT']) {
        throw new Error('Missing env variable GCP_SERVICE_ACCOUNT');
    }
    if (!process.env['GCP_CLUSTER_NAME']) {
        throw new Error('Missing env variable GCP_CLUSTER_NAME');
    }
    if (!process.env['GCP_REGION']) {
        throw new Error('Missing env variable GCP_REGION');
    }

    var svcAccount = JSON.parse(process.env['GCP_SERVICE_ACCOUNT']);
    return K8sClient.connectToGKE(null, svcAccount, process.env['GCP_CLUSTER_NAME'], process.env['GCP_REGION'])
        .then(client => {
            return client;
        })
}