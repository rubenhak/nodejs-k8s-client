import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

describe('hpa-query', function() {

    it('hpa-query-all', function () {
        
        return fetchClient()
            .then(client => {
                should(client).be.ok();

                const hpaClient = client.client('HorizontalPodAutoscaler', 'autoscaling');
                should(hpaClient).be.ok();

                return hpaClient!.queryAll("default");
            })
            .then(result => {
                should(result).be.an.Array;

                should(result.length).equal(1);

                should(result).matchEvery(x => x.kind == "HorizontalPodAutoscaler");
                should(result).matchEvery(x => x.metadata.namespace == "default");
                should(result).matchSome(x => x.metadata.name == "hpa-test");
            });

    });

    
    it('hpa-query-one-v1', function () {
        
        return fetchClient()
            .then(client => {
                should(client.Deployment).be.ok();

                const hpaClient = client.client('HorizontalPodAutoscaler', 'autoscaling');
                return hpaClient!.query("default", "hpa-test")
            })
            .then(result => {
                should(result).be.ok();

                should(result.kind).be.equal("HorizontalPodAutoscaler");
                should(result.metadata.namespace).be.equal("default");
                should(result.metadata.name).be.equal("hpa-test");
            });

    });


});