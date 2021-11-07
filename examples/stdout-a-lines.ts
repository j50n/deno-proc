#!/usr/bin/env -S deno run --allow-run=ls --quiet

import { Proc } from "../proc.ts";

/*
 * List the files in the current directory, line by line. 
 */

for await (const line of new Proc({cmd: ["ls", "-la"]}).stdoutLines()){
    console.log(line);
}