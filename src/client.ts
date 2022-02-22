import _ from 'the-lodash'
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { v4 as uuidv4 } from 'uuid';

import axios, { AxiosRequestConfig } from 'axios';
 
import { Agent as HttpsAgent, AgentOptions } from 'https';

import { ApiGroupInfo, KubernetesError } from "./types";
import { ResourceAccessor } from './resource-accessor';

import { ClusterInfo, ClusterInfoFetcher } from './cluster-info-fetcher';
import { ClusterInfoWatch } from './cluster-info-watch';

import { apiId } from './utils';

export interface KubernetesClientConfig {
    httpAgent? : AgentOptions,
    server? : string,
    token? : string,
}

export type ClusterInfoWatchCallback = (isPresent: boolean, apiGroup: ApiGroupInfo, client?: ResourceAccessor) => any;

export class KubernetesClient
{
    private _logger : ILogger;
    private _config : KubernetesClientConfig;

    private _isClosed: boolean = false;

    private _clusterInfo : ClusterInfo | null = null;
    private _enabledApiGroups : Record<string, ApiGroupInfo> = {};

    private _resources: Record<string, ResourceAccessor> = {};

    private _clusterInfoWatches : Record<string, ClusterInfoWatch> = {};

    private _clusterInfoRefreshDelay: number | undefined;
    private _clusterInfoRefreshTimer: NodeJS.Timeout | null = null;
    
    constructor(logger : ILogger, config : KubernetesClientConfig)
    {
        this._logger = logger;
        this._config = config;

        this._logger.info('[construct] ');
        this._logger.silly('[construct] ', this._config);
    }

    get logger() {
        return this._logger;
    }

    get clusterInfo() {
        return this._clusterInfo;
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
            this._refreshClusterResources()
                .then(() => {
                    this._clusterInfoRefreshTimer = null;
                    this._setupClusterInfoRefreshTimer();
                })
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

    private _applyClusterInfo(clusterInfo: ClusterInfo)
    {
        const toBeDeleted : ApiGroupInfo[] = [];
        const toBeCreated : { api: ApiGroupInfo, client?: ResourceAccessor }[] = [];

        for(const api of _.values(clusterInfo.enabledApiGroups))
        {
            const currApi = this._enabledApiGroups[api.id]
            if (!currApi) {
                toBeCreated.push({ api });
            } else {
                if (currApi.apiVersion !== api.apiVersion) {
                    toBeDeleted.push(currApi);
                    toBeCreated.push({ api });
                }
            }
        }

        for(const currApi of _.values(this._enabledApiGroups))
        {
            const api = clusterInfo.enabledApiGroups[currApi.id]
            if (!api) {
                toBeDeleted.push(currApi);
            }
        }

        this._clusterInfo = clusterInfo;
        this._enabledApiGroups = clusterInfo.enabledApiGroups;

        for(const api of toBeDeleted)
        {
            const client = this._resources[api.id];
            if (client) {
                client.close();
            }
        }

        for(const api of toBeCreated)
        {
            api.client = this._setupResource(api.api);
        }

        return Promise.resolve()
            .then(() => {
                return Promise.serial(toBeDeleted, x => {
                    this._notifyApi(false, x)
                })
            })
            .then(() => {
                return Promise.serial(toBeCreated, x => {
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
    
    private _setupResource(apiGroupInfo : ApiGroupInfo) : ResourceAccessor
    {
        this.logger.info("[_setupResource] Setup. Resource: %s :: %s...", apiGroupInfo.id, apiGroupInfo.apiVersion)

        const client = new ResourceAccessor(this,
            apiGroupInfo.apiName,
            apiGroupInfo.apiVersion,
            apiGroupInfo.pluralName,
            apiGroupInfo.kindName);

        this._resources[apiGroupInfo.id] = client;

        return client;
    }

    client(kindName: string, apiName?: string | null) : ResourceAccessor | null
    {
        const id = apiId(kindName, apiName ?? null);

        this.logger.info("[client] GET CLIENT: %s", id)

        const client = this._resources[id];
        return client || null;
    }

    request<T = any>(method: AxiosRequestConfig['method'], url: string, params? : Record<string, any>, body? : Record<string, any> | null, useStream? : boolean) : Promise<T>
    {
        this._logger.debug('[request] %s => %s...', method, url);

        const httpAgentParams = this._config.httpAgent || {};
        const options : AxiosRequestConfig = {
            method: method,
            baseURL: this._config.server,
            url: url,
            headers: {},
            httpsAgent: new HttpsAgent(httpAgentParams)
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

        this.logger.debug("[request] -> %s", url);
        this._logger.silly('[request] Begin', options);
        return Promise.resolve()
            .then(() => axios(options))
            .then(result => {
                this._logger.silly('[request] RAW RESULT:', result);

                if (useStream) {
                    return result;
                }

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
            })
            .catch(reason => {
                const response = reason.response;
                let status = 0;
                let errorMessage = '';
                if (response) {
                    status = response.status;
                    errorMessage = response.statusText;

                    this._logger.warn('[request] Failed. Method: %s. StatusCode: %s-%s. ',
                        method,
                        status,
                        errorMessage);
                } else {
                    errorMessage = reason.message;

                    this._logger.warn('[request] Failed. Method: %s. Connection Error: ',
                        method,
                        reason);
                }

                if (method == 'GET') {
                    if (status == 404) {
                        return null;
                    }
                }

                if (method == 'DELETE') {
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
            });
    }
}
