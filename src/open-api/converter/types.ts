import { SchemaObject } from 'ajv';

export interface K8sApiJsonSchema 
{
    resources: Record<string, string>
    definitions: Record<string, SchemaObject>
}
