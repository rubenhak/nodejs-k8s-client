import _ from 'the-lodash'
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';

import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
 
import { Agent as HttpsAgent } from 'https';

import { KubernetesError } from "./types";
import { ResourceAccessor } from './resource-accessor';
import { ResourceWatch } from './resource-watch';

export interface KubernetesClientConfig {
    httpAgent? : any,
    server? : any,
    token? : any,
}

export class KubernetesClient
{
    private _logger : ILogger;
    private _config : KubernetesClientConfig;
    private _apiGroups : Record<string, any> = {};

    private _watches : Record<string, ResourceWatch> = {};

    private _rootApiVersion : string | null = null;
    
    constructor(logger : ILogger, config : KubernetesClientConfig)
    {
        this._logger = logger;
        this._config = config;
        this._apiGroups = {};

        this._watches = {};

        this._logger.info('[construct] ');
        this._logger.silly('[construct] ', this._config);
    }

    get logger() {
        return this._logger;
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
        return this.client('Ingress', 'extensions');
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

    init()
    {
        return Promise.resolve()
            .then(() => this._discoverApiVersions())
            .then(() => this);
    }

    close()
    {
        for(let watch of _.values(this._watches))
        {
            watch.stop();
        }
    }

    _discoverApiVersions()
    {
        return Promise.resolve()
            .then(() => this._discoverRootApi())
            .then(() => this._fetchApiGroup(null, this._rootApiVersion))
            .then(() => this._discoverApiGroups())
            .then(apis => {
                return Promise.parallel(apis, x => this._fetchApiGroup(x.name, x.version));
            })
            ;
    }

    _discoverRootApi()
    {
        return this.request('GET', '/api')
            .then(result => {
                this.logger.verbose("[discoverRootApi] ", result);
                this._rootApiVersion = <string> _.last(result.versions);
                this.logger.verbose("[discoverRootApi] root version: %s", this._rootApiVersion);
            })
    }

    _discoverApiGroups() : Promise<ApiInfo[]>
    {
        return this.request('GET', '/apis')
            .then(result => {
                let apis : ApiInfo[] = [];
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

    _fetchApiGroup(group, version)
    {
        let url;
        if (group) {
            url = '/apis/' + group + '/' + version;
        } else {
            url = '/api/' + version;
        }
        return this.request('GET', url)
            .then(result => {
                for(let resource of result.resources)
                {
                    let nameParts = resource.name.split('/');
                    // this.logger.info("[fetchApiGroup] nameParts.name :: ", resource.name, nameParts);
                    if (nameParts.length == 1) {
                        this.logger.silly("[fetchApiGroup] ", resource);
                        this.setupApiGroup(resource.kind, group, version, nameParts[0]);
                    }
                }
            })
    }

    setupApiGroup(kindName, apiName, apiVersion, pluralName)
    {
        if (apiName) {
            this.logger.info("[setupApiGroup] %s :: %s :: %s :: %s...", kindName, apiName, apiVersion, pluralName)
        } else {
            this.logger.info("[setupApiGroup] %s :: %s :: %s...", kindName, apiVersion, pluralName)
        }

        if (!this._apiGroups[kindName]) {
            this._apiGroups[kindName] = {
                default: null,
                apiNames: {}
            };
        }

        let client = new ResourceAccessor(this, apiName, apiVersion, pluralName, kindName, this._watches);

        let apiGroupInfo = {
            pluralName: pluralName,
            version: apiVersion,
            client: client
        };

        if (apiName) {
            this._apiGroups[kindName].apiNames[apiName] = apiGroupInfo;
        } else {
            this._apiGroups[kindName].default = apiGroupInfo;
        }
        return client;
    }

    client(kindName: string, apiName?: string)
    {
        let kindInfo = this._apiGroups[kindName];
        if (!kindInfo) {
            return null;
        }

        let apiGroupInfo;
        if (apiName) {
            apiGroupInfo = kindInfo.apiNames[apiName];
        } else {
            apiGroupInfo = kindInfo.default;
        }

        if (!apiGroupInfo) {
            return null;
        }

        return apiGroupInfo.client;
    }

    request(method: AxiosRequestConfig['method'], url: string, params? : Record<string, string>, body? : Record<string, any>, useStream? : boolean)
    {
        this._logger.info('[request] %s => %s...', method, url);

        let httpAgentParams = this._config.httpAgent || {};
        let options : AxiosRequestConfig = {
            method: method,
            baseURL: this._config.server,
            url: url,
            headers: {
            },
            httpsAgent: new HttpsAgent(httpAgentParams)
        };

        if (this._config.token)
        {
            options.headers['Authorization'] = 'Bearer ' + this._config.token;
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
                return resultData;
            })
            .catch(reason => {
                let response = reason.response;
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

interface ApiInfo
{
    name: string,
    version: string
}