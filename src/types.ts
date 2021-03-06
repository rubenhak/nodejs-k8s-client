export interface KubernetesObject
{
    kind: string,
    apiVersion: string,
    metadata: {
        name: string,
        namespace?: string,
        labels?: Record<string, string>,
        annotations?: Record<string, string>
    },
    spec: object,
    status?: object
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

