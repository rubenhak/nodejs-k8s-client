import { logger } from './utils/logger';

import 'mocha';
import should from 'should';
import _ from 'the-lodash';
import { fetchClient } from './utils/client';
import { MyPromise } from 'the-promise';
import { apiId } from '../src/utils';

const WATCH_DURATION = 10 * 1000;
const REFRESH_INTERVAL = 5 * 1000;

describe('api-watch-simple', function() {

    it('case-1', function () {

        const apis : Record<string, boolean> = {};
        
        return fetchClient()
            .then(client => {

                client.watchClusterApi((isPresent, api) => {
                    logger.info(">>>>>> API. Present: %s, Name: %s :: %s", isPresent, api.id, api.version);
                    if (isPresent) {
                        apis[api.id] = true;
                    } else {
                        delete apis[api.id];
                    }
                }, REFRESH_INTERVAL)
                
                return MyPromise.delay(WATCH_DURATION)
                    .then(() => client.close());
            })
            .then(result => {
                should(apis[apiId('DaemonSet', 'apps')]).be.true();
                should(apis[apiId('Pod', null)]).be.true();
                should(apis[apiId('HorizontalPodAutoscaler', 'autoscaling')]).be.true();
            });

    })
    .timeout(WATCH_DURATION + 5 * 1000);
    
});