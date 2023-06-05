import { logger } from './utils/logger';

import 'mocha';
import should from 'should';
import _ from 'the-lodash';
import { fetchClient } from './utils/client';
import { connectRemoteCluster } from '../src';


describe('connector-test', function() {

    it('remote', async function () {
        
        const client = await connectRemoteCluster(logger, process.env.KUBECONFIG!);

        return client.client('CronJob', 'batch')!.queryAll()
            .then(results => {
                logger.info("CRON JOBS: ", results);
            });
               
    });


});