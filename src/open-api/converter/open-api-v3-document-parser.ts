import _ from 'the-lodash';
import { ILogger } from 'the-logger';

import { BaseOpenApiDocumentParser } from './base-open-api-document-parser';
import { KubernetesOpenApiV3Response } from '../open-api-v3';
import { K8sApiJsonSchema } from './types';

export class OpenApiV3DocumentParser extends BaseOpenApiDocumentParser
{
    private _document: KubernetesOpenApiV3Response;

    constructor(logger: ILogger,
                k8sApiData : K8sApiJsonSchema,
                document: KubernetesOpenApiV3Response)
    {
        super(logger, k8sApiData, document.components.schemas)
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
                        const contentDict = methodDict.requestBody?.content;
                        if (contentDict)
                        {
                            for(const contentTypeDict of _.values(contentDict))
                            {
                                const schemaDict = contentTypeDict.schema;
                                if (schemaDict)
                                {
                                    const reference = schemaDict['$ref'];
                                    if (reference)
                                    {
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

}
