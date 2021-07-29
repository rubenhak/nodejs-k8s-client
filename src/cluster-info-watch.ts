import _ from 'the-lodash'
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { ResourceAccessor } from './resource-accessor';
import { ClusterInfoWatchCallback, KubernetesClient } from './client';
import { ApiGroupInfo } from './cluster-info-fetcher';


export class ClusterInfoWatch
{
    private logger : ILogger;
    private _client: KubernetesClient;
    private _cb: ClusterInfoWatchCallback;


    constructor(logger : ILogger, client: KubernetesClient, cb: ClusterInfoWatchCallback)
    {
        this.logger = logger;
        this._client = client;
        this._cb = cb;
    }

    close()
    {

    }

    notifyApi(isPresent: boolean, apiGroup: ApiGroupInfo, client?: ResourceAccessor)
    {
        return Promise.resolve()
            .then(() => this._cb(isPresent, apiGroup, client))
            .catch(reason => {
                this.logger.error("Error processing API watch. API: %s.", apiGroup.id, reason);
            })
            ;
    }
}
