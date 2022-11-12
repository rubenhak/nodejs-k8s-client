
import { Worker, MessageChannel, receiveMessageOnPort } from 'worker_threads';

/**
 * @param {string} workerPath
 * @return {(...args: any) => any}
 */
export default function build(workerPath: string) : (...args: any) => any
{
  console.log("***** 22222");

  console.log("PRE WORKER");
  // const taskPath = new URL('./task.js', __dirname);

  const taskPath = './vendor/syncingabout/task.js'; //__dirname + 
  const w = new Worker(taskPath, { 
    workerData: workerPath ,
    stdin: true,
    stdout: true,
    stderr: true,
  });
  console.log("AFTER WORKER");  
  w.unref();
  console.log("WORKER INFO: ", w);  

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
