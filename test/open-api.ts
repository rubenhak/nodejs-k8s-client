import { setupLogger, LoggerOptions } from 'the-logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true);
const logger = setupLogger('test', loggerOptions);


describe('open-api', function() {

    it('query-root', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryRootPaths()
                    .then(result => {

                        // logger.info("RESULT: ", result);

                        should(result.paths['api/v1']).be.ok();

                    })
            });
    });

    it('query-clusterVersion', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryClusterVersion()
                    .then(result => {

                        logger.info("clusterVersion: ", result);

                        should(result).be.ok();
                        should(result).be.a.String();
                    })
            });
    })

    it('query-all-paths', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryAllPaths()
                    .then(result => {

                        // logger.info("RESULT: ", result);

                        for(const name of _.keys(result)) {
                            const data = result[name];

                            should(data).be.ok();
                            should(data.openapi).be.equal("3.0.0");
                            should(data.info.title).be.equal("Kubernetes");
                            should(data.paths).be.ok();
                            should(data.components).be.ok();
                        }

                    })
            });
    })
    
});