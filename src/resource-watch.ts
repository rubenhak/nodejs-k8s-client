import _ from 'the-lodash'
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { v4 as uuidv4 } from 'uuid';
import * as ndjson from 'ndjson';
import { ResourceAccessor } from './resource-accessor';

export class ResourceWatch
{
    private _logger : ILogger;
    private _resourceAccessor : ResourceAccessor;

    private _id : string;
    private _namespace : string;

    private _snapshot : any = {};
    private _newSnapshot : any;
    private _recovering : boolean = false;
    private _isScheduled : boolean = false;
    private _scheduleTimeout : number = 100;
    private _isStopped : boolean = false;
    private _stream : any = null;
    private _isDisconnected : boolean = true;

    private _cb : any;
    private _connectCb : any;
    private _disconnectCb : any;

    private _waitCloseResolveCb : any;

    private _watches : Record<string, ResourceWatch>;

    constructor(logger : ILogger, resourceAccessor: ResourceAccessor, namespace: string, 
        cb: any, connectCb: any, disconnectCb: any,
        watches : Record<string, ResourceWatch>)
    {
        this._id = uuidv4();
        this._logger = logger;
        this._resourceAccessor = resourceAccessor;
        this._namespace = namespace;
        this._cb = cb;
        this._connectCb = connectCb;
        this._disconnectCb = disconnectCb;
        this._watches = watches;
    }

    get logger() {
        return this._logger;
    }

    get name() {
        return this._resourceAccessor.kindName
    }

    start()
    {
        this._logger.info('[start] %s...', this.name);
        this._watches[this._id] = this;
        this._runWatch();
    }

    stop()
    {
        this._logger.info('[stop] %s...', this.name);
        this._isStopped = true;
        this._closeStream();
        delete this._watches[this._id];
    }

    waitClose()
    {
        this._logger.info('[waitClose] %s...', this.name);
        return new Promise((resolve, reject) => {
            if (this._isDisconnected) {
                resolve();
            } else {
                this._waitCloseResolveCb = () => {
                    this._logger.info('[waitClose] Finished: %s', this.name);
                    resolve();
                };
            }
        });
    }

    private _closeStream()
    {
        if (this._stream) {
            this._logger.info('[_closeStream] Destroying...');
            this._stream.socket.destroy();
            this._stream = null;
        } else {
            this._logger.info('[_closeStream] No stream');
        }
    }

    private _runWatch()
    {
        this._isScheduled = false;

        let uriParts = this._resourceAccessor._makeUriParts(this._namespace);
        let url = this._resourceAccessor._joinUrls(uriParts);

        let params = {
            watch: true
        }
        this._startRecoveryCountdown();

        this._isDisconnected = false;

        this._resourceAccessor._parent.request('GET', url, params, null, true)
            .then(result => {
                this._stream = result.data;

                this._logger.info('[_runWatch] Connected: %s.', this.name);
                if (this._connectCb) {
                    this._connectCb(this._resourceAccessor);
                }
                this._scheduleTimeout = 0;

                this._stream
                    .pipe(ndjson.parse())
                    .on('data', (data) => {
                        if (!data.object) {
                            this._logger.error('[_runWatch] MISSING DATA for %s.', this.name, data);
                            return;
                        }
                        this._handleChange(data.type, data.object);
                    })
                    .on('finish', () => {
                        this._logger.info('[_runWatch] STREAM :: finish...');
                    })
                    .on('end', () => {
                        this._logger.info('[_runWatch] STREAM :: end...');
                        this._onDisconnect({});
                    })
                    .on('error', () => {
                        this._logger.error('[_runWatch] STREAM :: error...');
                        this._onDisconnect({});
                    });

                if (this._isStopped) {
                    this._closeStream();
                }
            })
            .catch(reason => {
                let data = {};
                if (reason.status) {
                    this.logger.error("[_runWatch] Error Code: %s", reason.status);
                    data.status = reason.status;
                } else {
                    this.logger.error("[_runWatch] Error: ", reason);
                }
                this._onDisconnect(data);
            })
    }

    private _handleChange(action, data)
    {
        this._logger.info('[_handleChange] %s. %s :: %s...', this.name, action, data.metadata.name);

        if (this._recovering) {
            this._applyToSnapshot(this._newSnapshot, action, data);
            if (action == 'ADDED') {
                this._scheduleRecoveryTimer(100);
            } else {
                this._handleRecovery();
            }
        } else {
            this._applyToSnapshot(this._snapshot, action, data);
            this._cb(action, data);
        }
    }

    private _applyToSnapshot(snapshot: any, action : DeltaAction, data: any)
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

    private _onDisconnect(data)
    {
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
            if (this._waitCloseResolveCb) {
                let x = this._waitCloseResolveCb;
                this._waitCloseResolveCb = null;
                x();
            }
        }
    }

    private _tryReconnect()
    {
        if (this._isStopped) {
            return;
        }
        this._logger.info('[_tryReconnect] %s...', this.name);
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
        this._scheduleTimeout = Math.min(this._scheduleTimeout, 10 * 1000);
        this._logger.silly('[_scheduleRunWatch] timeout: %s...', this._scheduleTimeout);

        setTimeout(() => {
                this._runWatch();
            },
            this._scheduleTimeout);
    }

    private _startRecoveryCountdown()
    {
        if (!this._recovering) {
            return;
        }
        this._logger.info('[_startRecoveryCountdown] %s...', this.name);
        this._scheduleRecoveryTimer(1000);
    }

    private _scheduleRecoveryTimer(duration)
    {
        this._logger.silly('[_scheduleRecoveryTimer] %s. timeout: %s...', this.name, duration);
        this._stopTimer();
        this._recoveryTimeout = setTimeout(this._handleRecovery.bind(this), duration);
    }

    private _handleRecovery()
    {
        this._logger.info('[_handleRecovery] %s...', this.name);
        this._stopTimer();

        this._logger.silly('[_handleRecovery] %s. Snapshot: ', this.name, this._snapshot);
        this._logger.silly('[_handleRecovery] %s. NewSnapshot: ', this.name, this._newSnapshot);

        let delta = this._produceDelta(this._snapshot, this._newSnapshot);
        this._logger.verbose('[_handleRecovery] %s. delta: ', this.name, delta);

        for(let x of delta) {
            this._applyToSnapshot(this._snapshot, x.action, x.data);
            this._cb(x.action, x.data);
        }

        let finalDelta = this._produceDelta(this._snapshot, this._newSnapshot);
        if (finalDelta.length > 0) {
            this._logger.info('[_handleRecovery] %s. FINAL delta. should be zero: ', this.name, finalDelta);
            throw new Error("Final Delta After Recover Should Be Empty!");
        }

        this._recovering = false;
        this._newSnapshot = null;

        this._logger.info('[_handleRecovery] %s recovery completed.', this.name);
    }

    private _stopTimer()
    {
        if (this._recoveryTimeout) {
            clearTimeout(this._recoveryTimeout);
            this._recoveryTimeout = null;
        }
    }

    private _produceDelta(current, desired) : DeltaItem[]
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
    data: any
}

enum DeltaAction
{
    Added,
    Modified,
    Deleted
}