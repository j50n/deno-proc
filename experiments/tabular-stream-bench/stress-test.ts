import * as proc from "jsr:@j50n/proc";
import { StringRow } from "../../src/data-transform/string-row.ts";

// Add seedrandom for deterministic random generation
declare global {
    namespace Math {
        function seedrandom(seed: number): () => number;
    }
}

// Simple seedrandom implementation
Math.seedrandom = function(seed: number) {
    let state = seed;
    return function() {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
};

// Generate deterministic test data for a given line number
function generateTestRow(lineNumber: number): string[] {
    const rng = new Math.seedrandom(lineNumber + 7);
    
    const columns = [
        lineNumber.toString(), // First column is line number
    ];
    
    // Generate 9 more columns with various challenging content
    for (let col = 1; col < 10; col++) {
        let content = "";
        const contentLength = Math.floor(rng() * 50) + 10; // 10-59 chars
        
        for (let i = 0; i < contentLength; i++) {
            const charType = Math.floor(rng() * 8);
            
            switch (charType) {
                case 0: // ASCII letters
                    content += String.fromCharCode(65 + Math.floor(rng() * 26));
                    break;
                case 1: // ASCII digits
                    content += String.fromCharCode(48 + Math.floor(rng() * 10));
                    break;
                case 2: // Unicode above 127
                    content += String.fromCharCode(128 + Math.floor(rng() * 1000));
                    break;
                case 3: // Emoji range (above 65535)
                    const emojiCode = 0x1F600 + Math.floor(rng() * 100); // Emoji range
                    content += String.fromCodePoint(emojiCode);
                    break;
                case 4: // Problematic CSV characters
                    const problemChars = [',', '"', '\t', '\n'];
                    content += problemChars[Math.floor(rng() * problemChars.length)];
                    break;
                case 5: // Spaces
                    content += ' ';
                    break;
                case 6: // Special punctuation
                    content += '!@#$%^&*()[]{}|\\:;<>?/~`'[Math.floor(rng() * 25)];
                    break;
                case 7: // More Unicode (various ranges)
                    content += String.fromCharCode(0x100 + Math.floor(rng() * 0x1000));
                    break;
            }
        }
        
        columns.push(content);
    }
    
    return columns;
}

// Convert row to CSV format with proper escaping
function rowToCsv(row: string[]): string {
    return row.map(field => {
        // Escape fields that contain commas, quotes, or newlines
        if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\t')) {
            return '"' + field.replace(/"/g, '""') + '"';
        }
        return field;
    }).join(',');
}

async function stressTest() {
    console.log("Starting 10GB CSV stress test...");
    
    const TARGET_SIZE_GB = 0.1; // Start with 100MB for testing
    const TARGET_SIZE_BYTES = TARGET_SIZE_GB * 1024 * 1024 * 1024;
    const PROGRESS_INTERVAL = 100_000; // Report every 100K lines for testing
    
    let totalBytesGenerated = 0;
    let lineNumber = 1;
    let processedLines = 0;
    let errors = 0;
    
    try {
        // Generate CSV data as async iterable
        const csvGenerator = async function* () {
            while (totalBytesGenerated < TARGET_SIZE_BYTES) {
                const row = generateTestRow(lineNumber);
                const csvLine = rowToCsv(row) + '\n';
                const csvBytes = new TextEncoder().encode(csvLine);
                
                totalBytesGenerated += csvBytes.length;
                lineNumber++;
                
                // Progress report for generation
                if (lineNumber % PROGRESS_INTERVAL === 0) {
                    const timestamp = new Date().toISOString();
                    const mbGenerated = (totalBytesGenerated / (1024 * 1024)).toFixed(2);
                    console.log(`${timestamp}: Generated ${lineNumber.toLocaleString()} lines (${mbGenerated} MB)`);
                }
                
                yield csvBytes;
            }
        };
        
        // Generate CSV data and write to temp file, then pipe through process
        const tempFile = await Deno.makeTempFile({ suffix: ".csv" });
        
        try {
            const file = await Deno.open(tempFile, { write: true });
            const writer = file.writable.getWriter();
            
            for await (const chunk of csvGenerator()) {
                await writer.write(chunk);
            }
            
            await writer.close();
            await file.close();
            
            // Use proc to pipe the file through the Odin process
            const result = await proc.run("cat", tempFile)
                .run("./implementations/process-odin/build/child_process")
                .bytes
                .collect();
        
        // Combine all output chunks
        const totalOutputSize = result.reduce((sum, chunk) => sum + chunk.length, 0);
        const buffer = new Uint8Array(totalOutputSize);
        let offset = 0;
        for (const chunk of result) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }
        let bufferOffset = 0;
        while (bufferOffset < buffer.length) {
            if (buffer.length - bufferOffset < 4) break;
            
            const length = new DataView(buffer.buffer, buffer.byteOffset + bufferOffset).getUint32(0, true);
            bufferOffset += 4;
            
            if (buffer.length - bufferOffset < length) break;
            
            // Extract StringRow data
            const stringRowData = buffer.slice(bufferOffset, bufferOffset + length);
            bufferOffset += length;
            
            // Deserialize StringRow
            const stringRow = new StringRow(stringRowData);
            const actualRow = stringRow.getColumns();
            
            // Generate expected row
            const expectedLineNumber = parseInt(actualRow[0]);
            const expectedRow = generateTestRow(expectedLineNumber);
            
            // Compare rows
            if (actualRow.length !== expectedRow.length) {
                console.error(`\nLine ${expectedLineNumber}: Column count mismatch`);
                console.error(`Expected ${expectedRow.length} columns, got ${actualRow.length}`);
                errors++;
            } else {
                for (let i = 0; i < expectedRow.length; i++) {
                    if (actualRow[i] !== expectedRow[i]) {
                        console.error(`\nLine ${expectedLineNumber}, Column ${i}: Content mismatch`);
                        console.error(`Expected: ${JSON.stringify(expectedRow[i])}`);
                        console.error(`Actual:   ${JSON.stringify(actualRow[i])}`);
                        console.error(`Expected length: ${expectedRow[i].length}, Actual length: ${actualRow[i].length}`);
                        errors++;
                        break;
                    }
                }
            }
            
            processedLines++;
            
            // Progress report
            if (processedLines % PROGRESS_INTERVAL === 0) {
                const timestamp = new Date().toISOString();
                console.log(`${timestamp}: Processed ${processedLines.toLocaleString()} lines, ${errors} errors`);
            }
        }
        
        console.log(`\nStress test completed!`);
        console.log(`Generated: ${(lineNumber - 1).toLocaleString()} lines`);
        console.log(`Processed: ${processedLines.toLocaleString()} lines`);
        console.log(`Data size: ${(totalBytesGenerated / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`Errors: ${errors}`);
        
        if (errors === 0 && processedLines === lineNumber - 1) {
            console.log("✅ All data processed correctly!");
        } else {
            console.log("❌ Test failed - data corruption detected");
            Deno.exit(1);
        }
        
        } finally {
            // Clean up temp file
            try {
                await Deno.remove(tempFile);
            } catch {
                // Ignore cleanup errors
            }
        }
        
    } catch (error) {
        console.error("Error during stress test:", error);
        Deno.exit(1);
    }
}

if (import.meta.main) {
    await stressTest();
}
