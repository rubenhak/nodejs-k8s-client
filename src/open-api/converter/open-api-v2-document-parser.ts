import _ from 'the-lodash';
import { ILogger } from 'the-logger';

import { BaseOpenApiDocumentParser } from './base-open-api-document-parser';
import { KubernetesOpenApiV2Root } from '../open-api-v2';
import { K8sApiJsonSchema } from './types';

export class OpenApiV2DocumentParser extends BaseOpenApiDocumentParser
{
    private _document: KubernetesOpenApiV2Root;

    constructor(logger: ILogger,
                k8sApiData : K8sApiJsonSchema,
                document: KubernetesOpenApiV2Root)
    {
        super(logger, k8sApiData, document.definitions)
        this._document = document;
    }

    convert()
    {
        for(const path of _.keys(this._document.paths))
        {
            const pathDict = this._document.paths[path];
            const methodDict = pathDict['post'];
            if (methodDict)
            {
                if (methodDict['x-kubernetes-action'] === 'post')
                {
                    const apiResource = methodDict['x-kubernetes-group-version-kind'];
                    if (apiResource)
                    {
                        if (methodDict.parameters)
                        {
                            const bodyParameter = _.find(methodDict.parameters, x => x.name === 'body');
                            if (bodyParameter)
                            {
                                const reference = bodyParameter.schema['$ref'];
                                if (reference) {
                                    this._convertApiResource(path, apiResource, reference);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

}
