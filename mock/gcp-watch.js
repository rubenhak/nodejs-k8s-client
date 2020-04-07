var ClientFetcher = require('../test/client');

return ClientFetcher()
    .then(client => {
        return client.Deployment.watchAll("kube-system", (x) => {
            console.log("!!! WATCH CB: " + x);
        }, () => {
            console.log("!!! WATCH CONNECTED");
        }, (resourceAccessor, data) => {
            console.log("!!! WATCH DISCONNECTED, status: " + data.status);
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