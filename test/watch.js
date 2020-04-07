var Promise = require('the-promise');
var should = require('should');

var ClientFetcher = require('./client');

describe('deployment-watch', function() {

    it('case-1', function () {

        return ClientFetcher()
            .then(client => {

                var watchResult = {
                    connected: false,
                    disconnected: false,
                    result: []
                }

                var watch = client.Deployment.watchAll("kube-system", (action, data) => {
                    if (action == "ADDED") {
                        watchResult.result.push(data);
                    }
                }, () => {
                    watchResult.connected = true;
                }, (resourceAccessor, data) => {
                    watchResult.disconnected = true;
                })

                return Promise.timeout(5000)
                    .then(() => {
                        watch.stop()
                        return watch.waitClose();
                    })
                    .then(() => watchResult);
            })
            .then(watchResult => {
                watchResult.result.should.be.an.Array;

                console.log(watchResult.result.map(x => x.metadata.name));

                watchResult.result.should.matchEvery(x => x.metadata.namespace == "kube-system");
                watchResult.result.should.matchAny(x => x.metadata.name == "kube-dns");
            });
            
    });

});