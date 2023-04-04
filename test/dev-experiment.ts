import { logger } from './utils/logger';

import 'mocha';
import should from 'should';
import _ from 'the-lodash';
import { fetchClient } from './utils/client';


describe('dev-experiment', function() {

    it('cluster-api', function () {
        
        return fetchClient(logger)
            .then(client => {

                return Promise.resolve()
                    .then(() => {
                        return client.client('CronJob', 'batch')!.queryAll()
                            .then(results => {
                                logger.info("CRON JOBS: ", results);
                            })
                    })
                    .then(() => {
                        return client.client('HorizontalPodAutoscaler', 'autoscaling')!.queryAll()
                            .then(results => {
                                logger.info("HPAs: ", results);
                            })
                    })

            });

    });


});