import { setupLogger, LoggerOptions } from 'the-logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true);
const logger = setupLogger('test', loggerOptions);

describe('dev-experiment', function() {

    it('ingress-query', function () {
        
        return fetchClient()
            .then(client => {

                return Promise.resolve()
                    // .then(() => {
                    //     return client.client('Ingress', 'extensions')!.queryAll()
                    //         .then(results => {
                    //             logger.info("INGRESSES FROM EXTENSIONS: ", results);
                    //         })
                    // })
                    // .then(() => {
                    //     return client.client('Ingress', 'networking.k8s.io')!.queryAll()
                    //         .then(results => {
                    //             logger.info("INGRESSES FROM networking.k8s.io: ", results);
                    //         })
                    // })
                    .then(() => {
                        return client.Ingress!.queryAll()
                        .then(results => {

                            // logger.info("INGRESSES: ", results);
                            for(let x of results)
                            {
                                logger.info("%s :: %s, metadata: ", x.apiVersion, x.kind, x.metadata);

                            }
                        })
                    })



            });

    });


});