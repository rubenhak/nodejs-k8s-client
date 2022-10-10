import { setupLogger, LoggerOptions } from 'the-logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true);
const logger = setupLogger('test', loggerOptions);


describe('open-api', function() {

    it('query-clusterVersionInfo', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryClusterVersionInfo()
                    .then(result => {

                        logger.info("clusterVersionInfo: ", result);

                        should(result).be.ok();
                        // should(result).be.a.String();
                    })
            });
    })

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

    it('v3-query-root', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryV3RootPaths()
                    .then(result => {

                        should(result.paths['api/v1']).be.ok();

                    })
            });
    });

    it('v3-query-all-paths', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryV3AllPaths()
                    .then(result => {

                        // logger.info("RESULT: ", result);

                        for(const name of _.keys(result)) {
                            const data = result[name];

                            should(data).be.ok();
                            should(data.openapi).be.equal("3.0.0");
                            should(data.info.title).be.String()
                            should(data.paths).be.ok();
                            should(data.components).be.ok();

                            if (name === "api/v1")
                            {
                                should(data.paths['/api/v1/']).be.ok();
                                should(data.paths['/api/v1/namespaces/{namespace}/pods']).be.ok();
                                should(data.paths['/api/v1/namespaces/{namespace}/pods']['get']).be.ok();
        
                                should(data.paths['/api/v1/namespaces/{namespace}/pods']['post']).be.ok();
                                should(data.paths['/api/v1/namespaces/{namespace}/pods']['post']['x-kubernetes-action']).be.equal('post');
                                should(data.paths['/api/v1/namespaces/{namespace}/pods']['post']['x-kubernetes-group-version-kind']).be.eql({
                                    group: "",
                                    kind: "Pod",
                                    version: "v1"
                                });

                                should(data.paths['/api/v1/namespaces/{namespace}/pods']['post'].requestBody!.content!['*/*'].schema['$ref']).be.equal('#/components/schemas/io.k8s.api.core.v1.Pod');

                                should(data.components!.schemas!["io.k8s.api.core.v1.Pod"]).be.ok();
                                should(data.components!.schemas!["io.k8s.api.core.v1.Pod"].type).be.equal('object');
                            }
                        }

                    })
            });
    })
    .timeout(20 * 1000)
    ;

    it('v2-query-root', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryV2Root()
                    .then(result => {

                        should(result.swagger).be.equal('2.0');
                        
                        should(result.paths['/api/v1/']).be.ok();
                        should(result.paths['/api/v1/namespaces/{namespace}/pods']).be.ok();
                        should(result.paths['/api/v1/namespaces/{namespace}/pods']['get']).be.ok();

                        should(result.paths['/api/v1/namespaces/{namespace}/pods']['post']).be.ok();
                        should(result.paths['/api/v1/namespaces/{namespace}/pods']['post']['x-kubernetes-action']).be.equal('post');
                        should(result.paths['/api/v1/namespaces/{namespace}/pods']['post']['x-kubernetes-group-version-kind']).be.eql({
                            group: "",
                            kind: "Pod",
                            version: "v1"
                        });
                        should(result.paths['/api/v1/namespaces/{namespace}/pods']['post']['parameters'][0].schema['$ref']).be.equal('#/definitions/io.k8s.api.core.v1.Pod');
                        
                        should(result.definitions["io.k8s.api.core.v1.Pod"]).be.ok();
                        should(result.definitions["io.k8s.api.core.v1.Pod"].type).be.equal('object');
                    })
            });

    })
    .timeout(20 * 1000)
    ;

    
});