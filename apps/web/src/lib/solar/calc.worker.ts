import { type Job, runJob } from './calc-jobs';

// Runs one calculation off the main thread; the page keeps responding while it works.
self.onmessage = ({ data }: MessageEvent<Job>) => {
  try {
    const result = runJob(data, (done, total) => postMessage({ type: 'progress', done, total }));
    postMessage({ type: 'done', result });
  } catch (error) {
    postMessage({ type: 'error', message: String(error) });
  }
};
