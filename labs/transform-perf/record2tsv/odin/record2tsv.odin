package main

import "base:runtime"
import "core:slice"

main :: proc() {}

// Allocate buffer for processing
@(export)
allocate :: proc "c" (size: int) -> rawptr {
	context = runtime.default_context()
	return raw_data(make([]byte, size))
}

// Free allocated buffer
@(export)
deallocate :: proc "c" (ptr: rawptr, size: int) {
	context = runtime.default_context()
	// Memory freed when Odin's allocator reuses it
}

// Transform record format to TSV in-place
// Replaces 0x1f (field separator) with 0x09 (tab)
// Replaces 0x1e (record separator) with 0x0a (newline)
@(export)
record_to_tsv :: proc "c" (ptr: rawptr, length: int) {
	context = runtime.default_context()
	data := slice.from_ptr(cast(^u8)ptr, length)
	
	for i in 0..<length {
		if data[i] == 0x1f {
			data[i] = 0x09
		} else if data[i] == 0x1e {
			data[i] = 0x0a
		}
	}
}
