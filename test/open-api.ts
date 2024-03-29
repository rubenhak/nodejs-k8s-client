import { logger } from './utils/logger';

import 'mocha';
import should from 'should';
import _ from 'the-lodash';
import { fetchClient } from './utils/client';
import { K8sOpenApiSpecs, K8sOpenApiSpecToJsonSchemaConverter } from '../src';


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

    it('query-api-spec', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryApiSpecs()
                    .then(result => {

                        should(result).be.ok();

                        should(result.k8sVersion).be.a.String();
                        should(result.openApiVersion).be.a.String();

                        if (result.openApiV2Data) {
                            should(result.openApiV3Data).not.be.ok();
                        }

                        if (result.openApiV3Data) {
                            should(result.openApiV2Data).not.be.ok();
                        }
                        
                    })
            });

    })
    .timeout(20 * 1000)
    ;

    it('open-api-to-json-schema-converter-default', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryApiSpecs()
                    .then(result => {
                        validateAPIConverter(result);
                    });

            });

    })
    .timeout(20 * 1000)
    ;

    it('open-api-to-json-schema-converter-v2', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryApiSpecs({ forceApiV2: true })
                    .then(result => {
                        validateAPIConverter(result);
                    });

            });

    })
    .timeout(20 * 1000)
    ;

    it('open-api-to-json-schema-converter-v3', function () {

        return fetchClient()
            .then(client => {
                should(client).be.ok();

                return client.openAPI.queryApiSpecs({ forceApiV3: true })
                    .then(result => {
                        validateAPIConverter(result);
                    });

            });

    })
    .timeout(20 * 1000)
    ;
    
});

// helpers
function validateAPIConverter(result: K8sOpenApiSpecs)
{
    should(result).be.ok();

    const converter = new K8sOpenApiSpecToJsonSchemaConverter(logger, result);
    const jsonSchema = converter.convert();
    
    should(jsonSchema).be.ok();
    should(jsonSchema.resources).be.ok();
    should(jsonSchema.definitions).be.ok();

    {
        const resourceMeta = jsonSchema.resources[_.stableStringify({ group: '', kind: 'Pod', version: 'v1' })];
        should(resourceMeta).be.an.Object();
        should(resourceMeta.definitionId).be.equal("io.k8s.api.core.v1.Pod");
        should(resourceMeta.namespaced).be.a.Boolean().and.True();
    }

    {
        const resourceMeta = jsonSchema.resources[_.stableStringify({ group: '', kind: 'Service', version: 'v1' })];
        should(resourceMeta).be.an.Object();
        should(resourceMeta.definitionId).be.equal("io.k8s.api.core.v1.Service");
        should(resourceMeta.namespaced).be.a.Boolean().and.True();
    }

    {
        const resourceMeta = jsonSchema.resources[_.stableStringify({ group: 'apps', kind: 'Deployment', version: 'v1' })];
        should(resourceMeta).be.an.Object();
        should(resourceMeta.definitionId).be.equal("io.k8s.api.apps.v1.Deployment");
        should(resourceMeta.namespaced).be.a.Boolean().and.True();
    }
    
    {
        const resourceMeta = jsonSchema.resources[_.stableStringify({ group: 'rbac.authorization.k8s.io', kind: 'ClusterRole', version: 'v1' })];
        should(resourceMeta).be.an.Object();
        should(resourceMeta.definitionId).be.equal("io.k8s.api.rbac.v1.ClusterRole");
        should(resourceMeta.namespaced).be.a.Boolean().and.False();
    }

    const podDef = jsonSchema.definitions["io.k8s.api.core.v1.Pod"];
    should(podDef).be.ok();

    should(podDef.type).be.equal("object");

    should(podDef.properties).be.ok();
    should(podDef.properties.spec).be.ok();

    if (podDef.properties.spec.allOf)
    {
        should(podDef.properties.spec.allOf).be.Array();
        should(podDef.properties.spec.allOf[0]['$ref']).be.equal("#/definitions/io.k8s.api.core.v1.PodSpec")
    }
    else
    {
        should(podDef.properties.spec['$ref']).be.equal("#/definitions/io.k8s.api.core.v1.PodSpec")
    }

}