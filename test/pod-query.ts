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

                const namespaces = result.map(x => x.metadata.namespace);
                const names = result.map(x => x.metadata.name);

                should(namespaces).matchEvery(x => x == "kube-system");
                should(names).matchAny(x => _.startsWith(x, "coredns"));
                should(names).matchAny(x => _.startsWith(x, "metrics"));
            });

    });
    
});