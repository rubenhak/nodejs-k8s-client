import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

describe('pod-query', function() {

    it('case-1', function () {
        
        return fetchClient()
            .then(client => {
                should(client.Pod).be.ok();
                return client.Pod!.queryAll("kube-system")
            })
            .then(result => {
                should(result).be.an.Array;

                // console.log(result.map(x => x.metadata.name));

                should(result).matchEvery(x => x.metadata.namespace == "kube-system");
                should(result).matchAny(x => _.startsWith(x.metadata.name, "coredns"));
                should(result).matchAny(x => _.startsWith(x.metadata.name, "kube-proxy"));
            });

    });
    
});