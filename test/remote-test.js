var should = require('should');

var ClientFetcher = require('./client');

describe('gcp-tests', function() {

    it('deployment-query', function () {
        
        return ClientFetcher()
            .then(client => {
                return client.Deployment.queryAll("kube-system")
            })
            .then(result => {
                result.should.be.an.Array;

                console.log(result.map(x => x.metadata.name));

                result.should.matchEvery(x => x.metadata.namespace == "kube-system");
                result.should.matchAny(x => x.metadata.name == "kube-dns");
            });
            
    });

});