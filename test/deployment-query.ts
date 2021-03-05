import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

describe('deployment-query', function() {

    it('case-1', function () {
        
        return fetchClient()
            .then(client => {
                should(client.Deployment).be.ok();
                return client.Deployment!.queryAll("kube-system")
            })
            .then(result => {
                should(result).be.an.Array;

                console.log(result.map(x => x.metadata.name));

                should(result).matchEvery(x => x.metadata.namespace == "kube-system");
                should(result).matchAny(x => x.metadata.name == "coredns");
            });

    });

});