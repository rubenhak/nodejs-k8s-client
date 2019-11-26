var fs = require('fs');
var path = require('path');
const K8sClient = require('../');

const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'gcp-credentials.json'), 'utf8'));

return K8sClient.connectToGKE(null, credentials, "kube-cluster-1", "us-west1-a")
    .then(client => {
        return client.Deployment.queryAll("kube-system")
    })
    .then(result => {
        console.log(result);
    })
    .catch(reason => {
        console.log("***** ERROR *****");
        console.log(reason);
    })
    ;