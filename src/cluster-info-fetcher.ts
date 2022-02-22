import _ from 'the-lodash'
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { KubernetesClient } from './client';
import { ApiGroupInfo } from './types';

import { APIGroupList, APIResourceList } from 'kubernetes-types/meta/v1';

import { apiId } from './utils';

export class ClusterInfoFetcher
{
    private logger : ILogger;
    private _client: KubernetesClient;

    private _rootApiVersion : string | null = null;
    private _apiGroups : Record<string, ApiGroupsVersions> = {};
    private _selectedApiGroups : ApiGroupInfo[] = [];
    private _enabledApiGroups : Record<string, ApiGroupInfo> = {};
    private _preferredVersions : Record<string, string> = {};

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
                    apiGroups: this._selectedApiGroups,
                    enabledApiGroups: this._enabledApiGroups,
                    preferredVersions: this._preferredVersions
                }
                return info;
            })
            ;
    }

    private _discoverRootApi()
    {
        return this._client.request<any>('GET', '/api')
            .then(result => {
                this.logger.debug("[discoverRootApi] ", result);
                const version = _.last(result.versions);
                if (!version) {
                    this.logger.error("[discoverRootApi] Failed to determine root api version", result);
                    throw new Error('Failed to determine root api version');
                    return;
                }

                this._rootApiVersion = version as string;
                this.logger.info("[discoverRootApi] root version: %s", this._rootApiVersion);
            })
    }

    private _discoverApiGroups() : Promise<K8sApiInfo[]>
    {
        return this._client.request<APIGroupList>('GET', '/apis')
            .then(result => {
                this.logger.silly("[_discoverApiGroups] ", result);
                const apis : K8sApiInfo[] = [];
                for(const groupInfo of result.groups)
                {
                    for(const versionInfo of groupInfo.versions)
                    {
                        this.logger.info("[discoverApiGroups] %s :: %s...", groupInfo.name, versionInfo.version);
                        apis.push({
                            name: groupInfo.name,
                            version: versionInfo.version
                        });
                    }

                    const preferredVersion = groupInfo.preferredVersion?.version;
                    if (preferredVersion) {
                        this.logger.verbose("[discoverApiGroups] %s preferred version => %s...", groupInfo.name, preferredVersion);
                        this._preferredVersions[groupInfo.name] = preferredVersion;
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

        return this._client.request<APIResourceList>('GET', url)
            .catch(reason => {
                this.logger.error("Error fetching api group: %s :: %s", group, version);
                if (allowError) {
                    return {
                        groupVersion: '',
                        resources: []
                    };
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
                        // EXPLANATION: This is to skip "Status" objects
                        this.logger.silly("[fetchApiGroup] ", resource);
                        this._setupApiGroup(resource.kind, group, version, nameParts[0]);
                    }
                }
            })
    }


    private _setupApiGroup(kindName: string, apiName: string | null, apiVersion: string, pluralName: string)
    {
        this.logger.info("[_setupApiGroup] apiName: %s, kindName: %s, apiVersion: %s", apiName, kindName, apiVersion);

        const id = apiId(kindName, apiName);
        const api = apiName ? `${apiName}/${apiVersion}` : apiVersion;

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

        if (!this._apiGroups[id]) {
            this._apiGroups[id] = {
                kindName: kindName,
                apiName: apiName,
                versions: []
            }
        }
        this._apiGroups[id].versions.push(apiGroupInfo);
    }


    private _finalizeApis()
    {
        // this.logger.silly("[_finalizeApis] ", this._apiGroups);
        
        for(const apiGroupVersions of _.values(this._apiGroups))
        {
            const selectedApiGroup = this._selectApiGroupVersion(apiGroupVersions);
            this._selectedApiGroups.push(selectedApiGroup);
            
            this._finalizeApi(selectedApiGroup);
        }
    }

    private _selectApiGroupVersion(apiGroupVersions: ApiGroupsVersions) : ApiGroupInfo
    {
        const preferredVersion = this._getPreferredVersion(apiGroupVersions.apiName);
        if (preferredVersion) {
            const preferredGroup = _.find(apiGroupVersions.versions, x => x.apiVersion === preferredVersion);
            if (preferredGroup) {
                return preferredGroup;
            }
        }

        const orderedVersions = _.orderBy(apiGroupVersions.versions, x => x.apiVersion);
        return _.head(orderedVersions)!;
    }

    private _getPreferredVersion(apiName: string | null)
    {
        if (apiName) {
            return this._preferredVersions[apiName];
        } else {
            return this._rootApiVersion;
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
        // if (apiGroupInfo.apiName === 'extensions' && apiGroupInfo.kindName === 'Ingress')
        // {
        //     if (this._haveApiResource('Ingress', 'networking.k8s.io'))
        //     {
        //         return true;
        //     }
        // }

        return false;
    }

    // private _haveApiResource(kindName: string, apiName?: string | null) : boolean
    // {
    //     const id = apiId(kindName, apiName);
    //     const apiGroupInfo = this._apiGroups[id];
    //     if (apiGroupInfo) {
    //         return true;
    //     }
    //     return false;
    // }
}

export interface ClusterInfo
{
    rootApiVersion : string;
    apiGroups : ApiGroupInfo[];
    enabledApiGroups : Record<string, ApiGroupInfo>;
    preferredVersions : Record<string, string>;
}


interface K8sApiInfo
{
    name: string,
    version: string
}

interface ApiGroupsVersions
{
    apiName: string | null,
    kindName: string,

    versions: ApiGroupInfo[],
}