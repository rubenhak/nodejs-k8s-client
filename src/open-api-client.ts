import _ from 'the-lodash';
import { Promise } from "the-promise";
import { KubernetesClient } from "./client";


export class KubernetesOpenApiClient
{
    private _client: KubernetesClient;
    
    constructor(client: KubernetesClient)
    {
        this._client = client;
    }

    queryRootPaths()
    {
        return this._client.request<KubernetesOpenApiRoot>('GET', '/openapi/v3');
    }

    queryClusterVersion()
    {
        return this.queryRootPaths()
            .then(result => {

                const apiPath = result.paths['api'];

                return this._client.request<KubernetesOpenApiResponse>('GET', apiPath.serverRelativeURL)
                    .then(pathResult => {
                        return pathResult.info.version;
                    });
            })
    }

    queryAllPaths()
    {
        const pathData : Record<string, KubernetesOpenApiResponse> = {}

        return this.queryRootPaths()
            .then(result => {


                return Promise.execute(_.keys(result.paths), pathName => {

                    return this._client.request<KubernetesOpenApiResponse>('GET', result.paths[pathName].serverRelativeURL)
                        .then(pathResult => {

                            pathData[pathName] = pathResult

                        });

                }, {
                    concurrency: 10
                })

            })
            .then(() => pathData)
    }

    
}

export interface KubernetesOpenApiRoot
{
    paths: Record<string, { serverRelativeURL: string } >;
}



export interface KubernetesOpenApiResponse
{
    openapi: string;
    info: {
        title: string;
        version: string;
    },
    paths: {
        [path: string] : {
            [method: string] : any
        }
    },
    components: {
        schemas?: {
            [name: string] : any
        },
        securitySchemes: {
            [name: string] : any
        }
    }
}