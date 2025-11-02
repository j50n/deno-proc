import { enumerate } from "../../mod.ts";

await enumerate(["a", "b", "c"]).map(it => it.toUpperCase()).toStdout();