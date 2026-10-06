import { enumerate, sleep } from "@j50n/proc";

const jobs = [
  { name: "slow", ms: 300 },
  { name: "fast", ms: 100 },
  { name: "medium", ms: 200 },
];

async function work(job: { name: string; ms: number }) {
  await sleep(job.ms);
  return job.name;
}

// In input order: "fast" and "medium" wait behind "slow".
console.log(
  await enumerate(jobs).concurrentMap(work, { concurrency: 3 }).collect(),
);

// In the order they finish.
console.log(
  await enumerate(jobs).concurrentUnorderedMap(work, { concurrency: 3 })
    .collect(),
);
