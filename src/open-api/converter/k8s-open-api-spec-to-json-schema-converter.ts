import _ from 'the-lodash';
import { ILogger } from 'the-logger';

import { KubernetesOpenApiV3Response } from '../open-api-v3';
import { KubernetesOpenApiV2Root } from '../open-api-v2';
import { K8sOpenApiSpecs } from '../types';

import { K8sApiJsonSchema } from './types';
import { OpenApiV3DocumentParser } from './open-api-v3-document-parser';
import { OpenApiV2DocumentParser } from './open-api-v2-document-parser';


export class K8sOpenApiSpecToJsonSchemaConverter
{
    private _logger : ILogger;
    private _openApiData: K8sOpenApiSpecs;

    private _k8sApiData : K8sApiJsonSchema = {
        resources: {},
        definitions: {}
    };

    constructor(logger: ILogger, openApiData: K8sOpenApiSpecs)
    {
        this._logger = logger;
        this._openApiData = openApiData;
    }

    convert() : K8sApiJsonSchema
    {
        this._k8sApiData.definitions = {};

        if (this._openApiData.openApiV3Data)
        {
            this._convertOpenApiV3();
        }

        if (this._openApiData.openApiV2Data)
        {
            this._convertOpenApiV2(this._openApiData.openApiV2Data);
        }

        // this._logger.info("ALL RESOURCES: ", this._k8sApiData.resources);
        // this._logger.info("ALL TYPES: ", _.keys(this._k8sApiData.definitions));

        return this._k8sApiData;
    }

    private _convertOpenApiV3()
    {
        for(const apiName of _.keys(this._openApiData.openApiV3Data))
        {
            const document = this._openApiData.openApiV3Data![apiName];
            this._convertOpenApiV3Document(document);
        }
    }

    private _convertOpenApiV3Document(document: KubernetesOpenApiV3Response)
    {
        const documentParser = new OpenApiV3DocumentParser(this._logger, this._k8sApiData, document);
        documentParser.convert();
    }

    private _convertOpenApiV2(document: KubernetesOpenApiV2Root)
    {
        const documentParser = new OpenApiV2DocumentParser(this._logger, this._k8sApiData, document);
        documentParser.convert();
    }

}

