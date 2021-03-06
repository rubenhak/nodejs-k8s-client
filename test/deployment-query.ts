import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

describe('deployment-query', function() {

    it('deployment-query-all', function () {
        
        return fetchClient()
            .then(client => {
                should(client.Deployment).be.ok();
                return client.Deployment!.queryAll("kube-system")
            })
            .then(result => {
                should(result).be.an.Array;

                should(result.length).greaterThan(0);

                // console.log(result.map(x => x.metadata.name));

                should(result).matchEvery(x => x.metadata.namespace == "kube-system");
                should(result).matchAny(x => x.metadata.name == "coredns");

                for(let x of result)
                {
                    should(x).be.ok();
                    should(x.apiVersion).startWith('apps/')
                    should(x.kind).be.equal('Deployment')
                    should(x.metadata.namespace).be.equal('kube-system')
                }
            });

    });

    it('deployment-query-one', function () {
        
        return fetchClient()
            .then(client => {
                should(client.Deployment).be.ok();
                return client.Deployment!.query("kube-system", "coredns")
            })
            .then(result => {
                should(result).be.ok();
                should(result.apiVersion).startWith('apps/')
                should(result.kind).be.equal('Deployment')
                should(result.metadata.name).be.equal('coredns')
                should(result.metadata.namespace).be.equal('kube-system')
            });

    });

});