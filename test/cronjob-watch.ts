import { logger } from './utils/logger';

import 'mocha';
import should from 'should';
import _ from 'the-lodash';
import { fetchClient } from './utils/client';
import { MyPromise } from 'the-promise';
import { DeltaAction } from '../src';
import { KubernetesObject } from '../src';

describe('cronjob-watch', function() {

    it('cronjob-watch-all', function () {
        
        return fetchClient()
            .then(client => {
                should(client).be.ok();

                const resourceClient = client.client('CronJob', 'batch');
                should(resourceClient).be.ok();

                const resources : Record<string, KubernetesObject> = {};

                const watch = resourceClient!.watchAll(null, (action, data) => {
                    const key = `${data.metadata.namespace}::${data.metadata.name}`;
                    if (action == DeltaAction.Added || action == DeltaAction.Modified) {
                        resources[key] = data;
                    } else {
                        delete resources[key];
                    }

                }, () => {}, () => {});

                return MyPromise.delay(5 * 1000)
                    .then(() => {
                        watch.close();
                        
                        should(resources['default::hello']).be.ok();

                        should(_.keys(resources).length).be.equal(1);
                    })

            })

    })
    .timeout(40 * 1000);

});