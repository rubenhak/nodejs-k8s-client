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

                should(result.length).equal(3);

                should(result).matchEvery(x => x.kind == "HorizontalPodAutoscaler");
                should(result).matchEvery(x => x.metadata.namespace == "default");
                should(result).matchSome(x => x.metadata.name == "hpa-v1");
                should(result).matchSome(x => x.metadata.name == "hpa-v2beta1");
                should(result).matchSome(x => x.metadata.name == "hpa-v2beta2");
            });

    });

    
    it('hpa-query-one-v1', function () {
        
        return fetchClient()
            .then(client => {
                should(client.Deployment).be.ok();

                const hpaClient = client.client('HorizontalPodAutoscaler', 'autoscaling');
                return hpaClient!.query("default", "hpa-v1")
            })
            .then(result => {
                should(result).be.ok();

                should(result.kind).be.equal("HorizontalPodAutoscaler");
                should(result.metadata.namespace).be.equal("default");
                should(result.metadata.name).be.equal("hpa-v1");
            });

    });


});