var Promise = require('the-promise');
var _ = require('the-lodash');
var should = require('should');

var ClientFetcher = require('./client');

describe('custom-priority-class-query', function() {

    it('case-1', function () {
        
        return ClientFetcher()
            .then(client => {
                return client.client("PriorityClass", "scheduling.k8s.io").queryAll()
            })
            .then(result => {
                result.should.be.an.Array;

                console.log(result.map(x => x.metadata.name));

                result.should.matchAny(x => x.metadata.name == "system-cluster-critical");
            });

    });
    
});