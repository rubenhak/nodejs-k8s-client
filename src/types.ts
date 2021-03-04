
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
