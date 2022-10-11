import { K8sOpenApiPathExtension } from "./types";
import { OpenApiV3SchemaObject } from './open-api-v3-types';

export interface KubernetesOpenApiV2Root
{
    swagger: string;
    info: {
        title: string;
        version: string;
    },
    paths: {
        [path: string] : {
            [method: string] : OpenApiv2PathInfo
        }
    },
    definitions: {
        [name: string] : OpenApiV3SchemaObject
    },
    securityDefinitions: {
        [name: string] : any
    },
    security: any[];
}

export interface OpenApiv2PathInfo extends K8sOpenApiPathExtension
{
    operationId: string,
    description: string,
    tags: string[],
    parameters: {
        name: string,
        in: string,
        required: boolean,
        schema: {
            ["$ref"]?: string
        }
    }[],
    responses: Record<string, any>
}