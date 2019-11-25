const K8sClient = require('../');

const config = require('./sample-connect.js');

var client = K8sClient.connect(null, null, config);

client.Deployment.queryAll()
    .then(result => {
        console.log(result);
    })
    ;