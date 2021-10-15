import _ from 'the-lodash'
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { KubernetesClient } from './client';
import { ApiGroupInfo } from './types';

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
            .then(() => this._fetchApiGroup(null, this._rootApiVersion!, false))
            .then(() => this._discoverApiGroups())
            .then(apis => {
                return Promise.parallel(apis, x => this._fetchApiGroup(x.name, x.version, true));
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
                const apis : K8sApiInfo[] = [];
                for(const groupInfo of result.groups)
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


    private _fetchApiGroup(group: string | null, version: string, allowError: boolean)
    {
        this.logger.info("[_fetchApiGroup] group: %s, version: %s", group, version);

        let url;
        if (group) {
            url = `/apis/${group}/${version}`;
        } else {
            url = `/api/${version}`;

        }
        return this._client.request('GET', url)
            .catch(reason => {
                this.logger.error("Error fetching api group: %s :: %s", group, version);
                if (allowError) {
                    return {};
                }
                throw reason;
            })
            .then(result => {
                if (!result?.resources) {
                    return;
                }

                for(const resource of result.resources)
                {
                    const nameParts = resource.name.split('/');
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
        const api = apiName ? `${apiName}/${apiVersion}` : apiVersion;
        const id = apiId(kindName, apiName);

        this.logger.silly("[_setupApiGroup] %s => %s. Kind: %s...", id, api, pluralName)

        const apiGroupInfo : ApiGroupInfo = {
            id: id,
            api: api,
            apiName: apiName,
            apiVersion: apiVersion,
            kindName: kindName,
            pluralName: pluralName,
            isEnabled: true
        };

        this.logger.silly("[_setupApiGroup] %s => ", id, apiGroupInfo)

        this._apiGroups[id] = apiGroupInfo;
    }


    private _finalizeApis()
    {
        for(const apiGroupInfo of _.values(this._apiGroups))
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
        const apiGroupInfo = this._apiGroups[id];
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


interface K8sApiInfo
{
    name: string,
    version: string
}