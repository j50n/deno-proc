#!/usr/bin/env -S deno run --allow-read --allow-run

// Simple test to see what's happening with CPU monitoring
const parentPid = Deno.pid;
console.log(`Parent PID: ${parentPid}`);

// Start the CSV parser process
const process = new Deno.Command("deno", {
  args: ["run", "--allow-read", "./csv-parser.ts"],
  stdin: "piped",
  stdout: "piped",
  stderr: "piped"
});

const child = process.spawn();
console.log(`Child PID: ${child.pid}`);

// Monitor for a few seconds
for (let i = 0; i < 10; i++) {
  // Use ps with different options
  try {
    const result = await new Deno.Command("ps", {
      args: ["-p", child.pid.toString(), "-o", "pid,pcpu,pmem,time,cmd"],
      stdout: "piped"
    }).output();
    
    if (result.success) {
      const output = new TextDecoder().decode(result.stdout);
      console.log(`Sample ${i + 1}:`);
      console.log(output);
    }
  } catch (e) {
    console.log(`Error: ${e}`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Clean up
child.kill();
