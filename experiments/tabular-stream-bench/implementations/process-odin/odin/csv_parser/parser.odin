package csv_parser

import "core:encoding/csv"
import "core:io"
import "core:os"
import "core:strings"
import "core:bytes"
import "core:mem"
import "../string_row"

// Parse CSV from string and convert to StringRow format
parse_csv_string_to_string_rows :: proc(csv_text: string, allocator := context.allocator) -> (rows: [dynamic][]u8, ok: bool) {
    // Parse CSV
    csv_records, parse_err := csv.read_all_from_string(csv_text, allocator)
    if parse_err != nil {
        return {}, false
    }
    defer {
        for record in csv_records {
            delete(record)
        }
        delete(csv_records)
    }
    
    // Convert each record to StringRow
    rows = make([dynamic][]u8, 0, len(csv_records), allocator)
    
    for record in csv_records {
        serialized := string_row.serialize(record, allocator)
        append(&rows, serialized)
    }
    
    return rows, true
}

// Parse CSV from reader and convert to StringRow format
parse_csv_to_string_rows :: proc(reader: io.Reader, allocator := context.allocator) -> (rows: [dynamic][]u8, ok: bool) {
    // Read all input into a buffer
    buf: bytes.Buffer
    defer bytes.buffer_destroy(&buf)
    
    _, copy_err := io.copy(bytes.buffer_to_stream(&buf), reader)
    if copy_err != nil {
        return {}, false
    }
    
    input_text := bytes.buffer_to_string(&buf)
    return parse_csv_string_to_string_rows(input_text, allocator)
}

// Streaming CSV processing with temp allocator
process_csv_stdin_streaming_with_temp :: proc() -> bool {
    stdin_reader := os.stream_from_handle(os.stdin)
    stdout_writer := os.stream_from_handle(os.stdout)
    
    // Buffered writer for efficient output
    stdout_buf: bytes.Buffer
    defer {
        // Flush any remaining data
        io.write(stdout_writer, bytes.buffer_to_bytes(&stdout_buf))
        bytes.buffer_destroy(&stdout_buf)
    }
    
    // CSV reader directly from stdin
    csv_reader: csv.Reader
    csv.reader_init(&csv_reader, stdin_reader)
    defer csv.reader_destroy(&csv_reader)  // Clean up CSV reader
    csv_reader.reuse_record = true   // Reuse record array to prevent leaks
    csv_reader.reuse_record_buffer = true  // Reuse internal buffers
    
    // Process CSV row by row with temp allocator
    temp_allocator_bytes := 0
    for {
        // Read one CSV record from stdin
        record, parse_err := csv.read(&csv_reader)
        if parse_err != nil do break
        
        // Serialize using temp allocator - no need to free!
        serialized := string_row.serialize(record, context.temp_allocator)
        temp_allocator_bytes += len(serialized)
        
        // Write to buffer
        length := cast(u32)len(serialized)
        length_bytes := transmute([4]u8)length
        
        bytes.buffer_write(&stdout_buf, length_bytes[:])
        bytes.buffer_write(&stdout_buf, serialized)
        
        // Clear temp allocator every 256KB of data to prevent memory leak
        if temp_allocator_bytes >= 256 * 1024 {
            free_all(context.temp_allocator)
            temp_allocator_bytes = 0
        }
        
        // Flush buffer when it gets large and recreate to prevent memory growth
        if bytes.buffer_length(&stdout_buf) >= 256 * 1024 {
            io.write(stdout_writer, bytes.buffer_to_bytes(&stdout_buf))
            bytes.buffer_destroy(&stdout_buf)  // Destroy and recreate to free memory
            stdout_buf = bytes.Buffer{}        // Create new buffer
        }
    }
    
    return true
}
