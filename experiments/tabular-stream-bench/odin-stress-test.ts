import { enumerate } from "jsr:@j50n/proc";
import { format as formatBytes } from "jsr:@std/fmt/bytes";
import { StringRow } from "../../src/data-transform/string-row.ts";
import { generateTestRow, rowToCsv } from "./test-data-generator.ts";

// Create StringRow decoder transform
function createStringRowDecoder() {
    let buffer = new Uint8Array(0);
    
    return new TransformStream<Uint8Array, string[]>({
        transform(chunk, controller) {
            // Append new data to buffer
            const newBuffer = new Uint8Array(buffer.length + chunk.length);
            newBuffer.set(buffer);
            newBuffer.set(chunk, buffer.length);
            buffer = newBuffer;
            
            // Process complete StringRow messages
            while (buffer.length >= 4) {
                const length = new DataView(buffer.buffer, buffer.byteOffset).getUint32(0, true);
                
                if (buffer.length >= 4 + length) {
                    // Extract StringRow data
                    const stringRowData = buffer.slice(4, 4 + length);
                    buffer = buffer.slice(4 + length);
                    
                    // Deserialize StringRow
                    const stringRow = StringRow.fromBytes(stringRowData);
                    const columns = stringRow.toArray();
                    controller.enqueue(columns);
                } else {
                    break; // Need more data
                }
            }
        }
    });
}

async function stressTest() {
    console.log("Starting Odin child process stress test...");
    
    const PROGRESS_INTERVAL = 1_000_000; // Report every 1M lines
    const TARGET_DATA_SIZE = 10 * 1024 * 1024 * 1024; // 10GB target
    const startTime = Date.now();
    
    // Generator that counts from 1 upward indefinitely
    const lineNumberGenerator = function* () {
        let i = 1;
        while (true) {
            yield i++;
        }
    };
    
    let processedLines = 0;
    let errors = 0;
    let lastLineNumber = 0;
    let bytesProcessed = 0;
    let childProcess: Deno.ChildProcess | null = null;
    
    try {
        const command = new Deno.Command("./implementations/process-odin/build/child_process", {
            stdin: "piped",
            stdout: "piped",
            stderr: "piped"
        });
        
        childProcess = command.spawn();
        const childPid = childProcess.pid;
        
        // Memory monitoring function
        const getMemoryUsage = async () => {
            try {
                const proc = new Deno.Command("ps", {
                    args: ["-o", "rss=", "-p", childPid.toString()],
                    stdout: "piped"
                });
                const result = await proc.output();
                if (result.success) {
                    const rssKb = parseInt(new TextDecoder().decode(result.stdout).trim());
                    return rssKb * 1024; // Convert KB to bytes
                }
            } catch {
                // Ignore errors
            }
            return 0;
        };
        
        // Start memory monitoring with initial delay
        let maxMemory = 0;
        const memoryMonitor = setInterval(async () => {
            const memory = await getMemoryUsage();
            if (memory > maxMemory) {
                maxMemory = memory;
            }
        }, 500); // Check every 500ms for better granularity
        
        const writer = childProcess.stdin.getWriter();
        const reader = childProcess.stdout
            .pipeThrough(createStringRowDecoder())
            .getReader();
        
        // Start writing data continuously until 10GB processed
        const writePromise = (async () => {
            try {
                let lineNumber = 1;
                while (bytesProcessed < TARGET_DATA_SIZE) {
                    const row = generateTestRow(lineNumber);
                    const csvLine = rowToCsv(row) + '\n';
                    bytesProcessed += new TextEncoder().encode(csvLine).length;
                    
                    await writer.write(new TextEncoder().encode(csvLine));
                    lineNumber++;
                }
            } catch (error) {
                if (error.name !== "BrokenPipe") {
                    throw error;
                }
            } finally {
                try {
                    await writer.close();
                } catch {
                    // Ignore close errors
                }
            }
        })();
        
        // Read and validate data
        const readPromise = (async () => {
            try {
                while (true) {
                    const { done, value: actualRow } = await reader.read();
                    if (done) break;
                    
                    // Get line number and generate expected row
                    const lineNumber = parseInt(actualRow[0]);
                    const expectedRow = generateTestRow(lineNumber);
                    
                    // Check line number sequence
                    if (lineNumber !== lastLineNumber + 1) {
                        console.error(`Line number sequence error: expected ${lastLineNumber + 1}, got ${lineNumber}`);
                        errors++;
                    }
                    lastLineNumber = lineNumber;
                    
                    // Compare rows
                    if (actualRow.length !== expectedRow.length) {
                        console.error(`Line ${lineNumber}: Column count mismatch - expected ${expectedRow.length}, got ${actualRow.length}`);
                        errors++;
                    } else {
                        for (let i = 0; i < expectedRow.length; i++) {
                            if (actualRow[i] !== expectedRow[i]) {
                                console.error(`Line ${lineNumber}, Column ${i}: Content mismatch`);
                                console.error(`Expected: ${JSON.stringify(expectedRow[i])}`);
                                console.error(`Actual:   ${JSON.stringify(actualRow[i])}`);
                                errors++;
                                break;
                            }
                        }
                    }
                    
                    processedLines++;
                    
                    // Progress report with memory usage
                    if (processedLines % PROGRESS_INTERVAL === 0) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        const timestamp = new Date().toISOString();
                        const bytesFormatted = formatBytes(bytesProcessed);
                        const currentMemory = await getMemoryUsage();
                        const memoryFormatted = formatBytes(currentMemory);
                        const maxMemoryFormatted = formatBytes(maxMemory);
                        const linesPerSec = Math.round(processedLines / elapsed);
                        console.log(`${timestamp}: ${elapsed.toFixed(1)}s - ${(processedLines/1000000).toFixed(1)}M lines (${(linesPerSec/1000).toFixed(1)}K/s), ${bytesFormatted}, ${errors} errors, Memory: ${memoryFormatted} (max: ${maxMemoryFormatted})`);
                    }
                }
            } catch (error) {
                console.error("Read error:", error);
            }
        })();
        
        await Promise.race([writePromise, readPromise]);
        console.log("One of the promises completed");
        await childProcess.status;
        console.log("Child process exited");
        
        clearInterval(memoryMonitor);
        
        const totalTime = (Date.now() - startTime) / 1000;
        const avgThroughput = Math.round(processedLines / totalTime);
        
        console.log(`\nStress test completed after ${totalTime.toFixed(1)} seconds!`);
        console.log(`Processed: ${(processedLines/1000000).toFixed(1)}M lines`);
        console.log(`Throughput: ${(avgThroughput/1000).toFixed(1)}K lines/sec`);
        console.log(`Data size: ${formatBytes(bytesProcessed)}`);
        console.log(`Errors: ${errors}`);
        console.log(`Peak memory usage: ${formatBytes(maxMemory)}`);
        
        if (errors === 0) {
            console.log("✅ All data processed correctly!");
        } else {
            console.log("❌ Test failed");
            Deno.exit(1);
        }
        
    } catch (error) {
        console.error("Error during stress test:", error);
        if (childProcess) {
            childProcess.kill();
        }
        Deno.exit(1);
    }
}

if (import.meta.main) {
    await stressTest();
}
