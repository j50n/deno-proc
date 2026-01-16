package csv_wasm

import "core:slice"

// TSV input characters
TSV_TAB :: 0x09
TSV_NEWLINE :: 0x0a
TSV_CR :: 0x0d

// Record format separators
TSV_FIELD_SEPARATOR :: 0x1f
TSV_RECORD_SEPARATOR :: 0x1e

// Transform TSV to record format
// Converts: \t → 0x1F (field separator), \n → 0x1E (record separator)
// Strips: \r (carriage return)
// Returns: new length (may be smaller due to \r stripping)
@(export)
tsv_to_record :: proc "c" (ptr: rawptr, length: int) -> int {
	data := slice.from_ptr(cast(^u8)ptr, length)
	write_pos := 0
	
	for read_pos in 0..<length {
		b := data[read_pos]
		
		switch b {
		case TSV_CR:
			// Skip carriage returns
			continue
			
		case TSV_TAB:
			// Tab → field separator
			data[write_pos] = TSV_FIELD_SEPARATOR
			write_pos += 1
			
		case TSV_NEWLINE:
			// Newline → record separator
			data[write_pos] = TSV_RECORD_SEPARATOR
			write_pos += 1
			
		case:
			// Copy all other bytes unchanged
			data[write_pos] = b
			write_pos += 1
		}
	}
	
	return write_pos
}
