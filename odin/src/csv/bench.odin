package csv

import "core:fmt"
import "core:os"
import "core:time"
import core_csv "core:encoding/csv"

main :: proc() {
    if len(os.args) < 2 {
        fmt.eprintln("Usage: csv_bench <file.csv>")
        os.exit(1)
    }
    
    data, ok := os.read_entire_file(os.args[1])
    if !ok {
        fmt.eprintln("Failed to read file")
        os.exit(1)
    }
    defer delete(data)
    
    mb := f64(len(data)) / 1024 / 1024
    fmt.printf("File: %s (%.1f MB)\n\n", os.args[1], mb)
    
    // Benchmark core:csv
    {
        sw := time.Stopwatch{}
        time.stopwatch_start(&sw)
        
        reader := core_csv.Reader{}
        core_csv.reader_init_with_string(&reader, string(data))
        defer core_csv.reader_destroy(&reader)
        
        row_count := 0
        field_count := 0
        for record in core_csv.iterator_next(&reader) {
            row_count += 1
            field_count += len(record)
        }
        
        time.stopwatch_stop(&sw)
        elapsed := time.duration_seconds(time.stopwatch_duration(sw))
        fmt.printf("core:csv       : %.0f MB/s (%d rows, %d fields, %.1f ms)\n", 
            mb / elapsed, row_count, field_count, elapsed * 1000)
    }
    
    // Benchmark custom DelimitedParser -> split to strings
    {
        sw := time.Stopwatch{}
        time.stopwatch_start(&sw)
        
        p := delimited_init()
        defer delimited_destroy(&p)
        
        delimited_parse(&p, data)
        delimited_finish(&p)
        
        // Convert output to string slices (like JS would)
        output := p.output[:]
        row_count := 0
        field_count := 0
        
        row_start := 0
        for i := 0; i < len(output); i += 1 {
            if output[i] == RECORD_SEP {
                row := output[row_start:i]
                row_count += 1
                
                // Count fields by splitting on FIELD_SEP
                fields := 1
                for b in row {
                    if b == FIELD_SEP do fields += 1
                }
                field_count += fields
                row_start = i + 1
            }
        }
        
        time.stopwatch_stop(&sw)
        elapsed := time.duration_seconds(time.stopwatch_duration(sw))
        fmt.printf("DelimitedParser: %.0f MB/s (%d rows, %d fields, %.1f ms)\n", 
            mb / elapsed, row_count, field_count, elapsed * 1000)
    }
}
