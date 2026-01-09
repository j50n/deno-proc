package flattext

import "core:encoding/csv"
import "core:mem"
import "core:strings"
import "core:unicode/utf8"
import "base:runtime"

// Output buffer in WASM memory
output_buffer: [64 * 1024]u8
arena_memory: [1024 * 1024]u8
arena: mem.Arena

// Parser configuration
Parser_Config :: struct {
    delimiter:           rune,    // Field delimiter
    comment:             rune,    // Comment character (0 = none)
    fields_per_record:   i32,     // Expected field count
    trim_leading_space:  bool,    // Remove leading whitespace
    lazy_quotes:         bool,    // Allow unescaped quotes
    multiline_fields:    bool,    // Support multiline fields
    replace_tabs:        rune,    // Replacement for embedded tabs (0 = error)
    replace_newlines:    rune,    // Replacement for embedded newlines (0 = error)
}

main :: proc() {}

@(export)
init :: proc() {
    mem.arena_init(&arena, arena_memory[:])
}

@(export)
get_output_ptr :: proc() -> rawptr {
    return raw_data(output_buffer[:])
}

@(export)
csv_to_tsv :: proc "contextless" (input_ptr: rawptr, input_len: i32) -> i32 {
    context = runtime.default_context()
    context.allocator = mem.arena_allocator(&arena)
    
    // Clear arena for fresh allocation
    mem.arena_free_all(&arena)
    
    input_bytes := ([^]u8)(input_ptr)[:input_len]
    input_str := string(input_bytes)
    
    records, err := csv.read_all_from_string(input_str, context.allocator)
    if err != nil {
        return -1
    }
    
    output_len := 0
    for record in records {
        for field_idx in 0..<len(record) {
            field := record[field_idx]
            if field_idx > 0 {
                output_buffer[output_len] = '\t'
                output_len += 1
            }
            copy_from_string(output_buffer[output_len:], field)
            output_len += len(field)
        }
        output_buffer[output_len] = '\n'
        output_len += 1
    }
    
    return i32(output_len)
}

@(export)
csv_to_tsv_with_config :: proc "contextless" (input_ptr: rawptr, input_len: i32, config_ptr: rawptr) -> i32 {
    context = runtime.default_context()
    context.allocator = mem.arena_allocator(&arena)
    mem.arena_free_all(&arena)
    
    input_bytes := ([^]u8)(input_ptr)[:input_len]
    input_str := string(input_bytes)
    
    config := (^Parser_Config)(config_ptr)^
    
    // For now, just handle delimiter replacement - convert input to use comma delimiter
    modified_input := input_str
    if config.delimiter != ',' {
        // Replace custom delimiter with comma for standard CSV parsing
        delimiter_char := u8(config.delimiter)
        modified_bytes := make([]u8, len(input_bytes), context.allocator)
        copy(modified_bytes, input_bytes)
        
        for i in 0..<len(modified_bytes) {
            if modified_bytes[i] == delimiter_char {
                modified_bytes[i] = ','
            }
        }
        modified_input = string(modified_bytes)
    }
    
    // Handle comment lines - remove them before CSV parsing
    if config.comment != 0 {
        lines := strings.split_lines(modified_input, context.allocator)
        filtered_lines := make([dynamic]string, context.allocator)
        
        for line in lines {
            trimmed := strings.trim_left_space(line)
            if len(trimmed) == 0 || rune(trimmed[0]) != config.comment {
                append(&filtered_lines, line)
            }
        }
        
        modified_input = strings.join(filtered_lines[:], "\n", context.allocator)
    }
    
    // Use standard CSV parsing on modified input
    records, err := csv.read_all_from_string(modified_input, context.allocator)
    if err != nil {
        return -1
    }
    
    // Validate fields per record if specified
    if config.fields_per_record > 0 {
        for record in records {
            if len(record) != int(config.fields_per_record) {
                return -2
            }
        }
    }
    
    // Convert to TSV with config-based replacements
    output_len := 0
    for record in records {
        for field_idx in 0..<len(record) {
            field := record[field_idx]
            
            // Trim leading space if requested
            if config.trim_leading_space {
                field = strings.trim_left_space(field)
            }
            
            if field_idx > 0 {
                output_buffer[output_len] = '\t'
                output_len += 1
            }
            
            // Process field with replacements
            for c in field {
                if c == '\t' {
                    if config.replace_tabs == 0 do return -3
                    output_buffer[output_len] = u8(config.replace_tabs)
                } else if c == '\n' || c == '\r' {
                    if config.replace_newlines == 0 do return -4
                    output_buffer[output_len] = u8(config.replace_newlines)
                } else {
                    // Handle UTF-8 encoding
                    if c <= 127 {
                        output_buffer[output_len] = u8(c)
                    } else {
                        utf8_bytes, byte_count := utf8.encode_rune(c)
                        for i in 0..<byte_count {
                            output_buffer[output_len] = utf8_bytes[i]
                            output_len += 1
                        }
                        continue
                    }
                }
                output_len += 1
            }
        }
        output_buffer[output_len] = '\n'
        output_len += 1
    }
    
    return i32(output_len)
}
