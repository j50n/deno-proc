package csv_wasm

import "base:runtime"
import "core:slice"

// Convert lazyrow binary format to record format
// LazyRow format: [row_length: u32][field_count: u32][field_lengths: u32[]...][field_data: bytes...]
// Record format: fields separated by 0x1F, records by 0x1E
// Returns: number of bytes written, or -1 if output buffer too small
@(export)
lazyrow_to_record :: proc "c" (input_ptr: rawptr, input_len: int, output_ptr: rawptr, output_capacity: int) -> int {
	context = runtime.default_context()
	
	input := slice.from_ptr(cast(^u8)input_ptr, input_len)
	output := slice.from_ptr(cast(^u8)output_ptr, output_capacity)
	
	FIELD_SEP :: 0x1F
	RECORD_SEP :: 0x1E
	
	in_pos := 0
	out_pos := 0
	
	for in_pos < input_len {
		// Read row_length (skip it, we don't need it)
		if in_pos + 4 > input_len do return -1
		_ = u32(input[in_pos]) | (u32(input[in_pos + 1]) << 8) | (u32(input[in_pos + 2]) << 16) | (u32(input[in_pos + 3]) << 24)
		in_pos += 4
		
		// Read field_count
		if in_pos + 4 > input_len do return -1
		field_count := u32(input[in_pos]) | (u32(input[in_pos + 1]) << 8) | (u32(input[in_pos + 2]) << 16) | (u32(input[in_pos + 3]) << 24)
		in_pos += 4
		
		// Read field lengths
		field_lens: [1024]u32
		if int(field_count) > len(field_lens) do return -1
		
		for i := 0; i < int(field_count); i += 1 {
			if in_pos + 4 > input_len do return -1
			field_lens[i] = u32(input[in_pos]) | (u32(input[in_pos + 1]) << 8) | (u32(input[in_pos + 2]) << 16) | (u32(input[in_pos + 3]) << 24)
			in_pos += 4
		}
		
		// Write fields to output
		for i := 0; i < int(field_count); i += 1 {
			// Add field separator (except before first field)
			if i > 0 {
				if out_pos >= output_capacity do return -1
				output[out_pos] = FIELD_SEP
				out_pos += 1
			}
			
			// Copy field data
			field_len := int(field_lens[i])
			if in_pos + field_len > input_len do return -1
			if out_pos + field_len > output_capacity do return -1
			
			copy(output[out_pos:], input[in_pos:in_pos + field_len])
			in_pos += field_len
			out_pos += field_len
		}
		
		// Add record separator
		if out_pos >= output_capacity do return -1
		output[out_pos] = RECORD_SEP
		out_pos += 1
	}
	
	return out_pos
}
