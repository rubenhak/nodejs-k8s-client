const fs = require('fs');
const request = require('request-promise');
const requestOrig = require('request');

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

        this.setupResourceClient('ClusterRole', 'rbac.authorization.k8s.io', 'v1', 'clusterroles');
        this.setupResourceClient('ClusterRoleBinding', 'rbac.authorization.k8s.io', 'v1', 'clusterrolebindings');

        this.setupResourceClient('Deployment', 'apps', 'v1', 'deployments');
        this.setupResourceClient('DaemonSet', 'apps', 'v1', 'daemonsets');
        this.setupResourceClient('StatefulSet', 'apps', 'v1', 'statefulsets');
        this.setupResourceClient('CustomResourceDefinition', 'apiextensions.k8s.io', 'v1beta1', 'customresourcedefinitions');
        this.setupResourceClient('PriorityClass', 'scheduling.k8s.io', 'v1beta1', 'priorityclasses');

        this.setupResourceClient('Ingress', 'extensions', 'v1beta1', 'ingresses');

        this.setupResourceClient('HorizontalPodAutoscaler', 'autoscaling', 'v2beta1', 'horizontalpodautoscalers');

        this.setupResourceClient('BerliozService', 'berlioz.cloud', 'v1', 'services');

        this.setupResourceClient('ManagedCertificate', 'networking.gke.io', 'v1beta1', 'managedcertificates');
    }

    get logger() {
        return this._logger;
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

    setupResourceClient(kindName, apiName, apiVersion, pluralName)
    {
        this._resourceClients[kindName] = new ResourceAccessor(this, apiName, apiVersion, pluralName, kindName);
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
            uri: this._config.server + url,
            ca: this._config.caData,
            headers: {
                'Authorization': 'Bearer ' + this._config.token
            },
            json: true
        };
        if (params) {
            options.qs = params;
        }
        if (body) {
            options.body = body;
        }
        if (useStream) {
            this._logger.verbose('[request] Stream Begin: ', options);
            var result = requestOrig(options);
            this._logger.verbose('[request] Stream Result: ', result);
            return result;
        }

        this._logger.info('[request] Begin', options);
        return request(options)
            .then(result => {
                this._logger.info('[request] RAW RESULT:', result);

                if (!result) {
                    throw new Error("No result");
                }
                if (result.kind == "Status") {
                    if (result.status == "Failure") {
                        throw new Error(result.message);
                    }
                }
                return result;
            })
            .catch(reason => {
                this._logger.warn('[request] Failed. Method: %s. StatusCode: %s. ',
                    method,
                    reason.statusCode,
                    options,
                    reason);

                if (method == 'GET') {
                    if (reason.statusCode == 404) {
                        return null;
                    }
                }

                if (method == 'DELETE') {
                    if (reason.statusCode == 404) {
                        return reason;
                    }
                }

                if (reason.response) {
                    if (reason.response.body) {
                        if (reason.response.body.kind == "Status") {
                            if (reason.response.body.status == "Failure") {
                                throw new KubernetesError(reason.response.body.message, reason.statusCode);
                            }
                        }
                    }
                }

                throw reason;
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
