import { enumerate } from "../../../mod.ts";

await enumerate([
  new Uint8Array([72, 101, 108, 108, 111, 44, 32]),
  new Uint8Array([119, 111, 114, 108, 100, 46, 10]),
]).run("wc", "-w").toStdout();

await enumerate(["Hello, world."]).run("wc", "-w").toStdout();
