import { logger } from './utils/logger';
import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

describe('sync-query', function() {

    it('sync-query-all-with-ns', async function () {
        
        return fetchClient()
            .then((client) => {

                should(client.Pod).be.ok();
                const result = client.Pod!.queryAllSync("kube-system")

                should(result).be.an.Array;

                const namespaces = result.map(x => x.metadata.namespace);
                const names = result.map(x => x.metadata.name);

                should(namespaces).matchEvery(x => x == "kube-system");
                should(names).matchAny(x => _.startsWith(x, "coredns"));
            })

    })
    .timeout(10 * 1000)
    ;

    it('sync-query-all-no-ns', function () {
        
        return fetchClient()
            .then(client => {

                should(client.Pod).be.ok();
                const result = client.Pod!.queryAllSync()

                should(result).be.an.Array;

                const namespaces = result.map(x => x.metadata.namespace);

                should(namespaces).matchSome(x => x == "default");
                should(namespaces).matchSome(x => x == "kube-system");
            })

    });

    it('sync-query-one', function () {
        
        return fetchClient()
            .then(client => {
                should(client.Deployment).be.ok();
                const result = client.Deployment!.querySync("kube-system", "coredns")

                should(result).be.ok();
                should(result!.apiVersion).startWith('apps/')
                should(result!.kind).be.equal('Deployment')
                should(result!.metadata.name).be.equal('coredns')
                should(result!.metadata.namespace).be.equal('kube-system')
            });

    });

    it('sync-query-one-missing', function () {
        
        return fetchClient()
            .then(client => {
                should(client.Deployment).be.ok();
                const result = client.Deployment!.querySync("kube-system", "not-present")

                should(result).be.null();
            });

    });
    
});