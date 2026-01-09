#!/usr/bin/env -S deno run --allow-read --allow-run

import { read, enumerate } from "@j50n/proc";
import { createStringRowDecoder } from "./mod.ts";

const [filePath, format] = Deno.args;

// Determine expected columns from filename
const expectedColumns = filePath.includes('10cols') ? 10 : 
                       filePath.includes('100cols') ? 100 : 
                       filePath.includes('1000cols') ? 1000 : 0;

// Start CPU monitoring
const parentPid = Deno.pid;
console.error(`Parent PID: ${parentPid}`);

// Function to get CPU usage for a process using top
async function getCpuUsage(pid: number): Promise<number> {
  try {
    const result = await new Deno.Command("top", {
      args: ["-p", pid.toString(), "-n", "1", "-b"],
      stdout: "piped",
      stderr: "piped"
    }).output();
    
    if (result.success) {
      const output = new TextDecoder().decode(result.stdout);
      const lines = output.split('\n');
      
      // Find the line with our PID
      for (const line of lines) {
        if (line.includes(pid.toString())) {
          // Parse CPU percentage from top output
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 9) {
            const cpuStr = parts[8]; // CPU% is typically the 9th column
            const cpu = parseFloat(cpuStr);
            if (!isNaN(cpu)) {
              return cpu;
            }
          }
        }
      }
    }
  } catch {
    // Process might not exist or top failed
  }
  return 0;
}

// Function to find child processes
async function getChildPids(parentPid: number): Promise<number[]> {
  try {
    const result = await new Deno.Command("pgrep", {
      args: ["-P", parentPid.toString()],
      stdout: "piped",
      stderr: "piped"
    }).output();
    
    if (result.success) {
      const output = new TextDecoder().decode(result.stdout).trim();
      return output.split('\n').map(pid => parseInt(pid)).filter(pid => !isNaN(pid));
    }
  } catch {
    // No children or pgrep not available
  }
  return [];
}

// CPU monitoring
let monitoring = true;
const cpuSamples: Array<{time: number, parent: number, child: number}> = [];

const monitorCpu = async () => {
  while (monitoring) {
    const parentCpu = await getCpuUsage(parentPid);
    const childPids = await getChildPids(parentPid);
    
    // Get CPU for the most recent child (there should only be one active CSV parser)
    let childCpu = 0;
    if (childPids.length > 0) {
      // Take the highest CPU child (in case there are multiple)
      const childCpus = await Promise.all(childPids.map(pid => getCpuUsage(pid)));
      childCpu = Math.max(...childCpus);
    }
    
    cpuSamples.push({
      time: performance.now(),
      parent: parentCpu,
      child: childCpu
    });
    
    await new Promise(resolve => setTimeout(resolve, 200)); // Sample every 200ms
  }
};

// Start monitoring in background
const monitorPromise = monitorCpu();

// Warmup
console.error("Warming up...");
if (format === 'csv') {
  let warmupCount = 0;
  await read(filePath)
    .run("deno", "run", "--allow-read", "./csv-parser.ts")
    .transform(createStringRowDecoder())
    .forEach((row) => {
      warmupCount++;
      if (warmupCount >= 1000) return false;
    });
}
console.error("Warmup complete");

const start = performance.now();
let rowCount = 0;
let columnMismatches = 0;

if (format === 'csv') {
  await read(filePath)
    .run("deno", "run", "--allow-read", "./csv-parser.ts")
    .transform(createStringRowDecoder())
    .forEach((row) => {
      rowCount++;
      if (row.length !== expectedColumns) {
        columnMismatches++;
      }
    });
} else {
  throw new Error("TSV not implemented for process-ts");
}

const duration = performance.now() - start;

// Stop monitoring
monitoring = false;
await monitorPromise;

// Analyze CPU usage
const validSamples = cpuSamples.filter(s => s.time >= start && s.time <= start + duration);

if (validSamples.length > 0) {
  const avgParentCpu = validSamples.reduce((sum, s) => sum + s.parent, 0) / validSamples.length;
  const maxParentCpu = Math.max(...validSamples.map(s => s.parent));
  
  const avgChildCpu = validSamples.reduce((sum, s) => sum + s.child, 0) / validSamples.length;
  const maxChildCpu = Math.max(...validSamples.map(s => s.child));
  
  console.error(`\n=== CPU Usage Analysis ===`);
  console.error(`Parent Process (avg/max): ${avgParentCpu.toFixed(1)}% / ${maxParentCpu.toFixed(1)}%`);
  console.error(`Child Process (avg/max): ${avgChildCpu.toFixed(1)}% / ${maxChildCpu.toFixed(1)}%`);
  console.error(`Total CPU Usage (avg/max): ${(avgParentCpu + avgChildCpu).toFixed(1)}% / ${(maxParentCpu + maxChildCpu).toFixed(1)}%`);
  
  if (avgChildCpu > avgParentCpu * 1.5) {
    console.error(`Bottleneck: Child process (CSV parsing)`);
  } else if (avgParentCpu > avgChildCpu * 1.5) {
    console.error(`Bottleneck: Parent process (IPC/deserialization)`);
  } else {
    console.error(`Bottleneck: Balanced load`);
  }

  const fileSize = (await Deno.stat(filePath)).size;

  console.log(JSON.stringify({
    implementation: 'process-ts',
    format,
    columns: expectedColumns,
    rowsProcessed: rowCount,
    columnMismatches,
    durationMs: duration,
    memoryPeakMB: 0,
    throughputRowsPerSec: rowCount / (duration / 1000),
    throughputMBPerSec: (fileSize / 1024 / 1024) / (duration / 1000),
    cpuUsage: {
      parentAvg: avgParentCpu,
      parentMax: maxParentCpu,
      childAvg: avgChildCpu,
      childMax: maxChildCpu
    }
  }));
} else {
  const fileSize = (await Deno.stat(filePath)).size;
  console.log(JSON.stringify({
    implementation: 'process-ts',
    format,
    columns: expectedColumns,
    rowsProcessed: rowCount,
    columnMismatches,
    durationMs: duration,
    memoryPeakMB: 0,
    throughputRowsPerSec: rowCount / (duration / 1000),
    throughputMBPerSec: (fileSize / 1024 / 1024) / (duration / 1000),
    cpuUsage: null
  }));
}
