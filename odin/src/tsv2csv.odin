package csv_wasm

import "base:runtime"
import "core:slice"

// TSV/CSV characters
CSV_TAB :: 0x09
CSV_NEWLINE :: 0x0a
CSV_CR :: 0x0d

// Transform TSV to CSV (simple delimiter replacement)
// Converts: \t → separator (comma or custom), strips \r
// Does NOT add CSV quoting - just replaces delimiters
// This produces ambiguous CSV when fields contain the separator
// For proper CSV quoting, use: tsv2record | record2csv
// Returns: number of bytes written
@(export)
tsv_to_csv :: proc "c" (input_ptr: rawptr, input_len: int, output_ptr: rawptr, output_capacity: int, separator: u8) -> int {
	context = runtime.default_context()
	
	input := slice.from_ptr(cast(^u8)input_ptr, input_len)
	output := slice.from_ptr(cast(^u8)output_ptr, output_capacity)
	
	out_pos := 0
	
	// Simple character replacement: tab → separator, strip \r
	for i := 0; i < input_len; i += 1 {
		c := input[i]
		if c == CSV_TAB {
			if out_pos >= output_capacity do return -1
			output[out_pos] = separator
			out_pos += 1
		} else if c != CSV_CR {
			if out_pos >= output_capacity do return -1
			output[out_pos] = c
			out_pos += 1
		}
	}
	
	return out_pos
}
