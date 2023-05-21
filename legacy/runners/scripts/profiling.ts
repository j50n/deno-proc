import * as proc from "../../mod.ts";

const input: string[] = [];

const t1 = new Date().getTime();
for (let i = 0; i < 1000000; i++) {
  input.push(`${i}`);
}
const t2 = new Date().getTime();

console.error(`load data: ${t2 - t1}`);

const ta1 = new Date().getTime();
for (
  const line of await proc.runner(
    proc.stringArrayInput(),
    proc.stringArrayOutput(),
  )(proc.group()).run({ cmd: ["wc", "-l"] }, input)
) {
  console.error(line);
}
const ta2 = new Date().getTime();

console.error(`count: ${ta2 - ta1}`);
