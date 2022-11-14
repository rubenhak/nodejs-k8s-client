const { workerData, parentPort } = require('worker_threads');

if (!workerData) {
  throw new Error(`expected workerData`);
}
if (!parentPort) {
  throw new Error(`expected port`);
}

const workerPath = '../../' + workerData;
const workerModule = require(workerPath);
const workerFunc = workerModule.default;

parentPort.on('message', async (message) => {
  (async () => {

    const { port, shared, args } = message;

    try {
      const result = await Promise.resolve(workerFunc(...args));
      port.postMessage({return: result});

    } catch (e) {
      port.postMessage({error: e});

    } finally {
      const int32 = new Int32Array(shared);
      Atomics.notify(int32, 0);
    }

  })();
});
