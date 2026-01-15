package main

import "base:runtime"
import "core:slice"

main :: proc() {}

// Allocate buffer for processing
@(export)
allocate_correct :: proc "c" (size: int) -> rawptr {
	context = runtime.default_context()
	return raw_data(make([]byte, size))
}

// Free allocated buffer
@(export)
deallocate_correct :: proc "c" (ptr: rawptr, size: int) {
	context = runtime.default_context()
	// Memory freed when Odin's allocator reuses it
}

// Transform record format to TSV with validation and record tracking
// Replaces 0x1f (field separator) with 0x09 (tab)
// Replaces 0x1e (record separator) with 0x0a (newline)
// Returns record number (1-based) if invalid characters found (0x09, 0x0d, 0x0a)
// Returns 0 if successful
@(export)
record_to_tsv_correct :: proc "c" (ptr: rawptr, length: int) -> int {
	context = runtime.default_context()
	data := slice.from_ptr(cast(^u8)ptr, length)
	
	record_num := 1  // 1-based record numbering
	
	for i in 0..<length {
		if data[i] == 0x1f {
			data[i] = 0x09  // Field separator → tab
		} else if data[i] == 0x1e {
			data[i] = 0x0a  // Record separator → newline
			record_num += 1  // Moving to next record
		} else if data[i] == 0x09 || data[i] == 0x0d || data[i] == 0x0a {
			return record_num  // Return record number where error found
		}
	}
	
	return 0  // Success
}
