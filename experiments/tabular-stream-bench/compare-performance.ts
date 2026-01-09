#!/usr/bin/env -S deno run --allow-run --allow-read

async function runBenchmark(implementation: string, dataFile: string) {
    const format = dataFile.includes('.csv') ? 'csv' : 'tsv';
    const args = (implementation === 'process-ts' || implementation === 'control-group')
        ? ["run", "--allow-run", "--allow-read", "benchmark.ts", `../../${dataFile}`, format]
        : ["run", "--allow-run", "--allow-read", "benchmark.ts", `../../${dataFile}`];
    
    const cmd = new Deno.Command("deno", {
        args,
        cwd: `implementations/${implementation}`,
        stdout: "piped",
        stderr: "piped"
    });
    
    try {
        const result = await cmd.output();
        if (result.success) {
            return JSON.parse(new TextDecoder().decode(result.stdout));
        } else {
            console.error(`${implementation} failed:`, new TextDecoder().decode(result.stderr));
            return null;
        }
    } catch (error) {
        console.error(`${implementation} error:`, error);
        return null;
    }
}

async function comparePerformance() {
    const implementations = ["process-odin", "process-ts", "control-group"];
    const dataFiles = ["data/csv/data_10cols.csv"];
    
    console.log("Performance Comparison Results\n");
    console.log("Implementation".padEnd(15), "Rows/sec".padEnd(12), "MB/sec".padEnd(10), "Duration(ms)".padEnd(12), "Rows".padEnd(10), "Mismatches".padEnd(10));
    console.log("=".repeat(80));
    
    for (const dataFile of dataFiles) {
        console.log(`\n${dataFile}:`);
        
        for (const impl of implementations) {
            const result = await runBenchmark(impl, dataFile);
            if (result) {
                const rowsPerSec = Math.round(result.throughputRowsPerSec).toLocaleString();
                const mbPerSec = result.throughputMBPerSec.toFixed(1);
                const duration = Math.round(result.durationMs);
                const rows = result.rowsProcessed.toLocaleString();
                const mismatches = result.columnMismatches || 0;
                
                console.log(
                    impl.padEnd(15),
                    rowsPerSec.padEnd(12),
                    mbPerSec.padEnd(10),
                    duration.toString().padEnd(12),
                    rows.padEnd(10),
                    mismatches.toString().padEnd(10)
                );
            }
        }
    }
}

if (import.meta.main) {
    await comparePerformance();
}
