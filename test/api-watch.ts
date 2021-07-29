import { setupLogger, LoggerOptions } from 'the-logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';
import { Promise } from 'the-promise';

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true);
const logger = setupLogger('test', loggerOptions);


describe('api-watch', function() {

    it('case-1', function () {

        const apis : Record<string, boolean> = {};
        
        return fetchClient()
            .then(client => {

                client.watchClusterApi((isPresent, api) => {
                    logger.info("API. Present: %s, Name: %s", isPresent, api.id);
                    if (isPresent) {
                        apis[api.id] = true;
                    } else {
                        delete apis[api.id];
                    }
                }, 3000)
                
                return Promise.timeout(5 * 1000)
                    .then(() => client.close());
            })
            .then(result => {
                should(apis['apps::DaemonSet']).be.true();
            });

    })
    .timeout(10 * 1000);
    
});