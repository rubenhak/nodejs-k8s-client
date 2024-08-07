import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { SchemaObject } from 'ajv';

import { K8sApiJsonSchema, K8sApiResourceInfo } from './types';

import { OpenApiV3SchemaObject } from '../open-api-v3-types';
import { K8sOpenApiResource } from '../types';

export class BaseOpenApiDocumentParser
{
    protected _logger : ILogger;
    private _documentSchemas : Record<string, OpenApiV3SchemaObject>;
    private _k8sApiData : K8sApiJsonSchema;

    private _convertedTargetRefs : Record<string, boolean> = {};

    constructor(logger: ILogger,
                k8sApiData : K8sApiJsonSchema,
                documentSchemas? : Record<string, OpenApiV3SchemaObject>)
    {
        this._logger = logger;
        this._k8sApiData = k8sApiData;
        this._documentSchemas = documentSchemas ?? {};
    }

    protected _convertApiResource(path: string, apiResource: K8sOpenApiResource, resourceRef: string)
    {
        this._logger.debug("[_convertApiResource] ApiResource-V3: %s", path);
        this._logger.silly("[_convertApiResource] ApiResource-V3: %s => %s ::", path, resourceRef, apiResource);

        const isNamespaced = _.includes(path, 'namespaces/{namespace}');
        this._convertReference(resourceRef);
        
        const resourceInfo : K8sApiResourceInfo = {
            definitionId: this._getResourceKeyFromRef(resourceRef),
            namespaced: isNamespaced
        }
        this._k8sApiData.resources[_.stableStringify(apiResource)] = resourceInfo;
    }

    private _convertReference(origRef: string) : string
    {
        // this._logger.silly("[_convertReference] %s", origRef);

        const targetRef = this._convertRef(origRef);
        if (this._convertedTargetRefs[targetRef]) {
            return targetRef;
        }
        this._convertedTargetRefs[targetRef] = true;

        const resourceKey = this._getResourceKeyFromRef(origRef);

        const openApiSchema = this._documentSchemas[resourceKey];
        if (!openApiSchema) {
            this._logger.error("[_convertOpenApiV3Document] Missing %s", resourceKey);
            throw new Error(`Missing reference: ${origRef}`);
        }

        const schema = this._convertSchema(openApiSchema);
        this._k8sApiData.definitions[resourceKey] = schema;

        return targetRef;
    }

    private _convertSchema(openApiSchema: OpenApiV3SchemaObject) : SchemaObject
    {
        const refValue = openApiSchema['$ref'];
        if (refValue) {
            const newRef = this._convertReference(refValue);
            return {
                '$ref': newRef
            }
        }

        const customFix = this._applyCustomFix(openApiSchema);
        if (customFix) {
            return customFix;
        }

        const schema : SchemaObject = {
            type: openApiSchema.type,
            format: openApiSchema.format
        };

        if (openApiSchema.properties) {
            schema.properties = this._convertProperties(openApiSchema.properties);
        }

        if (openApiSchema.items) {
            schema.items = this._convertSchema(openApiSchema.items);
        }

        if (openApiSchema.allOf) {
            schema.allOf = this._convertArray(openApiSchema.allOf);
        }

        if (openApiSchema.oneOf) {
            schema.oneOf = this._convertArray(openApiSchema.oneOf);
        }

        if (openApiSchema.anyOf) {
            schema.anyOf = this._convertArray(openApiSchema.anyOf);
        }

        if (_.isNotNullOrUndefined(openApiSchema.default))
        {
            schema.default = openApiSchema.default;
        }

        if (_.isNotNullOrUndefined(openApiSchema.required))
        {
            schema.required = openApiSchema.required;
        }

        if (_.isNotNullOrUndefined(openApiSchema.enum))
        {
            // BUG FIX: https://github.com/kubevious/cli/issues/21
            schema.enum = _.uniq(openApiSchema.enum)
        }

        // BUG FIX: https://github.com/kubevious/cli/issues/13
        if (!schema.type)
        {
            if (schema.format)
            {
                if (!schema.allOf && !schema.oneOf && !schema.anyOf)
                {
                    schema.type = "string"
                }
            }
        }

        if (openApiSchema.type === "object")
        {
            schema.additionalProperties = false;
            if (_.isNotNullOrUndefined(openApiSchema.additionalProperties))
            {
                if (_.isBoolean(openApiSchema.additionalProperties))
                {
                    schema.additionalProperties = openApiSchema.additionalProperties;
                }
                else
                {
                    schema.additionalProperties = this._convertSchema(openApiSchema.additionalProperties as OpenApiV3SchemaObject);
                }
            }
            else
            {
                if (openApiSchema['x-kubernetes-preserve-unknown-fields'])
                {
                    schema.additionalProperties = true;
                }
                else
                {
                    if (_.isNotNullOrUndefined(openApiSchema.additionalProperties))
                    {
                        if ((openApiSchema.additionalProperties as any)['x-kubernetes-preserve-unknown-fields'])
                        {
                            // NOTE: Not the right way, but used in Traefik:
                            // https://raw.githubusercontent.com/traefik/traefik/v2.9/docs/content/reference/dynamic-configuration/kubernetes-crd-definition-v1.yml
                            schema.additionalProperties = true;
                        }
                    }
                }
            }
        }

        return schema;
    }


    private _convertProperties(properties: { [property: string]: OpenApiV3SchemaObject }) : Record<string, SchemaObject>
    {
        const converted : Record<string, SchemaObject> = {};
        for(const name of _.keys(properties))
        {
            converted[name] = this._convertSchema(properties[name]);
        }
        return converted;
    }

    private _convertArray(openApiSchemas: OpenApiV3SchemaObject[]) : SchemaObject[]
    {
        return openApiSchemas.map(x => this._convertSchema(x));
    }

    private _applyCustomFix(openApiSchema: OpenApiV3SchemaObject) : SchemaObject | null
    {
        if (openApiSchema.format === 'int-or-string')
        {
            return {
                oneOf: [
                    { type: "string" },
                    { type: "integer" }
                ]
            }
        }

        return null;
    }

    private _convertRef(origRef: string) : string
    {
        const resourceKey = this._getResourceKeyFromRef(origRef);
        return `#/definitions/${resourceKey}`;
    }

    private _getResourceKeyFromRef(origRef: string) : string
    {
        const index = origRef.lastIndexOf('/');
        return origRef.substring(index + 1);
    }
}
