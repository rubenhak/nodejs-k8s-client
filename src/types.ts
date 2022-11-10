
export interface ApiGroupInfo
{
    id: string,

    apiVersion: string,
    apiName: string | null,
    version: string,
    kindName: string,
    pluralName: string,
    isNamespaced: boolean,
    verbs: string[],
    
    allVersions: string[],

    isEnabled: boolean,
}

export interface KubernetesObject
{
    kind: string,
    apiVersion: string,
    metadata: {
        name: string,
        namespace?: string,
        labels?: Record<string, string>,
        annotations?: Record<string, string>,
        [x : string]: any
    },
    spec?: object,
    status?: object
    data?: object,
    [x : string]: any
}

export class KubernetesError extends Error
{
    public code: number;

    constructor (message: string, code: number)
    {
        super(message)
        Error.captureStackTrace( this, this.constructor )
        this.name = 'KubernetesError'
        this.code = code
    }
}

