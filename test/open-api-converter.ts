import { setupLogger, LoggerOptions } from 'the-logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { K8sOpenApiSpecs, K8sOpenApiSpecToJsonSchemaConverter } from '../src';
import { OpenApiV3SchemaObject } from '../src/open-api/open-api-v3-types';

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true);
const logger = setupLogger('test', loggerOptions);


describe('open-api-converter', function() {

    it('convert-preserve-unknown-01', function () {

        const crdSchema: OpenApiV3SchemaObject = {
            "type": "object",
            "required": [
                "spec"
            ],
            "properties": {
                "apiVersion": {
                    "type": "string"
                },
                "kind": {
                    "type": "string"
                },
                "spec": {
                    "type": "object",
                    "required": [
                        "target",
                        "rule"
                    ],
                    "properties": {
                        "disabled": {
                            "type": "boolean"
                        },
                        "rule": {
                            "type": "string"
                        },
                        "target": {
                            "type": "string"
                        },
                        "values": {
                            "type": "object",
                            "x-kubernetes-preserve-unknown-fields": true
                        }
                    }
                }
            }
        };

        const openApiData: K8sOpenApiSpecs = {
            k8sVersion: 'v1.25',
            openApiVersion: 'v3',
            openApiV3Data: {
                
                "apis/kubevious.io/v1alpha1": {
                    openapi: 'v3',
                    info: {
                        title: 'k8s',
                        version: 'v3',
                    },
                    paths: {
                        "/apis/kubevious.io/v1alpha1/namespaces/{namespace}/rules": {
                            "post": {
                                "tags": [
                                    "kubeviousIo_v1alpha1"
                                ],
                                "description": "create a Rule",
                                "operationId": "createKubeviousIoV1alpha1NamespacedRule",
                                "parameters": [
                                ],
                                "requestBody": {
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "$ref": "#/components/schemas/io.kubevious.v1alpha1.Rule"
                                            }
                                        },
                                        "application/yaml": {
                                            "schema": {
                                                "$ref": "#/components/schemas/io.kubevious.v1alpha1.Rule"
                                            }
                                        }
                                    }
                                },
                                "responses": {
                                },
                                "x-kubernetes-action": "post",
                                "x-kubernetes-group-version-kind": {
                                    "group": "kubevious.io",
                                    "version": "v1alpha1",
                                    "kind": "Rule"
                                }
                            },
                        }
                    },
                    components: {
                        schemas: {
                            "io.kubevious.v1alpha1.Rule": crdSchema
                        },
                        securitySchemes: {}
                    }
                }
            }
        }

        const converter = new K8sOpenApiSpecToJsonSchemaConverter(logger, openApiData);
        const schema = converter.convert();

        logger.info("JSON SCHEMA: ", schema);

        const convertedDef = schema.definitions['io.kubevious.v1alpha1.Rule'];
        should(convertedDef).be.ok();
        logger.info("CONVERTED DEF: ", convertedDef);

        should(convertedDef.properties['spec'].properties['values'].additionalProperties).be.True();


    })
    ;

    
});
