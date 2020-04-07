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
        this._resourceClients = {};
        this.setupResourceClient('Pod', null, 'v1', 'pods');
        this.setupResourceClient('Node', null, 'v1', 'nodes');
        this.setupResourceClient('Namespace', null, 'v1', 'namespaces');
        this.setupResourceClient('ServiceAccount', null, 'v1', 'serviceaccounts');
        this.setupResourceClient('Service', null, 'v1', 'services');
        this.setupResourceClient('Secret', null, 'v1', 'secrets');
        this.setupResourceClient('ConfigMap', null, 'v1', 'configmaps');
        this.setupResourceClient('LimitRange', null, 'v1', 'limitranges');

        this.setupResourceClient('ClusterRole', 'rbac.authorization.k8s.io', 'v1', 'clusterroles');
        this.setupResourceClient('ClusterRoleBinding', 'rbac.authorization.k8s.io', 'v1', 'clusterrolebindings');

        this.setupResourceClient('ReplicaSet', 'apps', 'v1', 'replicasets');
        this.setupResourceClient('Deployment', 'apps', 'v1', 'deployments');
        this.setupResourceClient('DaemonSet', 'apps', 'v1', 'daemonsets');
        this.setupResourceClient('StatefulSet', 'apps', 'v1', 'statefulsets');
        this.setupResourceClient('CustomResourceDefinition', 'apiextensions.k8s.io', 'v1beta1', 'customresourcedefinitions');
        this.setupResourceClient('PriorityClass', 'scheduling.k8s.io', 'v1beta1', 'priorityclasses');

        this.setupResourceClient('Job', 'batch', 'v1', 'jobs');
        this.setupResourceClient('CronJob', 'batch', 'v1beta1', 'cronjobs');

        this.setupResourceClient('Ingress', 'extensions', 'v1beta1', 'ingresses');

        this.setupResourceClient('HorizontalPodAutoscaler', 'autoscaling', 'v2beta1', 'horizontalpodautoscalers');

        this.setupResourceClient('BerliozService', 'berlioz.cloud', 'v1', 'services');

        this.setupResourceClient('ManagedCertificate', 'networking.gke.io', 'v1beta1', 'managedcertificates');

        this._logger.info('[construct] ');
        this._logger.silly('[construct] ', this._config);

    }

    get logger() {
        return this._logger;
    }

    get ReplicaSet() {
        return this.getClient('ReplicaSet');
    }

    get Deployment() {
        return this.getClient('Deployment');
    }

    get StatefulSet() {
        return this.getClient('StatefulSet');
    }

    get DaemonSet() {
        return this.getClient('DaemonSet');
    }

    get CustomResourceDefinition() {
        return this.getClient('CustomResourceDefinition');
    }

    get PriorityClass() {
        return this.getClient('PriorityClass');
    }

    get Node() {
        return this.getClient('Node');
    }

    get Pod() {
        return this.getClient('Pod');
    }

    get Namespace() {
        return this.getClient('Namespace');
    }

    get ServiceAccount() {
        return this.getClient('ServiceAccount');
    }

    get ClusterRole() {
        return this.getClient('ClusterRole');
    }

    get ClusterRoleBinding() {
        return this.getClient('ClusterRoleBinding');
    }

    get Service() {
        return this.getClient('Service');
    }

    get Secret() {
        return this.getClient('Secret');
    }

    get ConfigMap() {
        return this.getClient('ConfigMap');
    }

    get LimitRange() {
        return this.getClient('LimitRange');
    }

    get Ingress() {
        return this.getClient('Ingress');
    }

    get HorizontalPodAutoscaler() {
        return this.getClient('HorizontalPodAutoscaler');
    }

    get BerliozService() {
        return this.getClient('BerliozService');
    }

    get ManagedCertificate() {
        return this.getClient('ManagedCertificate');
    }

    get Job() {
        return this.getClient('Job');
    }

    get CronJob() {
        return this.getClient('CronJob');
    }

    setupResourceClient(kindName, apiName, apiVersion, pluralName)
    {
        var client = new ResourceAccessor(this, apiName, apiVersion, pluralName, kindName);
        this._resourceClients[kindName] = client;
        return client;
    }

    getClient(name)
    {
        if (name in this._resourceClients) {
            return this._resourceClients[name];
        }
        throw new Error('Resource client ' + name + ' not present.');
    }

    request(method, url, params, body, useStream)
    {
        this._logger.info('[request] %s => %s...', method, url);
        var options = {
            method: method,
            baseURL: this._config.server,
            url: url,
            headers: {
                'Authorization': 'Bearer ' + this._config.token
            },
            httpsAgent: new https.Agent({
                ca: this._config.caData
            })
        };
        if (params) {
            options.params = params;
        }
        if (body) {
            options.data = body;
        }
        if (useStream) {
            options.responseType = 'stream';
            // this._logger.silly('[request] Stream Begin: ', options);
            // var result = requestOrig(options);
            // this._logger.silly('[request] Stream Result: ', result);
            // return result;
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
                    this._logger.warn('[request] Failed. Method: %s. Unknown Error: ',
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
                    status: status
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
