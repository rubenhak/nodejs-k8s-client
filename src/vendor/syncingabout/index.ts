
import { Worker, MessageChannel, receiveMessageOnPort } from 'worker_threads';


/**
 * @param {string} workerPath
 * @return {(...args: any) => any}
 */
export default function build(workerPath: string) : (...args: any) => any
{
  const taskPath = __dirname + '/task.mjs';
  // console.error("|- TaskPath: ", taskPath);

  const w = new Worker(taskPath, { 
    workerData: workerPath,
  });

  w.on('error', (err) => {
    console.error("|- K8s-CLIENT WORKER ERROR: ", err);
    throw err;
  })

  w.on('exit', (code) => {
    console.error("|- K8s-CLIENT WORKER EXIT: ", code);
  })

  w.unref();

  let activeCount = 0;

  return (...args: any) => {
    if (activeCount === 0) {
      w.ref();
      ++activeCount;
    }

    try {
      const shared = new SharedArrayBuffer(4);
      const int32 = new Int32Array(shared);

      const { port1: localPort, port2: workerPort } = new MessageChannel();
      w.postMessage({ port: workerPort, shared, args }, [workerPort]);

      Atomics.wait(int32, 0, 0);

      /** @type {{message: {return?: any, error?: any}}|undefined} */
      const m = receiveMessageOnPort(localPort);
      if (m === undefined) {
        throw new Error(`did not get async reply in time`);
      }

      const { message } = m;
      if ('return' in message) {
        return message.return;
      }
      throw message.error;

    } finally {
      --activeCount;
      if (activeCount === 0) {
        w.unref();
      }
    }
  };
}
