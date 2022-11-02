import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';
import { Promise } from 'the-promise';
import { DeltaAction } from '../src';
import { KubernetesObject } from '../src';

describe('hpa-watch', function() {

    it('hpa-watch-all', function () {
        
        return fetchClient()
            .then(client => {
                should(client).be.ok();

                const hpaClient = client.client('HorizontalPodAutoscaler', 'autoscaling');
                should(hpaClient).be.ok();

                const resources : Record<string, KubernetesObject> = {};

                const watch =  hpaClient!.watchAll(null, (action, data) => {
                    const key = `${data.metadata.namespace}::${data.metadata.name}`;
                    if (action == DeltaAction.Added || action == DeltaAction.Modified) {
                        resources[key] = data;
                    } else {
                        delete resources[key];
                    }

                }, () => {}, () => {});

                return Promise.timeout(5 * 1000)
                    .then(() => {
                        watch.close();
                        
                        should(resources['default::hpa-test']).be.ok();

                        should(_.keys(resources).length).be.equal(1);
                    })

            })

    })
    .timeout(40 * 1000);

});