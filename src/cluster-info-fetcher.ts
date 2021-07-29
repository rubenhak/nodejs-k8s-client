import _ from 'the-lodash'
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { KubernetesClient } from './client';

import { apiId } from './utils';

export class ClusterInfoFetcher
{
    private logger : ILogger;
    private _client: KubernetesClient;

    private _rootApiVersion : string | null = null;
    private _apiGroups : Record<string, ApiGroupInfo> = {};
    private _enabledApiGroups : Record<string, ApiGroupInfo> = {};

    constructor(logger : ILogger, client: KubernetesClient)
    {
        this.logger = logger;
        this._client = client;
    }

    perform() : Promise<ClusterInfo>
    {
        return Promise.resolve()
            .then(() => this._discoverRootApi())
            .then(() => this._fetchApiGroup(null, this._rootApiVersion!))
            .then(() => this._discoverApiGroups())
            .then(apis => {
                return Promise.parallel(apis, x => this._fetchApiGroup(x.name, x.version));
            })
            .then(() => this._finalizeApis())
            .then(() => {
                const info : ClusterInfo = {
                    rootApiVersion: this._rootApiVersion!,
                    apiGroups: this._apiGroups,
                    enabledApiGroups: this._enabledApiGroups
                }
                return info;
            })
            ;
    }

    private _discoverRootApi()
    {
        return this._client.request('GET', '/api')
            .then(result => {
                this.logger.debug("[discoverRootApi] ", result);
                this._rootApiVersion = <string> _.last(result.versions);
                this.logger.info("[discoverRootApi] root version: %s", this._rootApiVersion);
            })
    }

    private _discoverApiGroups() : Promise<K8sApiInfo[]>
    {
        return this._client.request<any>('GET', '/apis')
            .then(result => {
                let apis : K8sApiInfo[] = [];
                for(let groupInfo of result.groups)
                {
                    if (groupInfo.preferredVersion.version) {
                        this.logger.verbose("[discoverApiGroups] %s :: %s...", groupInfo.name, groupInfo.preferredVersion.version);
                        apis.push({
                            name: groupInfo.name,
                            version: groupInfo.preferredVersion.version
                        });
                    }
                }
                return apis;
            })
    }


    private _fetchApiGroup(group: string | null, version: string)
    {
        let url;
        if (group) {
            url = `/apis/${group}/${version}`;
        } else {
            url = `/api/${version}`;

        }
        return this._client.request('GET', url)
            .then(result => {
                for(let resource of result.resources)
                {
                    let nameParts = resource.name.split('/');
                    // this.logger.info("[fetchApiGroup] nameParts.name :: ", resource.name, nameParts);
                    if (nameParts.length == 1) {
                        this.logger.silly("[fetchApiGroup] ", resource);
                        this._setupApiGroup(resource.kind, group, version, nameParts[0]);
                    }
                }
            })
    }


    private _setupApiGroup(kindName: string, apiName: string | null, apiVersion: string, pluralName: string)
    {
        const id = apiId(kindName, apiName);

        this.logger.silly("[_setupApiGroup] %s :: %s :: %s...", id, apiVersion, pluralName)

        let apiGroupInfo : ApiGroupInfo = {
            id: id,
            apiName: apiName,
            apiVersion: apiVersion,
            kindName: kindName,
            pluralName: pluralName,
            isEnabled: true
        };

        this._apiGroups[id] = apiGroupInfo;
    }


    private _finalizeApis()
    {
        for(let apiGroupInfo of _.values(this._apiGroups))
        {
            this._finalizeApi(apiGroupInfo);
        }
    }

    private _finalizeApi(apiGroupInfo : ApiGroupInfo)
    {
        if (this._isApiDisabled(apiGroupInfo)) {
            this.logger.info("[_finalizeApi] Skipping. Resource: %s", apiGroupInfo.id)
            apiGroupInfo.isEnabled = false;
            return;
        }

        this.logger.debug("[_finalizeApi] Setup. Resource: %s :: %s...", apiGroupInfo.id, apiGroupInfo.apiVersion)
        this._enabledApiGroups[apiGroupInfo.id] = apiGroupInfo;
    }

    private _isApiDisabled(apiGroupInfo : ApiGroupInfo) : boolean
    {
        if (apiGroupInfo.apiName === 'extensions' && apiGroupInfo.kindName === 'Ingress')
        {
            if (this._haveApiResource('Ingress', 'networking.k8s.io'))
            {
                return true;
            }
        }

        return false;
    }

    private _haveApiResource(kindName: string, apiName?: string | null) : boolean
    {
        const id = apiId(kindName, apiName);
        let apiGroupInfo = this._apiGroups[id];
        if (apiGroupInfo) {
            return true;
        }
        return false;
    }
}

export interface ClusterInfo
{
    rootApiVersion : string;
    apiGroups : Record<string, ApiGroupInfo>;
    enabledApiGroups : Record<string, ApiGroupInfo>;
}


export interface K8sApiInfo
{
    name: string,
    version: string
}

export interface ApiGroupInfo
{
    id: string,

    apiName: string | null,
    apiVersion: string,
    kindName: string,
    pluralName: string,

    isEnabled: boolean,
}