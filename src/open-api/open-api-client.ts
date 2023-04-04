import _ from 'the-lodash';
import { MyPromise } from "the-promise";
import { KubernetesClient } from "../client";

import { KubernetesVersionInfoRaw, KubernetesVersionInfo, K8sOpenApiSpecs } from "./types";
import { KubernetesOpenApiV3Response, KubernetesOpenApiV3Root } from './open-api-v3';
import { KubernetesOpenApiV2Root } from './open-api-v2';

export class KubernetesOpenApiClient
{
    private _client: KubernetesClient;
    
    constructor(client: KubernetesClient)
    {
        this._client = client;
    }

    queryClusterVersionInfo()
    {
        return this._client.request<KubernetesVersionInfoRaw>('GET', '/version')
            .then(result => {

                const version : KubernetesVersionInfo = {
                    major: parseInt(result.major),
                    minor: parseInt(result.minor),
                    gitVersion: result.gitVersion,
                    gitCommit: result.gitCommit,
                    gitTreeState: result.gitTreeState,
                    buildDate: new Date(result.buildDate),
                    goVersion: result.goVersion,
                    compiler: result.compiler,
                    platform: result.platform,
                }
                
                return version;
            })
    }

    queryClusterVersion()
    {
        return this.queryClusterVersionInfo().then(x => x.gitVersion);
    }

    queryV3RootPaths()
    {
        return this._client.request<KubernetesOpenApiV3Root>('GET', '/openapi/v3');
    }

    queryV3AllPaths()
    {
        const pathData : Record<string, KubernetesOpenApiV3Response> = {}

        return this.queryV3RootPaths()
            .then(result => {

                return MyPromise.execute(_.keys(result.paths), pathName => {

                    return this._client.request<KubernetesOpenApiV3Response>('GET', result.paths[pathName].serverRelativeURL)
                        .then(pathResult => {

                            pathData[pathName] = pathResult

                        });

                }, {
                    concurrency: 10
                })

            })
            .then(() => pathData)
    }

    queryV2Root()
    {
        return this._client.request<KubernetesOpenApiV2Root>('GET', '/openapi/v2');
    }

    queryApiSpecs(options?: QueryApiSpecsOptions) : Promise<K8sOpenApiSpecs>
    {
        options = options || {};

        if (options.forceApiV2 && options.forceApiV3) {
            throw new Error("Cannot use forceApiV2 and forceApiV3 at the same time.");
        }

        return this.queryClusterVersion()
            .then(version => {

                if (options!.forceApiV3) {
                    return this._queryApiSpecsV3(version);
                }
                if (options!.forceApiV2) {
                    return this._queryApiSpecsV2(version);
                }

                return this.queryV3RootPaths()
                    .then(() => {
                        return this._queryApiSpecsV3(version);
                    })
                    .catch(() => {
                        return this._queryApiSpecsV2(version);
                    });
                
            })
    }

    private _queryApiSpecsV3(k8sVersion: string) : Promise<K8sOpenApiSpecs>
    {
        return this.queryV3AllPaths()
            .then(result => {

                const spec : K8sOpenApiSpecs = {
                    k8sVersion: k8sVersion,
                    openApiVersion: '3.0',
                    openApiV3Data: result
                };
                return spec;
            });
    }

    private _queryApiSpecsV2(k8sVersion: string) : Promise<K8sOpenApiSpecs>
    {
        return this.queryV2Root()
            .then(result => {

                const spec : K8sOpenApiSpecs = {
                    k8sVersion: k8sVersion,
                    openApiVersion: '2.0',
                    openApiV2Data: result
                };
                return spec;

            });
    }
    
}

export interface QueryApiSpecsOptions
{
    forceApiV2?: boolean;
    forceApiV3?: boolean;
}