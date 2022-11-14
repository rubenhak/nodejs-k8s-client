import { logger } from './utils/logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';
import { Promise } from 'the-promise';
import { KubernetesObject } from '../src';


describe('query-all', function() {

    it('using-get', function () {

        const allResources : Record<string, string[]> = {};
        
        return fetchClient()
            .then(client => {

                return Promise.serial(client.ApiGroups, x => {

                    logger.info("Querying %s ...", x.id);

                    return client.client(x.kindName, x.apiName)!
                        .queryAll()
                        .catch(reason => {
                            logger.error("ERROR: Resource: %s. Code: %s. Message: %s", x.id, reason.code, reason.message);
                            return <KubernetesObject[]>[];
                        })
                        .then(result => {

                            allResources[x.id] = 
                                result.map(x => x.metadata.name);

                        })
                    
                })
            })
            .then(() => {

                // logger.info("FINAL RESULT: ", allResources);

            });

    })
    .timeout(60 * 1000)
    ;


    it('using-watch', function () {

        const allResources : Record<string, string[]> = {};
        
        return fetchClient()
            .then(client => {

                return Promise.serial(client.ApiGroups, x => {

                    logger.info("Querying %s ...", x.id);

                    client.client(x.kindName, x.apiName)!
                        .watchAll(null, 
                            (action, data) => {

                            },
                            (watch) => {

                            },
                            (watch) => {
                                
                            })
                    
                })
                .then(() => Promise.timeout(5 * 1000))
                .then(() => {
                    client.close();
                });
            })
            .then(() => {
                logger.info("FINAL RESULT: ", allResources);

            });

    })
    .timeout(60 * 1000);
    
});