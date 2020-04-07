var Promise = require('the-promise');
var _ = require('the-lodash');
var should = require('should');

var ClientFetcher = require('./client');

describe('pod-query', function() {

    it('case-1', function () {
        
        return ClientFetcher()
            .then(client => {
                return client.Pod.queryAll("kube-system")
            })
            .then(result => {
                result.should.be.an.Array;

                console.log(result.map(x => x.metadata.name));

                result.should.matchEvery(x => x.metadata.namespace == "kube-system");
                result.should.matchAny(x => _.startsWith(x.metadata.name, "kube-dns"));
                result.should.matchAny(x => _.startsWith(x.metadata.name, "kube-proxy"));
            });

    });
    
});