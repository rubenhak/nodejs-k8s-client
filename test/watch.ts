import { setupLogger, LoggerOptions } from 'the-logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { DeltaAction } from '../src';
import { fetchClient } from './utils/client';

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true);
const logger = setupLogger('test', loggerOptions);

describe('deployment-watch', function() {

    it('case-1', function () {

        let watchResult = {
            connected: false,
            disconnected: false,
            result: <any[]>[]
        }

        return fetchClient()
            .then(client => {

                should(client.Deployment).be.ok();

                let watch = client.Deployment!.watchAll("kube-system", (action, data) => {
                    logger.info("Handler :: %s => %s", action, data.metadata.name);
                    if (action == DeltaAction.Added) {
                        watchResult.result.push(data);
                    }
                }, () => {
                    watchResult.connected = true;
                }, (resourceAccessor, data) => {
                    watchResult.disconnected = true;
                })

                return Promise.timeout(5000)
                    .then(() => {
                        watch.stop()
                        return watch.waitClose();
                    })
            })
            .then(() => {
                
                should(watchResult.result.length).be.greaterThan(0);

                // console.log(watchResult.result.map(x => x.metadata.name));

                should(watchResult.result).matchEvery(x => x.metadata.namespace == "kube-system");
                should(watchResult.result).matchAny(x => x.metadata.name == "coredns");

                for(let x of watchResult.result)
                {
                    should(x).be.ok();
                    should(x.apiVersion).startWith('apps/')
                    should(x.kind).be.equal('Deployment')
                    should(x.metadata.namespace).be.equal('kube-system')
                }
            });
            
    })
    .timeout(20 * 1000);

});