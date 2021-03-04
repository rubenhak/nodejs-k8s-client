import _ from 'the-lodash'
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { KubernetesClient } from './kubernetes-client';

import { ResourceWatch } from './resource-watch';

export class ResourceAccessor
{
    private _logger : ILogger;
    private _parent : KubernetesClient;

    private _apiName : string;
    private _apiVersion : string;
    private _kindName : string;
    private _pluralName : string;

    private _watches : Record<string, ResourceWatch>;

    constructor(parent : KubernetesClient, apiName : string, apiVersion : string, pluralName : string, kindName : string,
        watches : Record<string, ResourceWatch>)
    {
        this._parent = parent;
        this._logger = parent.logger;
        this._apiName = apiName;
        this._apiVersion = apiVersion;
        this._kindName = kindName;
        this._pluralName = pluralName;
        this._watches = watches;
    }

    get logger() {
        return this._logger;
    }

    get apiName() {
        return this._apiName;
    }

    get kindName() {
        return this._kindName;
    }

    queryAll(namespace: string, labelFilter)
    {
        let uriParts = this._makeUriParts(namespace);
        return this._getRequest(uriParts, { labelSelector: labelFilter })
            .then(result => {
                if (!result) {
                    return [];
                }
                return result.items;
            });
    }
    
    watchAll(namespace: string, cb, connectCb, disconnectCb)
    {
        let watch = new ResourceWatch(this._logger.sublogger("Watch"),
            this,
            namespace,
            cb,
            connectCb,
            disconnectCb,
            this._watches);
        watch.start();
        return watch;
    }

    query(namespace: string, name: string)
    {
        let uriParts = this._makeUriParts(namespace);
        uriParts.push(name)
        return this._getRequest(uriParts);
    }

    create(namespace: string, body: any)
    {
        let uriParts = this._makeUriParts(namespace);
        
        let newBody = this._setupBody(body);
        return this._postRequest(uriParts, {}, newBody)
    }

    delete(namespace: string, name: string)
    {
        let uriParts = this._makeUriParts(namespace);
        uriParts.push(name)
        return this._deleteRequest(uriParts, {})
    }

    update(namespace: string, name: string, body: any)
    {
        let uriParts = this._makeUriParts(namespace);
        uriParts.push(name)
        
        let newBody = this._setupBody(body);
        return this._putRequest(uriParts, {}, newBody)
    }

    private _getRequest(uriParts: string[], params? : Record<string, any>)
    {
        let url = this._joinUrls(uriParts);
        this.logger.info('[_getRequest] %s', url);
        if (params) {
            params = _.clone(params);
            if (params.labelSelector) {
                if (_.keys(params.labelSelector).length == 0) {
                    delete params.labelSelector;
                }
                let selectorParts = _.keys(params.labelSelector).map(x => x + '=' + params!.labelSelector[x]);
                params.labelSelector = selectorParts.join(',');
            }
        }
        return this._parent.request('GET', url, params);
    }

    private _postRequest(uriParts, params, body)
    {
        let url = this._joinUrls(uriParts);
        this.logger.info('[_postRequest] %s', url);
        return this._parent.request('POST', url, params, body);
    }

    private _deleteRequest(uriParts, params)
    {
        let url = this._joinUrls(uriParts);
        this.logger.info('[_deleteRequest] %s', url);
        return this._parent.request('DELETE', url, params);
    }

    private _putRequest(uriParts, params, body)
    {
        let url = this._joinUrls(uriParts);
        this.logger.info('[_putRequest] %s', url);
        return this._parent.request('PUT', url, params, body);
    }

    private _setupBody(body: any)
    {
        let newBody = _.clone(body);
        newBody.kind = this._kindName;
        if (this._apiName) {
            newBody.apiVersion = this._apiName + '/' + this._apiVersion;
        } else {
            newBody.apiVersion = this._apiVersion;
        }
        return newBody;
    }

    _joinUrls(uriParts: string[])
    {
        let prefixParts;
        if (_.isNullOrUndefined(this._apiName)) {
            prefixParts = ['', 'api', this._apiVersion];
        } else {
            prefixParts = ['', 'apis', this._apiName, this._apiVersion];
        }
        uriParts = _.concat(prefixParts, uriParts);
        let url = uriParts.join('/');
        return url;
    }

    _makeUriParts(namespace : string) //, watch
    {
        let uriParts : string[] = [];
        // if (watch) {
        //     uriParts.push('watch')
        // }
        if (namespace) {
            uriParts.push('namespaces')
            uriParts.push(namespace)
        }
        uriParts.push(this._pluralName)
        return uriParts;
    }

}