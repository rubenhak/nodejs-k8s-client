var fs = require('fs');
var path = require('path');
const K8sClient = require('../');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'server-credentials.json'), 'utf8'));
console.log(config)
var client = K8sClient.connect(null, null, config);

client.Deployment.queryAll("kube-system")
    .then(result => {
        console.log(result);
    })
    .catch(reason => {
        console.log("***** ERROR *****");
        console.log(reason);
    })
    ;