package csv_wasm

import "base:runtime"
import "core:slice"

// TSV/CSV characters
CSV_TAB :: 0x09
CSV_NEWLINE :: 0x0a
CSV_CR :: 0x0d

// Transform TSV to CSV with proper RFC 4180 quoting
// Converts: \t → separator (comma or custom), strips \r
// Adds quotes when fields contain separator, quotes, or newlines
// Returns: number of bytes written, or -1 if output buffer too small
@(export)
tsv_to_csv :: proc "c" (input_ptr: rawptr, input_len: int, output_ptr: rawptr, output_capacity: int, separator: u8, always_quote: i32, crlf: i32) -> int {
	context = runtime.default_context()
	
	input := slice.from_ptr(cast(^u8)input_ptr, input_len)
	output := slice.from_ptr(cast(^u8)output_ptr, output_capacity)
	
	out_pos := 0
	field_start := 0
	first_field_in_row := true
	line_end := crlf != 0 ? "\r\n" : "\n"
	
	for i := 0; i <= input_len; i += 1 {
		is_tab := i < input_len && input[i] == CSV_TAB
		is_newline := i < input_len && input[i] == CSV_NEWLINE
		is_end := i == input_len
		
		if is_tab || is_newline || (is_end && field_start < input_len) {
			// Add separator before field (except first in row)
			if !first_field_in_row {
				if out_pos >= output_capacity do return -1
				output[out_pos] = separator
				out_pos += 1
			}
			first_field_in_row = false
			
			// Check if field needs quoting
			field_len := i - field_start
			needs_quote := always_quote != 0
			
			if !needs_quote && field_len > 0 {
				for j := field_start; j < i; j += 1 {
					b := input[j]
					// CR doesn't require quoting, just skip it
					if b == separator || b == '"' || b == CSV_NEWLINE {
						needs_quote = true
						break
					}
				}
			}
			
			// Write field
			if needs_quote {
				if out_pos >= output_capacity do return -1
				output[out_pos] = '"'
				out_pos += 1
				
				// Check if field contains CR (rare in modern data)
				has_cr := false
				for j := field_start; j < i; j += 1 {
					if input[j] == CSV_CR {
						has_cr = true
						break
					}
				}
				
				if has_cr {
					// Slow path: skip CR while copying
					for j := field_start; j < i; j += 1 {
						b := input[j]
						if b == CSV_CR do continue
						
						if b == '"' {
							if out_pos + 2 > output_capacity do return -1
							output[out_pos] = '"'
							output[out_pos + 1] = '"'
							out_pos += 2
						} else {
							if out_pos >= output_capacity do return -1
							output[out_pos] = b
							out_pos += 1
						}
					}
				} else {
					// Fast path: no CR to skip
					for j := field_start; j < i; j += 1 {
						b := input[j]
						if b == '"' {
							if out_pos + 2 > output_capacity do return -1
							output[out_pos] = '"'
							output[out_pos + 1] = '"'
							out_pos += 2
						} else {
							if out_pos >= output_capacity do return -1
							output[out_pos] = b
							out_pos += 1
						}
					}
				}
				
				if out_pos >= output_capacity do return -1
				output[out_pos] = '"'
				out_pos += 1
			} else {
				// Unquoted field - copy directly (skip \r if present)
				if field_len > 0 {
					// Fast path: check if field contains CR
					has_cr := false
					for j := field_start; j < i; j += 1 {
						if input[j] == CSV_CR {
							has_cr = true
							break
						}
					}
					
					if has_cr {
						// Slow path: copy byte-by-byte, skipping CR
						for j := field_start; j < i; j += 1 {
							b := input[j]
							if b == CSV_CR do continue
							if out_pos >= output_capacity do return -1
							output[out_pos] = b
							out_pos += 1
						}
					} else {
						// Fast path: bulk copy
						if out_pos + field_len > output_capacity do return -1
						copy(output[out_pos:], input[field_start:i])
						out_pos += field_len
					}
				}
			}
			
			// Handle newline
			if is_newline {
				if out_pos + len(line_end) > output_capacity do return -1
				for k := 0; k < len(line_end); k += 1 {
					output[out_pos] = line_end[k]
					out_pos += 1
				}
				first_field_in_row = true
			}
			
			field_start = i + 1
		}
	}
	
	return out_pos
}
