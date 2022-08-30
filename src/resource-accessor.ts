import { AxiosRequestConfig } from 'axios';
import _ from 'the-lodash'
import { v4 as uuidv4 } from 'uuid';
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { KubernetesClient } from './client';

import { ConnectCallback, DisconnectCallback, ResourceWatch, WatchCallback } from './resource-watch';
import { KubernetesObject } from './types';

export interface ResourceScope
{
    request(method: AxiosRequestConfig['method'], url: string, params? : Record<string, any>, body? : Record<string, any> | null, useStream? : boolean)  : Promise<any>;
}

export class ResourceAccessor
{
    private _logger : ILogger;
    private _parent : KubernetesClient;

    private _apiName : string | null;
    private _version : string;
    private _kindName : string;
    private _pluralName : string;

    private _watches : Record<string, ResourceWatch> = {};

    constructor(parent : KubernetesClient, apiName : string | null, version : string, pluralName : string, kindName : string)
    {
        this._parent = parent;
        this._logger = parent.logger;
        this._apiName = apiName;
        this._version = version;
        this._kindName = kindName;
        this._pluralName = pluralName;
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

    close()
    {
        for(const watch of _.values(this._watches))
        {
            watch.close();
        }   
    }

    queryAll(namespace?: string, labelFilter? : any)
    {
        const uriParts = this._makeUriParts(namespace);
        return this._getRequest<any>(uriParts, { labelSelector: labelFilter })
            .then(result => {
                if (!result) {
                    return <KubernetesObject[]>[];
                }
                for(const x of result.items)
                {
                    if (!x.kind) {
                        x.kind = this.kindName;
                    }
                    if (!x.apiVersion) {
                        x.apiVersion = result.apiVersion;
                    }
                }
                return <KubernetesObject[]>result.items;
            });
    }
    
    watchAll(namespace: string | null, cb: WatchCallback, connectCb: ConnectCallback, disconnectCb: DisconnectCallback)
    {
        const id = uuidv4();

        const scope : ResourceScope = {
            request: this._parent.request.bind(this._parent)
        }

        const watch = new ResourceWatch(this._logger.sublogger("Watch"),
            this,
            namespace,
            cb,
            connectCb,
            disconnectCb,
            () => {
                delete this._watches[id];
            },
            scope);

        this._watches[id] = watch;
        
        watch.start();
        return watch;
    }

    query(namespace: string | null, name: string)
    {
        const uriParts = this._makeUriParts(namespace);
        uriParts.push(name)
        return this._getRequest<KubernetesObject>(uriParts);
    }

    create(namespace: string | null, body: any)
    {
        const uriParts = this._makeUriParts(namespace);
        const newBody = this._setupBody(body);
        return this._postRequest(uriParts, {}, newBody)
    }

    delete(namespace: string, name: string)
    {
        const uriParts = this._makeUriParts(namespace);
        uriParts.push(name)
        return this._deleteRequest(uriParts, {})
    }

    update(namespace: string, name: string, body: any)
    {
        const uriParts = this._makeUriParts(namespace);
        uriParts.push(name)
        
        const newBody = this._setupBody(body);
        return this._putRequest(uriParts, {}, newBody)
    }

    private _getRequest<T>(uriParts: string[], params? : Record<string, any>)
    {
        const url = this._joinUrls(uriParts);
        this.logger.info('[_getRequest] %s', url);
        if (params) {
            params = _.clone(params);
            if (params.labelSelector) {
                if (_.keys(params.labelSelector).length == 0) {
                    delete params.labelSelector;
                }
                const selectorParts = _.keys(params.labelSelector).map(x => x + '=' + params!.labelSelector[x]);
                params.labelSelector = selectorParts.join(',');
            }
        }
        return this._parent.request<T>('GET', url, params);
    }

    private _postRequest(uriParts: string[], params? : Record<string, any>, body? : Record<string, any> | null)
    {
        const url = this._joinUrls(uriParts);
        this.logger.info('[_postRequest] %s', url);
        return this._parent.request<any>('POST', url, params, body);
    }

    private _deleteRequest(uriParts: string[], params? : Record<string, any>)
    {
        const url = this._joinUrls(uriParts);
        this.logger.info('[_deleteRequest] %s', url);
        return this._parent.request<any>('DELETE', url, params);
    }

    private _putRequest(uriParts: string[], params? : Record<string, any>, body? : Record<string, any> | null)
    {
        const url = this._joinUrls(uriParts);
        this.logger.info('[_putRequest] %s', url);
        return this._parent.request<any>('PUT', url, params, body);
    }

    private _setupBody(body: any)
    {
        const newBody = _.clone(body);
        newBody.kind = this._kindName;
        if (this._apiName) {
            newBody.apiVersion = this._apiName + '/' + this._version;
        } else {
            newBody.apiVersion = this._version;
        }
        return newBody;
    }

    _joinUrls(uriParts: string[])
    {
        let prefixParts : any[];
        if (_.isNullOrUndefined(this._apiName)) {
            prefixParts = ['', 'api', this._version];
        } else {
            prefixParts = ['', 'apis', this._apiName, this._version];
        }
        const newUriParts = _.concat(prefixParts, uriParts);
        const url = newUriParts.join('/');
        return url;
    }

    _makeUriParts(namespace? : string | null) //, watch
    {
        const uriParts : string[] = [];
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