import { setupLogger, LoggerOptions, LogLevel } from 'the-logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true)
    // .level(LogLevel.verbose)
const logger = setupLogger('test', loggerOptions);

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

            });

    });


});