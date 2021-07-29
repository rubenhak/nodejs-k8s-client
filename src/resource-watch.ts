import _ from 'the-lodash'
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import * as ndjson from 'ndjson';
import { ResourceAccessor, ResourceScope } from './resource-accessor';
import { IncomingMessage } from 'http';
import { KubernetesObject } from './types';

export type WatchCallback = (action: DeltaAction, data: KubernetesObject) => void;
export type ConnectCallback = (resourceAccessor : ResourceAccessor) => void;
export type DisconnectCallback = (resourceAccessor : ResourceAccessor, reason: {}) => void;
export type CloseCallback = () => void;

export class ResourceWatch
{
    private _logger : ILogger;
    private _resourceAccessor : ResourceAccessor;

    private _namespace : string | null;

    private _snapshot : Record<string, any> = {};
    private _newSnapshot : Record<string, any> = {};
    private _recovering : boolean = false;
    private _isScheduled : boolean = false;
    private _scheduleTimeout : number = 100;
    private _isStopped : boolean = false;
    private _stream : IncomingMessage | null = null;
    private _isDisconnected : boolean = true;

    private _cb : WatchCallback;
    private _connectCb : ConnectCallback;
    private _disconnectCb : DisconnectCallback;
    private _closeCb: CloseCallback;

    private _waitCloseResolveCb : (() => void)[] = [];

    private _scope: ResourceScope;

    private _runWatchTimer: NodeJS.Timeout | null = null;
    private _recoveryTimer: NodeJS.Timeout | null = null;

    private _name : string;

    constructor(logger : ILogger, resourceAccessor: ResourceAccessor, namespace: string | null, 
        cb: WatchCallback, connectCb: ConnectCallback, disconnectCb: DisconnectCallback,
        closeCb: CloseCallback,
        scope: ResourceScope)
    {
        this._logger = logger;
        this._resourceAccessor = resourceAccessor;
        this._namespace = namespace;
        this._cb = cb;
        this._connectCb = connectCb;
        this._disconnectCb = disconnectCb;
        this._closeCb = closeCb;
        this._scope = scope;
        this._name = `${this._resourceAccessor.apiName}::${this._resourceAccessor.kindName}`
    }

    get logger() {
        return this._logger;
    }

    get name() {
        return this._name;
    }

    start()
    {
        this._logger.info('[start] API: %s. Start.', this.name);
        // this._scope.watches[this._id] = this;
        this._runWatch();
    }

    stop()
    {
        this._logger.info('[stop] API: %s. Stop.', this.name);
        this._isStopped = true;
        this._stopRecoveryTimer();
        this._stopRunWatchTimer();
        this._closeStream();
        this._closeCb();
    }

    close()
    {
        return this.stop();
    }

    waitClose()
    {
        this._logger.info('[waitClose] API: %s. Waiting...', this.name);
        return Promise.construct((resolve, reject) => {
            if (this._isDisconnected) {
                resolve();
            } else {
                this._waitCloseResolveCb.push(() => {
                    this._logger.info('[waitClose] API: %s. Finished.', this.name);
                    resolve();
                });
            }
        });
    }

    private _closeStream()
    {
        if (this._stream) {
            this._logger.info('[_closeStream] API: %s. Destroying...', this.name);
            this._stream.destroy();
            this._stream = null;
            this._onDisconnect({});
        } else {
            this._logger.info('[_closeStream] API: %s.No stream', this.name);
        }
    }

    private _runWatch()
    {
        this._stopRunWatchTimer();

        this._isScheduled = false;

        let uriParts = this._resourceAccessor._makeUriParts(this._namespace);
        let url = this._resourceAccessor._joinUrls(uriParts);

        let params : Record<string, any> = {
            watch: true
        }
        this._startRecoveryCountdown();

        this._isDisconnected = false;

        this._scope.request('GET', url, params, null, true)
            .then(result => {
                if (!result) {
                    this._logger.error('[_runWatch] API: %s. EMPTY RESULT.', this.name);
                    return;
                }

                this._stream = <IncomingMessage>result.data;

                this._logger.info('[_runWatch] API: %s. Connected', this.name);
                if (this._connectCb) {
                    this._connectCb(this._resourceAccessor);
                }
                this._scheduleTimeout = 0;

                this._stream
                    .pipe(ndjson.parse())
                    .on('data', (data) => {
                        const item = <K8sWatchItem>data;
                        if (!data.object) {
                            this._logger.error('[_runWatch] API: %s. Missing Data:', this.name, data);
                            return;
                        }
                        this._handleChange(item.type, item.object);
                    })
                    .on('close', () => {
                        this._logger.info('[_runWatch] API: %s. STREAM :: close...', this.name);
                    })
                    .on('drain', () => {
                        this._logger.info('[_runWatch] API: %s. STREAM :: drain...', this.name);
                    })
                    .on('finish', () => {
                        this._logger.info('[_runWatch] API: %s. STREAM :: finish...', this.name);
                    })
                    .on('end', () => {
                        this._logger.info('[_runWatch] API: %s. STREAM :: end...', this.name);
                        this._onDisconnect({});
                    })
                    .on('error', () => {
                        this._logger.error('[_runWatch] API: %s. STREAM :: error...', this.name);
                        this._onDisconnect({});
                    });

                if (this._isStopped) {
                    this._closeStream();
                }
            })
            .catch(reason => {
                let data : Record<string, any> = {};
                let isKnownError: boolean = false;
                if (reason.status) {
                    this.logger.error("[_runWatch] API: %s. Error Code: %s", this.name, reason.status);
                    data.status = reason.status;
                    isKnownError = true;
                }
                
                if (reason.message) {
                    this.logger.error("[_runWatch] API: %s. Error Message: %s", this.name, reason.message);
                    data.message = reason.message;
                    isKnownError = true;
                }

                if (!isKnownError) {
                    this.logger.error("[_runWatch] API: %s. Error: ", this.name, reason);
                }

                this._onDisconnect(data);
            })
    }

    private _handleChange(action: DeltaAction, data: KubernetesObject)
    {
        this._logger.silly('[_handleChange] %s. %s :: %s...', this.name, action, data.metadata.name);

        if (this._recovering) {
            this._applyToSnapshot(this._newSnapshot, action, data);
            if (action == DeltaAction.Added) {
                this._scheduleRecoveryTimer(100);
            } else {
                this._handleRecovery();
            }
        } else {
            this._applyToSnapshot(this._snapshot, action, data);
            this._cb(action, data);
        }
    }

    private _applyToSnapshot(snapshot: Record<string, any>, action : DeltaAction, data: any)
    {
        if (action == DeltaAction.Added || action == DeltaAction.Modified) {
            snapshot[data.metadata.name] = data;
            return;
        }
        if (action == DeltaAction.Deleted) {
            delete snapshot[data.metadata.name];
            return;
        }
        throw new Error("Unknown action: " + action);
    }

    private _onDisconnect(data: any)
    {
        this.logger.info('[_onDisconnect] ', data);

        if (this._isDisconnected) {
            return;
        }
        this._isDisconnected = true;

        if (this._stream) {
            this._stream.socket.destroy();
        }
        this._stream = null;

        if (this._disconnectCb) {
            this._disconnectCb(this._resourceAccessor, data);
        }

        this._tryReconnect();

        if (this._isStopped) {
            let cbs = this._waitCloseResolveCb;
            this._waitCloseResolveCb = [];
            for(let cb of cbs) {
                cb();
            }
        }
    }

    private _tryReconnect()
    {
        if (this._isStopped) {
            return;
        }
        this._logger.info('[_tryReconnect] API: %s. Reconnect.', this.name);
        this._recovering = true;
        this._newSnapshot = {};
        this._scheduleRunWatch();
    }

    private _scheduleRunWatch()
    {
        if (this._isScheduled) {
            return;
        }
        this._isScheduled = true;

        if (this._scheduleTimeout < 100) {
            this._scheduleTimeout = 100;
        } else {
            this._scheduleTimeout = this._scheduleTimeout * 2;
        }
        this._scheduleTimeout = Math.min(this._scheduleTimeout, 1 * 60 * 1000);
        this._logger.silly('[_scheduleRunWatch] API: %s. timeout: %s...', this.name, this._scheduleTimeout);

        this._runWatchTimer = setTimeout(() => {
                this._runWatch();
            },
            this._scheduleTimeout);
    }

    private _startRecoveryCountdown()
    {
        if (!this._recovering) {
            return;
        }
        this._logger.info('[_startRecoveryCountdown] API: %s. Recovery Countdown Scheduled', this.name);
        this._scheduleRecoveryTimer(1000);
    }

    private _scheduleRecoveryTimer(duration : number)
    {
        this._logger.silly('[_scheduleRecoveryTimer] API: %s. timeout: %s...', this.name, duration);
        this._stopRecoveryTimer();
        this._recoveryTimer = setTimeout(this._handleRecovery.bind(this), duration);
    }

    private _handleRecovery()
    {
        this._logger.info('[_handleRecovery] API: %s...', this.name);
        this._stopRecoveryTimer();

        this._logger.silly('[_handleRecovery] API: %s. Snapshot: ', this.name, this._snapshot);
        this._logger.silly('[_handleRecovery] API: %s. NewSnapshot: ', this.name, this._newSnapshot);

        let delta = this._produceDelta(this._snapshot, this._newSnapshot);
        this._logger.verbose('[_handleRecovery] API: %s. delta: ', this.name, delta);

        for(let x of delta) {
            this._applyToSnapshot(this._snapshot, x.action, x.data);
            this._cb(x.action, x.data);
        }

        let finalDelta = this._produceDelta(this._snapshot, this._newSnapshot);
        if (finalDelta.length > 0) {
            this._logger.info('[_handleRecovery] API: %s. FINAL delta. should be zero: ', this.name, finalDelta);
            throw new Error("Final Delta After Recover Should Be Empty!");
        }

        this._recovering = false;
        this._newSnapshot = {};

        this._logger.info('[_handleRecovery] API: %s. Recovery completed.', this.name);
    }

    private _stopRunWatchTimer()
    {
        if (this._runWatchTimer) {
            clearTimeout(this._runWatchTimer);
            this._runWatchTimer = null;
        }
    }

    private _stopRecoveryTimer()
    {
        if (this._recoveryTimer) {
            clearTimeout(this._recoveryTimer);
            this._recoveryTimer = null;
        }
    }

    private _produceDelta(current: Record<string, any>, desired: Record<string, any>) : DeltaItem[]
    {
        let delta : DeltaItem[] = [];
        for(let x of _.keys(current)) {
            if (x in desired) {
                if (!_.fastDeepEqual(current[x], desired[x])) {
                    delta.push({
                        action: DeltaAction.Modified,
                        data: _.cloneDeep(desired[x])
                    });
                }
            } else {
                delta.push({
                    action: DeltaAction.Deleted,
                    data: _.cloneDeep(current[x])
                });
            }
        }
        for(let x of _.keys(desired)) {
            if (!(x in current)) {
                delta.push({
                    action: DeltaAction.Added,
                    data: _.cloneDeep(desired[x])
                });
            }
        }
        return delta;
    }
}

interface DeltaItem
{
    action: DeltaAction,
    data: KubernetesObject
}

export enum DeltaAction
{
    Added = 'ADDED',
    Modified = 'MODIFIED',
    Deleted = 'DELETED'
}

interface K8sWatchItem
{
    type: DeltaAction,
    object: KubernetesObject
}