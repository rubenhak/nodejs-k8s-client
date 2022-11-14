import _ from 'the-lodash'
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { v4 as uuidv4 } from 'uuid';

import axios, { AxiosRequestConfig, AxiosResponse, Method as AxiosMethod, ResponseType as AxiosResponseType  } from 'axios';
 
import { Agent as HttpsAgent, AgentOptions as HttpsAgentOptions} from 'https';

import { ApiGroupInfo, KubernetesError } from "./types";
import { ResourceAccessor } from './resource-accessor';

import { ClusterInfo, ClusterInfoFetcher } from './cluster-info-fetcher';
import { ClusterInfoWatch } from './cluster-info-watch';

import { KubernetesOpenApiClient } from './open-api/open-api-client';

import { apiId, ApiResourceKey, apiVersionId } from './utils';

export interface KubernetesClientConfig {
    httpAgent? : HttpsAgentOptions,
    server? : string,
    token? : string,
}

export type ClusterInfoWatchCallback = (isPresent: boolean, apiGroup: ApiGroupInfo, client?: ResourceAccessor) => any;

import SyncAbout from './vendor/syncingabout';
import { HttpRequestOptions } from './internal_types';

let RPCSyncClient : any = null;

export class KubernetesClient
{
    private _logger : ILogger;
    private _config : KubernetesClientConfig;

    private _isClosed: boolean = false;

    private _clusterInfo : ClusterInfo = {
        rootApiVersion : "",
        apiGroups : [],
        enabledApiGroups : {},
        preferredVersions : {}
    };
    private _enabledApiGroups : Record<string, ApiGroupInfo> = {};
    private _preferredApiVersions : Record<string, string> = {};

    private _resources: Record<string, ResourceAccessor> = {};

    private _clusterInfoWatches : Record<string, ClusterInfoWatch> = {};

    private _clusterInfoRefreshDelay: number | undefined;
    private _clusterInfoRefreshTimer: NodeJS.Timeout | null = null;

    private _openApi: KubernetesOpenApiClient;
    
    constructor(logger : ILogger, config : KubernetesClientConfig)
    {
        this._logger = logger;
        this._config = config;

        this._logger.info('[construct] ');
        this._logger.silly('[construct] ', this._config);

        this._openApi = new KubernetesOpenApiClient(this);
    }

    get logger() {
        return this._logger;
    }

    get clusterInfo() {
        return this._clusterInfo;
    }

    get openAPI() {
        return this._openApi;
    }

    get ApiGroups() : ApiGroupInfo[] {
        return _.values(this._enabledApiGroups);
    }

    get ReplicaSet() {
        return this.client('ReplicaSet', 'apps');
    }

    get Deployment() {
        return this.client('Deployment', 'apps');
    }

    get StatefulSet() {
        return this.client('StatefulSet', 'apps');
    }

    get DaemonSet() {
        return this.client('DaemonSet', 'apps');
    }

    get CustomResourceDefinition() {
        return this.client('CustomResourceDefinition', 'apiextensions.k8s.io');
    }

    get PriorityClass() {
        return this.client('PriorityClass', 'scheduling.k8s.io');
    }

    get Node() {
        return this.client('Node');
    }

    get Pod() {
        return this.client('Pod');
    }

    get Namespace() {
        return this.client('Namespace');
    }

    get ServiceAccount() {
        return this.client('ServiceAccount');
    }

    get ClusterRole() {
        return this.client('ClusterRole', 'rbac.authorization.k8s.io');
    }

    get ClusterRoleBinding() {
        return this.client('ClusterRoleBinding', 'rbac.authorization.k8s.io');
    }

    get Role() {
        return this.client('ClusterRole', 'rbac.authorization.k8s.io');
    }

    get RoleBinding() {
        return this.client('ClusterRoleBinding', 'rbac.authorization.k8s.io');
    }

    get Service() {
        return this.client('Service');
    }

    get Secret() {
        return this.client('Secret');
    }

    get ConfigMap() {
        return this.client('ConfigMap');
    }

    get LimitRange() {
        return this.client('LimitRange');
    }

    get Ingress() {
        return this.client('Ingress', 'networking.k8s.io') || this.client('Ingress', 'extensions');
    }

    get HorizontalPodAutoscaler() {
        return this.client('HorizontalPodAutoscaler', 'autoscaling');
    }

    get Job() {
        return this.client('Job', 'batch');
    }

    get CronJob() {
        return this.client('CronJob');
    }

    init() : Promise<KubernetesClient>
    {
        return this._setupClusterResources()
            .then(() => this);
    }

    close()
    {
        this.logger.info("[close]");

        this._isClosed = true;

        this._clusterInfoWatches = {};
        this._stopClusterInfoRefreshTimer();

        for(const resource of _.values(this._resources)) {
            resource.close();
        }
        this._resources = {};
    }

    watchClusterApi(cb: ClusterInfoWatchCallback, delay? : number)
    {
        this.logger.info("[watchClusterApi] ");

        const id = uuidv4();

        const watch = new ClusterInfoWatch(this._logger,
            this,
            cb);

        this._clusterInfoWatches[id] = watch;

        Promise.resolve(null)
            .then(() => {
                const apis = _.values(this._enabledApiGroups).map(x => ({
                    api: x,
                    client: this.client(x.kindName, x.apiName)!
                }))
                return Promise.serial(apis, x => {
                    return watch.notifyApi(true, x.api, x.client);
                })
            })

        this._clusterInfoRefreshDelay = delay;
        this._setupClusterInfoRefreshTimer();

        return {
            close: () => {
                delete this._clusterInfoWatches[id];

                if (_.keys(this._clusterInfoWatches).length == 0) {
                    this._stopClusterInfoRefreshTimer();
                }
            }
        }
    }

    private _setupClusterInfoRefreshTimer()
    {
        if (this._isClosed) {
            return;
        }
        if (this._clusterInfoRefreshTimer) {
            return;
        }
        if (_.keys(this._clusterInfoWatches).length == 0) {
            return;
        }

        const delay = this._clusterInfoRefreshDelay || 60 * 60 * 1000;

        this.logger.info("[_setupClusterInfoRefreshTimer] setTimeout. delay: %s", delay);
        this._clusterInfoRefreshTimer = setTimeout(() => {
            Promise.resolve(null)
                .then(() => this._refreshClusterResources())
                .then(() => {
                    this._clusterInfoRefreshTimer = null;
                    this._setupClusterInfoRefreshTimer();
                })
                .catch(reason => {
                    this.logger.error("[_setupClusterInfoRefreshTimer] ERROR: ", reason);
                })
                .then(() => null);
        }, delay)

    }

    private _stopClusterInfoRefreshTimer()
    {
        this.logger.info("[_stopClusterInfoRefreshTimer]");

        if (this._clusterInfoRefreshTimer) {
            clearTimeout(this._clusterInfoRefreshTimer!);
            this._clusterInfoRefreshTimer = null;
        }
    }

    private _refreshClusterResources()
    {
        return this._setupClusterResources()
            .then(() => {
            })
    }

    private _setupClusterResources()
    {
        return this._fetchClusterInfo()
            .then(clusterInfo => {
                return this._applyClusterInfo(clusterInfo);
            })
    }

    private _fetchClusterInfo()
    {
        const fetcher = new ClusterInfoFetcher(this.logger, this);
        return fetcher.perform();
    }

    private _groupVersions : Record<string, Record<string, ApiResourceInfo>> = {};
    private _preferredApiResourceInfos : Record<string, ApiResourceInfo> = {};

    private _applyClusterInfo(clusterInfo: ClusterInfo)
    {
        const groupVersions : Record<string, Record<string, ApiResourceInfo>> = {};
        const preferredApiResourceInfos : Record<string, ApiResourceInfo> = {};

        for(const api of _.values(clusterInfo.enabledApiGroups))
        {
            for(const version of api.allVersions)
            {
                const key : ApiResourceKey = {
                    api: api.apiName,
                    version: version,
                    kind: api.kindName
                }
                const resourceInfo : ApiResourceInfo = {
                    key: key,
                    group: api
                };

                if (!groupVersions[api.id]) {
                    groupVersions[api.id] = {};
                }
                groupVersions[api.id][version] = resourceInfo;
            }

            {
                const key : ApiResourceKey = {
                    api: api.apiName,
                    version: api.version,
                    kind: api.kindName
                }
                preferredApiResourceInfos[api.id] = {
                    key: key,
                    group: api
                }
            }
        }
        // this.logger.error("[_applyClusterInfo] >>>>>>>> groupVersions: ", groupVersions);
        // this.logger.error("[_applyClusterInfo] >>>>>>>> preferredVersions: ", preferredApiResourceInfos);

        const toBeDeletedNotification : ApiGroupInfo[] = [];
        const toBeCreatedNotification : { api: ApiGroupInfo, client?: ResourceAccessor }[] = [];

        for(const apiId of _.keys(preferredApiResourceInfos))
        {
            const newApi = preferredApiResourceInfos[apiId];

            const currApi = this._preferredApiResourceInfos[apiId];
            if (!currApi) {
                toBeCreatedNotification.push({ api: newApi.group });
            } else {
                if (currApi.key.version !== newApi.key.version) {
                    toBeDeletedNotification.push(currApi.group);
                    toBeCreatedNotification.push({ api: newApi.group });
                }
            }
        }

        for(const apiId of _.keys(this._preferredApiResourceInfos))
        {
            const currApi = this._preferredApiResourceInfos[apiId];
            const newApi = preferredApiResourceInfos[apiId]
            if (!newApi) {
                toBeDeletedNotification.push(currApi.group);
            }
        }

        this._clusterInfo = clusterInfo;
        this._preferredApiVersions = clusterInfo.preferredVersions;
        this._enabledApiGroups = clusterInfo.enabledApiGroups;

        this._groupVersions = groupVersions;
        this._preferredApiResourceInfos = preferredApiResourceInfos;
    
        for(const apiGroup of toBeDeletedNotification)
        {
            const apiVersionsInfo = this._groupVersions[apiGroup.id];
            for(const apiVersionInfo of _.values(apiVersionsInfo))
            {
                const accessorKey = apiVersionId(apiVersionInfo.key);
                if (this._resources[accessorKey]) {
                    this._resources[accessorKey].close();
                    delete this._resources[accessorKey];
                }
            }
        }

        for(const api of toBeCreatedNotification)
        {
            api.client = this.client(api.api.kindName, api.api.apiName, api.api.version)!;
        }

        return Promise.resolve()
            .then(() => {
                return Promise.serial(toBeDeletedNotification, x => {
                    this._notifyApi(false, x)
                })
            })
            .then(() => {
                return Promise.serial(toBeCreatedNotification, x => {
                    this._notifyApi(true, x.api, x.client!)
                })
            })
    }

    private _notifyApi(isPresent: boolean, apiGroup: ApiGroupInfo, client?: ResourceAccessor)
    {
        return Promise.serial(_.values(this._clusterInfoWatches), x => {
            return x.notifyApi(isPresent, apiGroup, client);
        })
    }
    
    client(kindName: string, apiName?: string | null, version?: string) : ResourceAccessor | null
    {
        const apiKey = apiId(kindName, apiName ?? null);

        const apiGroupInfo = this._clusterInfo?.enabledApiGroups[apiKey];
        if (!apiGroupInfo) {
            return null;
        }

        if (!version) {
            version = apiGroupInfo.version;
        }

        const apiVersionInfo = this._groupVersions[apiKey];
        if (!apiVersionInfo) {
            return null;
        }

        const specificVersionInfo = apiVersionInfo[version];
        if (!specificVersionInfo) {
            return null;
        }

        const accessorKey = apiVersionId(specificVersionInfo.key);
        if (!this._resources[accessorKey]) {
            this._resources[accessorKey] = new ResourceAccessor(this,
                apiGroupInfo.apiName,
                apiGroupInfo.version,
                apiGroupInfo.pluralName,
                apiGroupInfo.kindName);
        }
        
        // this.logger.info("[client] GET CLIENT: ", specificVersionInfo.key)

        return this._resources[accessorKey];
    }

    request<T = any>(method: AxiosMethod, url: string, params? : Record<string, any>, body? : Record<string, any> | null, useStream? : boolean) : Promise<T>
    {
        this._logger.debug('[request] %s => %s...', method, url);
        this.logger.debug("[request] -> %s", url);

        const options = this._makeAxiosOptions(method, url, params, body, useStream);

        const axiosRequest : AxiosRequestConfig = {
            method: options.method,
            baseURL: options.baseURL,
            url: options.url,
            headers: options.headers,
            httpsAgent: options.httpsAgentOptions ? new HttpsAgent(options.httpsAgentOptions) : undefined,
            params: options.params,
            data: options.data,
            responseType: options.responseType as AxiosResponseType,
        }

        this._logger.silly('[request] Begin', options);
        return Promise.resolve()
            .then(() => axios(axiosRequest))
            .then(result => {
                this._logger.silly('[request] RAW RESULT:', result);

                if (useStream) {
                    return result;
                }

                return this._handleAxiosResponse(result);
            })
            .catch(reason => {
                return this._handleAxiosError(reason, options);
            });
    }

    requestSync<T = any>(method: AxiosMethod, url: string, params? : Record<string, any>, body? : Record<string, any> | null) : T
    {
        this._logger.debug('[requestSync] %s => %s...', method, url);
        this.logger.debug("[requestSync] -> %s", url);

        const options = this._makeAxiosOptions(method, url, params, body, false);

        this._logger.silly('[requestSync] Begin', options);

        console.log("***** requestSync");

        if (!RPCSyncClient) {
            RPCSyncClient = SyncAbout('./client-sync/method.mjs');
        }

        const result : {
            success: boolean,
            response?: AxiosResponse<any>,
            reason?: any
        } = RPCSyncClient(options);

        // throw new Error("ZZZZZ")

        this._logger.silly('[requestSync] RAW RESULT:', result);

        if (result.success)
        {
            return this._handleAxiosResponse(result.response!);
        }
        else
        {
            return this._handleAxiosError(result.reason, options);
        }
    }

    private _makeAxiosOptions(method: AxiosMethod, url: string, params? : Record<string, any>, body? : Record<string, any> | null, useStream? : boolean) : HttpRequestOptions
    {
        const httpAgentParams = this._config.httpAgent || {};
        const options : HttpRequestOptions = {
            method: method,
            baseURL: this._config.server,
            url: url,
            headers: {},
            httpsAgentOptions: httpAgentParams
        };

        if (this._config.token)
        {
            options.headers['Authorization'] = `Bearer ${this._config.token}`;
        }

        if (params) {
            options.params = params;
        }
        if (body) {
            options.data = body;
        }
        if (useStream) {
            options.responseType = 'stream';
        }
        return options;
    }

    private _handleAxiosResponse<T = any>(result: AxiosResponse<any>) : T
    {
        this._logger.silly('[request] RAW RESULT:', result);

        const resultData = result.data;
        if (!resultData) {
            throw new Error("No result");
        }
        if (resultData.kind == "Status") {
            if (resultData.status == "Failure") {
                throw new KubernetesError(resultData.message, resultData.code);
            }
        }
        return <T>resultData;
    }

    private _handleAxiosError(reason: any, options : HttpRequestOptions)
    {
        const response = reason.response;
        let status = 0;
        let errorMessage = '';
        if (response) {
            status = response.status;
            errorMessage = response.statusText;

            this._logger.warn('[request] Failed. Method: %s. StatusCode: %s-%s. ',
                options.method,
                status,
                errorMessage);
        } else {
            errorMessage = reason.message;

            this._logger.warn('[request] Failed. Method: %s. Connection Error: ',
            options.method,
                reason);
        }

        if (options.method === 'GET') {
            if (status == 404) {
                return null;
            }
        }

        if (options.method == 'DELETE') {
            if (status == 404) {
                return reason;
            }
        }

        if (response) {
            if (response.data) {
                if (response.data.kind == "Status") {
                    if (response.data.status == "Failure") {
                        throw new KubernetesError(reason.response.data.message, reason.response.data.code);
                    }
                }
            }
        }

        throw {
            status: status,
            message: errorMessage,
            method: options.method,
            baseURL: options.baseURL,
            url: options.url
        };
    }
}


export interface ApiResourceInfo
{
    key: ApiResourceKey,
    group: ApiGroupInfo
}


