package main

import "base:runtime"
import "core:slice"
import "core:simd"

main :: proc() {}

// Allocate buffer for processing, rounded up to 64-byte alignment (for 4x unroll)
@(export)
allocate_simd_unrolled :: proc "c" (size: int) -> rawptr {
	context = runtime.default_context()
	// Round up to next multiple of 64 for 4x SIMD unrolling
	aligned_size := ((size + 63) / 64) * 64
	return raw_data(make([]byte, aligned_size))
}

// Free allocated buffer
@(export)
deallocate_simd_unrolled :: proc "c" (ptr: rawptr, size: int) {
	context = runtime.default_context()
	// Memory freed when Odin's allocator reuses it
}

// Transform record format to TSV in-place using SIMD with 4x loop unrolling
// Processes 64 bytes per iteration (4 × 16-byte SIMD vectors)
// Assumes buffer is allocated with aligned size (multiple of 64)
@(export)
record_to_tsv_simd_unrolled :: proc "c" (ptr: rawptr, length: int) {
	context = runtime.default_context()
	
	// SIMD vectors for comparison and replacement
	record_sep := simd.u8x16{0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e,
	                          0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e}
	tab_char := simd.u8x16{0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09,
	                        0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09}
	
	// Process full 64-byte chunks (4x unrolled, including padding bytes)
	aligned_length := ((length + 63) / 64) * 64
	data := slice.from_ptr(cast(^u8)ptr, aligned_length)
	
	for i := 0; i < aligned_length; i += 64 {
		// Process 4 × 16-byte vectors per iteration
		
		// Vector 0
		chunk0 := (cast(^simd.u8x16)&data[i])^
		mask0 := simd.lanes_eq(chunk0, record_sep)
		result0 := simd.select(mask0, tab_char, chunk0)
		(cast(^simd.u8x16)&data[i])^ = result0
		
		// Vector 1
		chunk1 := (cast(^simd.u8x16)&data[i + 16])^
		mask1 := simd.lanes_eq(chunk1, record_sep)
		result1 := simd.select(mask1, tab_char, chunk1)
		(cast(^simd.u8x16)&data[i + 16])^ = result1
		
		// Vector 2
		chunk2 := (cast(^simd.u8x16)&data[i + 32])^
		mask2 := simd.lanes_eq(chunk2, record_sep)
		result2 := simd.select(mask2, tab_char, chunk2)
		(cast(^simd.u8x16)&data[i + 32])^ = result2
		
		// Vector 3
		chunk3 := (cast(^simd.u8x16)&data[i + 48])^
		mask3 := simd.lanes_eq(chunk3, record_sep)
		result3 := simd.select(mask3, tab_char, chunk3)
		(cast(^simd.u8x16)&data[i + 48])^ = result3
	}
}
