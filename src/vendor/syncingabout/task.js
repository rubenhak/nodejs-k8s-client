import { workerData, parentPort } from 'worker_threads';


console.log('&&&&&&&& *******')
console.log('&&&&&&&& *******')
console.log('&&&&&&&& *******')
console.log('&&&&&&&& *******')

throw new Error(`TEST!`);

if (!workerData || !parentPort) {
  throw new Error(`expected path/port`);
}

const workerPath = /** @type {string} */ (workerData);
const importPromise = import(workerPath);

parentPort.on('message', (message) => {
  (async () => {

    /** @type {{port: MessagePort, shared: SharedArrayBuffer, args: any[]}} */
    const typedMessage = message;
    const { port, shared, args } = typedMessage;

    try {
      const { default: method } = await importPromise;
      const result = await Promise.resolve(method(...args));
      port.postMessage({return: result});

    } catch (e) {
      port.postMessage({error: e});

    } finally {
      const int32 = new Int32Array(shared);
      Atomics.notify(int32, 0);
    }

  })();
});
