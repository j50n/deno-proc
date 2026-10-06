import { read } from "@j50n/proc";
import { fromJsonToRows } from "@j50n/proc/transforms";

type Event = { id: string; level: string; ms: number };

const slow = await read("data-events.jsonl")
  .transform(fromJsonToRows<Event>()) // the type is asserted, not checked
  .flatten()
  .filter((event) => event.ms > 10)
  .map((event) => event.id)
  .collect();

console.log(slow);
