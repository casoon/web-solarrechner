import {
  calculate,
  chargingCases,
  compareStorage,
  compareVariants,
  type Inputs,
  type SolarProfile,
} from './model';
import { createPolicy, type PolicySettings } from './policy';
import { type PriceLevel, sizeOptions, storageOptions, type WorkOptions } from './presets';

/** Reports finished yearly runs of a job, so the page can show how far it is. */
export type Progress = (done: number, total: number) => void;
export interface Scenario {
  profile: SolarProfile;
  input: Inputs;
  commission: string;
  settings: PolicySettings;
}
interface Costs {
  automatic: boolean;
  level: PriceLevel;
}
interface Sizes extends Costs {
  /** Inputs before cost resolution, with the module power of both roof surfaces. */
  system: Inputs;
  work: WorkOptions;
  /** Storage of the size comparison: the result view chosen on the page. */
  capacity: number;
}
const plan = (job: Scenario) => createPolicy(job.input, job.commission, job.settings);

function result(job: Scenario, progress: Progress) {
  progress(0, 2);
  return calculate(job.profile, job.input, plan(job));
}
function storage(job: Scenario & Costs, progress: Progress) {
  const options = storageOptions(job.input, job.automatic, job.level);
  progress(0, options.length + 1);
  return compareStorage(job.profile, job.input, plan(job), options);
}
/** Other sizes and charging habits for the same inputs; only for roof systems. */
function variants(job: Scenario & Sizes, progress: Progress) {
  if (job.input.mode !== 'roof') return { sizes: [], charging: [] };
  const options = sizeOptions(job.system, job.work, job.automatic, job.level);
  const cases = job.input.cars > 0 ? chargingCases(job.input) : [];
  const total = options.length + 2 * cases.length;
  let done = 0;
  const run = (input: Inputs, policy: ReturnType<typeof plan>, capacity: number) => {
    const [result] = compareVariants(job.profile, [{ input, policy, capacity }]);
    progress(++done, total);
    return result;
  };
  progress(0, total);
  const sizes = options.map((input) => ({
    input,
    result: run(input, plan({ ...job, input }), job.capacity),
  }));
  const charging = cases.map((c) => ({
    ...c,
    without: run(c.input, plan(job), 0),
    with: run(c.input, plan(job), c.input.battery),
  }));
  return { sizes, charging };
}

export type Job =
  | ({ kind: 'result' } & Scenario)
  | ({ kind: 'storage' } & Scenario & Costs)
  | ({ kind: 'variants' } & Scenario & Sizes);
export type Kind = Job['kind'];
export interface JobResult {
  result: ReturnType<typeof result>;
  storage: ReturnType<typeof storage>;
  variants: ReturnType<typeof variants>;
}
const jobs: { [K in Kind]: (job: Extract<Job, { kind: K }>, progress: Progress) => JobResult[K] } =
  { result, storage, variants };
export function runJob<K extends Kind>(job: Extract<Job, { kind: K }>, progress: Progress) {
  const handler: (job: Extract<Job, { kind: K }>, progress: Progress) => JobResult[K] =
    jobs[job.kind];
  return handler(job, progress);
}
