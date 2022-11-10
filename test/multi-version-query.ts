import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

describe('multi-version-query', function() {

    it('case-core-api-no-version', function () {
        
        return fetchClient()
            .then(client => {
                const rClient = client.client('Pod'); 
                should(rClient).be.ok();
                return rClient!.queryAll("kube-system")
            })
            .then(result => {
                should(result).be.an.Array;

                const namespaces = result.map(x => x.metadata.namespace);
                const names = result.map(x => x.metadata.name);

                should(namespaces).matchEvery(x => x == "kube-system");
                should(names).matchAny(x => _.startsWith(x, "coredns"));
            });
    });

    it('case-core-api-with-version-01', function () {
        
        return fetchClient()
            .then(client => {
                const rClient = client.client('Pod', null, 'v1'); 
                should(rClient).be.ok();
                return rClient!.queryAll("kube-system")
                // client.logger.info("CLUSTER INFO: PREFERRED: ", client.clusterInfo?.preferredVersions);
                // client.logger.info("CLUSTER INFO: enabledApiGroups: ", client.clusterInfo?.enabledApiGroups);
            })
            .then(result => {
                should(result).be.an.Array;

                const namespaces = result.map(x => x.metadata.namespace);
                const names = result.map(x => x.metadata.name);

                should(namespaces).matchEvery(x => x == "kube-system");
                should(names).matchAny(x => _.startsWith(x, "coredns"));
            });
    });

    it('case-hpa-api-no-version', function () {
        
        return fetchClient()
            .then(client => {
                const rClient = client.client('HorizontalPodAutoscaler', 'autoscaling'); 
                should(rClient).be.ok();
                return rClient!.queryAll()
            })
            .then(result => {
                should(result).be.an.Array;

                should(result.length).equal(1);

                should(result).matchEvery(x => x.kind == "HorizontalPodAutoscaler");
                should(result).matchEvery(x => x.metadata.namespace == "default");
                should(result).matchSome(x => x.metadata.name == "hpa-test");
            });
    });

    it('case-hpa-api-preferred', function () {
        
        return fetchClient()
            .then(client => {
                const rClient = client.client('HorizontalPodAutoscaler', 'autoscaling', 'v2'); 
                should(rClient).be.ok();
                return rClient!.queryAll()
            })
            .then(result => {
                should(result).be.an.Array;

                should(result.length).equal(1);

                should(result).matchEvery(x => x.kind == "HorizontalPodAutoscaler");
                should(result).matchEvery(x => x.metadata.namespace == "default");
                should(result).matchSome(x => x.metadata.name == "hpa-test");
            });
    });

    it('case-hpa-api-nonpreferred', function () {
        
        return fetchClient()
            .then(client => {
                const rClient = client.client('HorizontalPodAutoscaler', 'autoscaling', 'v2beta2'); 
                should(rClient).be.ok();
                return rClient!.queryAll()
            })
            .then(result => {
                should(result).be.an.Array;

                should(result.length).equal(1);

                should(result).matchEvery(x => x.kind == "HorizontalPodAutoscaler");
                should(result).matchEvery(x => x.metadata.namespace == "default");
                should(result).matchSome(x => x.metadata.name == "hpa-test");
            });
    });

    it('case-unknown-version', function () {
        
        return fetchClient()
            .then(client => {
                const rClient = client.client('HorizontalPodAutoscaler', 'autoscaling', 'v0'); 
                should(rClient).not.be.ok();
            })
    });
    
});