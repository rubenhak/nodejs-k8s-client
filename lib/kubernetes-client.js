const _ = require('the-lodash');
const Promise = require('the-promise');
const fs = require('fs');
const axios = require('axios');
const https = require('https');

const ResourceAccessor = require('./resource-accessor');

class KubernetesClient
{
    constructor(logger, config)
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
        for(var watch of _.values(this._watches))
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
                this._rootApiVersion = _.last(result.versions);
                this.logger.verbose("[discoverRootApi] root version: %s", this._rootApiVersion);
            })
    }

    _discoverApiGroups()
    {
        return this.request('GET', '/apis')
            .then(result => {
                var apis = [];
                for(var groupInfo of result.groups)
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
        var url;
        if (group) {
            url = '/apis/' + group + '/' + version;
        } else {
            url = '/api/' + version;
        }
        return this.request('GET', url)
            .then(result => {
                for(var resource of result.resources)
                {
                    var nameParts = resource.name.split('/');
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

        var client = new ResourceAccessor(this, apiName, apiVersion, pluralName, kindName);

        var apiGroupInfo = {
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

    client(kindName, apiName)
    {
        var kindInfo = this._apiGroups[kindName];
        if (!kindInfo) {
            return null;
        }

        var apiGroupInfo;
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

    request(method, url, params, body, useStream)
    {
        this._logger.info('[request] %s => %s...', method, url);

        var httpAgentParams = this._config.httpAgent || {};
        var options = {
            method: method,
            baseURL: this._config.server,
            url: url,
            headers: {
            },
            httpsAgent: new https.Agent(httpAgentParams)
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
        return axios(options)
            .then(result => {
                this._logger.silly('[request] RAW RESULT:', result);

                if (useStream) {
                    return result;
                }

                result = result.data;
                if (!result) {
                    throw new Error("No result");
                }
                if (result.kind == "Status") {
                    if (result.status == "Failure") {
                        throw new KubernetesError(result.message, result.code);
                    }
                }
                return result;
            })
            .catch(reason => {
                var response = reason.response;
                var status = 0;
                var statusText = 0;
                if (response) {
                    status = response.status;
                    statusText = response.statusText;

                    this._logger.warn('[request] Failed. Method: %s. StatusCode: %s-%s. ',
                        method,
                        status,
                        statusText);
                } else {
                    statusText = reason;

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
                    statusText: statusText
                };
            });
    }

    static connectFromPod(logger)
    {
        var k8sConfig = {
            server: 'https://' + process.env.KUBERNETES_SERVICE_HOST + ':' + process.env.KUBERNETES_SERVICE_PORT_HTTPS,
            token: fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8'),
            caData: fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt', 'utf8')
        };
        var client = new KubernetesClient(logger, k8sConfig);
        return client;
    }
}

class KubernetesError extends Error
{
    constructor (message, code)
    {
        super(message)
        Error.captureStackTrace( this, this.constructor )
        this.name = 'KubernetesError'
        this.code = code
    }
}


module.exports = KubernetesClient;
