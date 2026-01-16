package csv_wasm

import "base:runtime"
import "core:slice"

// Transform TSV directly to lazyrow binary format
// Parses TSV (splits on tabs/newlines, strips \r) and encodes to lazyrow
// Returns: number of bytes written to output buffer
@(export)
tsv_to_lazyrow :: proc "c" (input_ptr: rawptr, input_len: int, output_ptr: rawptr, output_capacity: int) -> int {
	context = runtime.default_context()
	
	input := slice.from_ptr(cast(^u8)input_ptr, input_len)
	output := slice.from_ptr(cast(^u8)output_ptr, output_capacity)
	
	TAB :: 0x09
	NEWLINE :: 0x0a
	CR :: 0x0d
	
	out_pos := 0
	field_start := 0
	field_count := 0
	field_starts: [1024]int  // Fixed buffer for field positions (max 1024 fields per row)
	field_ends: [1024]int
	
	for i := 0; i <= input_len; i += 1 {
		is_tab := i < input_len && input[i] == TAB
		is_newline := i < input_len && input[i] == NEWLINE
		is_end := i == input_len
		
		if is_tab || is_newline || is_end {
			// Skip if we're at end and field_start is beyond input
			if is_end && field_start >= input_len {
				break
			}
			
			// Record field boundaries
			field_starts[field_count] = field_start
			field_ends[field_count] = i
			field_count += 1
			
			// End of row - encode to lazyrow
			if is_newline || (is_end && field_count > 0) {
				// Calculate field lengths (excluding \r)
				field_lens: [1024]int
				data_size := 0
				for k := 0; k < field_count; k += 1 {
					field_len := 0
					for j := field_starts[k]; j < field_ends[k]; j += 1 {
						if input[j] != CR {
							field_len += 1
						}
					}
					field_lens[k] = field_len
					data_size += field_len
				}
				
				// Row format: [row_length: u32][field_count: u32][field_lengths: u32[]...][field_data: bytes...]
				row_length := u32(4 + 4 * field_count + data_size)
				header_size := 4 + 4 + 4 * field_count
				
				if out_pos + header_size + data_size > output_capacity {
					return -1
				}
				
				// Write row_length
				output[out_pos] = u8(row_length)
				output[out_pos + 1] = u8(row_length >> 8)
				output[out_pos + 2] = u8(row_length >> 16)
				output[out_pos + 3] = u8(row_length >> 24)
				out_pos += 4
				
				// Write field_count
				fc := u32(field_count)
				output[out_pos] = u8(fc)
				output[out_pos + 1] = u8(fc >> 8)
				output[out_pos + 2] = u8(fc >> 16)
				output[out_pos + 3] = u8(fc >> 24)
				out_pos += 4
				
				// Write field lengths
				for k := 0; k < field_count; k += 1 {
					fl := u32(field_lens[k])
					output[out_pos] = u8(fl)
					output[out_pos + 1] = u8(fl >> 8)
					output[out_pos + 2] = u8(fl >> 16)
					output[out_pos + 3] = u8(fl >> 24)
					out_pos += 4
				}
				
				// Write field data (strip \r)
				for k := 0; k < field_count; k += 1 {
					for j := field_starts[k]; j < field_ends[k]; j += 1 {
						if input[j] != CR {
							output[out_pos] = input[j]
							out_pos += 1
						}
					}
				}
				
				field_count = 0
			}
			
			field_start = i + 1
		}
	}
	
	return out_pos
}
