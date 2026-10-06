import { WritableIterable } from "@j50n/proc";

const target = new EventTarget();
const messages = new WritableIterable<string>();

target.addEventListener("message", (event) => {
  // write() rejects once the queue is closed; catch it in a handler, or the
  // unhandled rejection ends the program.
  messages.write((event as CustomEvent<string>).detail).catch(() => {});
});
target.addEventListener("error", () => {
  messages.close(new Error("the source failed"));
});

// Nothing is reading yet, so these just queue.
target.dispatchEvent(new CustomEvent("message", { detail: "hello" }));
target.dispatchEvent(new CustomEvent("message", { detail: "world" }));
target.dispatchEvent(new Event("error"));
target.dispatchEvent(new CustomEvent("message", { detail: "too late" }));

try {
  for await (const message of messages) {
    console.log(message);
  }
} catch (error) {
  if (error instanceof Error) console.log(`error: ${error.message}`);
}
