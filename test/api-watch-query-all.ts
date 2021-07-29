import { setupLogger, LoggerOptions } from 'the-logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';
import { Promise } from 'the-promise';
import { KubernetesObject } from '../src';
import { DeltaAction, ResourceWatch } from '../src/resource-watch';

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true);
const logger = setupLogger('test', loggerOptions);


describe('api-watch-query-all', function() {

    it('case-1', function () {

        const watches : Record<string, ResourceWatch> = {};
        const allResources : Record<string, Record<string, true>> = {};

        return fetchClient()
            .then(client => {

                client.watchClusterApi((isPresent, api, resourceClient) => {
                    logger.info("API. Present: %s, Name: %s", isPresent, api.id);
                    if (isPresent) {

                        const watch = resourceClient!
                            .watchAll(null, 
                                (action, data) => {
                                    const key = `${data.metadata.namespace}::${data.metadata.name}`;
                                    if (action == DeltaAction.Added || action == DeltaAction.Modified) {
                                        if (!allResources[api.id]) {
                                            allResources[api.id] = {}
                                        }
                                        allResources[api.id][key] = true;
                                    } else {
                                        if (allResources[api.id]) {
                                            delete allResources[api.id][key]
                                        }
                                    }
                                },
                                (watch) => {

                                },
                                (watch) => {
                                    
                                })

                        watches[api.id] = watch;
                    } else {
                        delete allResources[api.id];

                        const watch = watches[api.id];
                        if (watch) {
                            watch.close();
                            delete watches[api.id];
                        }
                    }
                }, 3000)
                
                return Promise.timeout(10 * 1000)
                    .then(() => client.close());
            })
            .then(result => {
                const dict = allResources['ServiceAccount'];
                should(dict).be.ok();
                should(dict['kube-system::default']).be.ok();
                // logger.info("XXX", allResources);
            });
            

    })
    .timeout(20 * 1000);


});