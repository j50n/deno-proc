package csv_wasm

import "base:runtime"
import "core:slice"

// Record format separators
FIELD_SEPARATOR :: 0x1f
RECORD_SEPARATOR :: 0x1e

// TSV output characters
TAB :: 0x09
NEWLINE :: 0x0a
CR :: 0x0d

// Check if a byte is an invalid character for TSV output
is_invalid_tsv_char :: proc "c" (b: u8) -> bool {
	return b == TAB || b == CR || b == NEWLINE
}

// Allocate buffer
@(export)
allocate :: proc "c" (size: int) -> rawptr {
	context = runtime.default_context()
	return raw_data(make([]byte, size))
}

@(export)
deallocate :: proc "c" (ptr: rawptr, size: int) {
	context = runtime.default_context()
}

// Transform record format to TSV
@(export)
record_to_tsv :: proc "c" (ptr: rawptr, length: int) -> int {
	context = runtime.default_context()
	data := slice.from_ptr(cast(^u8)ptr, length)
	
	for i in 0..<length {
		b := data[i]
		
		if is_invalid_tsv_char(b) {
			return 0  // Invalid input, return 0
		}
		
		if b == FIELD_SEPARATOR {
			data[i] = TAB
		} else if b == RECORD_SEPARATOR {
			data[i] = NEWLINE
		}
	}
	
	return length  // Return output length (same as input for in-place transform)
}
