import { SchemaObject } from 'ajv';

export interface K8sApiJsonSchema 
{
    resources: Record<string, K8sApiResourceInfo>
    definitions: Record<string, SchemaObject>
}

export interface K8sApiResourceInfo
{
    definitionId: string;
    namespaced: boolean;
}
