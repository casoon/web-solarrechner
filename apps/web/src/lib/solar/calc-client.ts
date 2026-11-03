import type { Job, JobResult, Kind } from './calc-jobs';

/** The job was replaced by a newer one of the same kind; its result no longer matters. */
export class Superseded extends Error {}
export type Status = { done: number; total: number } | null;

// One worker per kind, so a long comparison never holds back the main result. A newer job of the
// same kind stops the running one instead of waiting behind it.
const workers = new Map<Kind, Worker>();
const running = new Map<Kind, () => void>();
const tally = new Map<Kind, { done: number; total: number }>();
let listener: (status: Status) => void = () => {};

/** Combined progress of all running jobs, null when everything is done. */
export function watchProgress(callback: (status: Status) => void) {
  listener = callback;
}
function report() {
  if (!running.size) {
    tally.clear();
    listener(null);
    return;
  }
  let done = 0,
    total = 0;
  for (const part of tally.values()) {
    done += part.done;
    total += part.total;
  }
  listener({ done, total });
}

export function run<K extends Kind>(job: Extract<Job, { kind: K }>): Promise<JobResult[K]> {
  const kind: K = job.kind;
  running.get(kind)?.();
  let worker = workers.get(kind);
  if (!worker) {
    worker = new Worker(new URL('./calc.worker.ts', import.meta.url), { type: 'module' });
    workers.set(kind, worker);
  }
  const current = worker;
  const part = { done: 0, total: 1 };
  tally.set(kind, part);
  return new Promise((resolve, reject) => {
    const finish = () => {
      current.onmessage = current.onerror = null;
      part.done = part.total;
      running.delete(kind);
      report();
    };
    running.set(kind, () => {
      current.terminate();
      workers.delete(kind);
      finish();
      reject(new Superseded());
    });
    current.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        part.done = data.done;
        part.total = data.total;
        report();
        return;
      }
      finish();
      if (data.type === 'done') resolve(data.result);
      else reject(new Error(data.message));
    };
    current.onerror = (event) => {
      current.terminate();
      workers.delete(kind);
      finish();
      reject(new Error(event.message));
    };
    current.postMessage(job);
    report();
  });
}
