var ClientFetcher = require('../test/client');

return ClientFetcher()
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