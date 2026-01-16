package main

import "base:runtime"
import "core:slice"
import "core:simd"

main :: proc() {}

// Allocate buffer for processing, rounded up to 16-byte alignment
@(export)
allocate_simd :: proc "c" (size: int) -> rawptr {
	context = runtime.default_context()
	// Round up to next multiple of 16 for SIMD alignment
	aligned_size := ((size + 15) / 16) * 16
	return raw_data(make([]byte, aligned_size))
}

// Free allocated buffer
@(export)
deallocate_simd :: proc "c" (ptr: rawptr, size: int) {
	context = runtime.default_context()
	// Memory freed when Odin's allocator reuses it
}

// Transform record format to TSV in-place using SIMD
// Replaces 0x1f (field separator) with 0x09 (tab)
// Replaces 0x1e (record separator) with 0x0a (newline)
// Processes 16 bytes at a time with 128-bit SIMD vectors
// Assumes buffer is allocated with aligned size (multiple of 16)
//
// NOTE: This is the basic SIMD version without loop unrolling.
// For better performance on modern CPUs (especially AMD Zen with dual-issue SIMD ports),
// see record2tsv-simd-unrolled.odin which uses 4x loop unrolling (64 bytes per iteration).
// Loop unrolling exposes instruction-level parallelism and reduces loop overhead.
@(export)
record_to_tsv_simd :: proc "c" (ptr: rawptr, length: int) {
	context = runtime.default_context()
	
	// SIMD vectors for comparison and replacement
	field_sep := simd.u8x16{0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f,
	                        0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f}
	record_sep := simd.u8x16{0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e,
	                          0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e}
	tab_char := simd.u8x16{0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09,
	                        0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09}
	newline_char := simd.u8x16{0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a,
	                            0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a}
	
	// Process full 16-byte chunks (including padding bytes - we don't care!)
	aligned_length := ((length + 15) / 16) * 16
	data := slice.from_ptr(cast(^u8)ptr, aligned_length)
	
	for i := 0; i < aligned_length; i += 16 {
		// Load 16 bytes
		chunk := (cast(^simd.u8x16)&data[i])^
		
		// Compare with separators (creates boolean masks)
		field_mask := simd.lanes_eq(chunk, field_sep)
		record_mask := simd.lanes_eq(chunk, record_sep)
		
		// Apply replacements: field separator → tab, record separator → newline
		result := simd.select(field_mask, tab_char, chunk)
		result = simd.select(record_mask, newline_char, result)
		
		// Store result back
		(cast(^simd.u8x16)&data[i])^ = result
	}
}
