import { enumerate } from "@j50n/proc";
import { fromJsonToRows } from "@j50n/proc/transforms";

type Event = { id: string; ms: number };

// Anything with a parse() that throws on a bad value works; a Zod schema does.
const EventSchema = {
  parse(value: unknown): Event {
    const e = value as Partial<Event>;
    if (typeof e?.id !== "string" || typeof e.ms !== "number") {
      throw new TypeError(`not an event: ${JSON.stringify(value)}`);
    }
    return e as Event;
  },
};

const text = '{"id":"e1","ms":12}\n{"id":"e2","ms":"slow"}\n';

try {
  await enumerate([new TextEncoder().encode(text)])
    .transform(fromJsonToRows({ schema: EventSchema }))
    .flatten()
    .forEach((event) => console.log(event.id));
} catch (error) {
  if (error instanceof TypeError) console.log(error.message);
}
