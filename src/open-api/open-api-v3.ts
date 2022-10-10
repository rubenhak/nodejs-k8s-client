import { K8sOpenApiPathExtension, OpenApiDefinition } from "./types";

export interface KubernetesOpenApiV3Root
{
    paths: Record<string, { serverRelativeURL: string } >;
}

export interface KubernetesOpenApiV3Response
{
    openapi: string;
    info: {
        title: string;
        version: string;
    },
    paths: {
        [path: string] : {
            [method: string] : OpenApiv3PathInfo
        }
    },
    components: {
        schemas?: {
            [name: string] : OpenApiDefinition
        },
        securitySchemes: {
            [name: string] : any
        }
    }
}

export interface OpenApiv3PathInfo extends K8sOpenApiPathExtension
{
    operationId: string,
    description: string,
    tags: string[],
    parameters: {
        name: string,
        in: string,
        required: boolean,
        schema: any
    }[],
    requestBody?: {
        content?: {
            [type: string]: { // "*/*"
                schema: {
                    ["$ref"]?: string
                }
            }
        }
    },
    responses: Record<string, any>,
}