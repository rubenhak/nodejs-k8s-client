var fs = require('fs');
var path = require('path');
const K8sClient = require('../');

const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'gcp-credentials.json'), 'utf8'));

return K8sClient.connectToGKE(null, credentials, "kubevious-samples", "us-central1-a")
    .then(client => {
        return client.Deployment.watchAll("kube-system", (x) => {
            console.log("!!! WATCH CB: " + x);
        }, () => {
            console.log("!!! WATCH CONNECTED");
        }, () => {
            console.log("!!! WATCH DISCONNECTED");
        })
    })
    .then(result => {
        console.log("*******************");
    })
    .catch(reason => {
        console.log("***** ERROR *****");
        console.log(reason);
    })
    ;