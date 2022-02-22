import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

describe('cronjob-query', function() {

    it('cronjob-query-all', function () {
        
        return fetchClient()
            .then(client => {
                should(client).be.ok();

                const resourceClient = client.client('CronJob', 'batch');
                should(resourceClient).be.ok();

                return resourceClient!.queryAll("default");
            })
            .then(result => {
                should(result).be.an.Array;

                should(result.length).equal(1);

                should(result).matchEvery(x => x.kind == "CronJob");
                should(result).matchEvery(x => x.metadata.namespace == "default");
                should(result).matchEvery(x => x.metadata.name == "hello");
            });

    });

});