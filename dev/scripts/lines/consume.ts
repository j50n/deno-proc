import { blue } from "@std/fmt/colors";
import { run } from "../../mod.ts";

const produce = import.meta.resolve("./produce.ts");

for await (const line of run("deno", "run", produce).lines) {
  console.log(`${blue(new Date().toISOString())} ${line}`);
}
