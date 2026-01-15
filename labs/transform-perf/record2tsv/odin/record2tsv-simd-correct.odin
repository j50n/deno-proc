package main

import "base:runtime"
import "core:slice"
import "core:simd"

main :: proc() {}

// Allocate buffer for processing, rounded up to 16-byte alignment
@(export)
allocate_simd_correct :: proc "c" (size: int) -> rawptr {
	context = runtime.default_context()
	// Round up to next multiple of 16 for SIMD alignment
	aligned_size := ((size + 15) / 16) * 16
	return raw_data(make([]byte, aligned_size))
}

// Free allocated buffer
@(export)
deallocate_simd_correct :: proc "c" (ptr: rawptr, size: int) {
	context = runtime.default_context()
	// Memory freed when Odin's allocator reuses it
}

// Transform record format to TSV with SIMD validation
// Replaces 0x1f (field separator) with 0x09 (tab)
// Replaces 0x1e (record separator) with 0x0a (newline)
// Returns record number (1-based) if invalid characters found (0x09, 0x0d, 0x0a in data)
// Returns 0 if successful
@(export)
record_to_tsv_simd_correct :: proc "c" (ptr: rawptr, length: int) -> int {
	context = runtime.default_context()
	
	// SIMD vectors for comparison and replacement
	field_sep := simd.u8x16{0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f,
	                        0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f, 0x1f}
	record_sep := simd.u8x16{0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e,
	                          0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e}
	tab := simd.u8x16{0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09,
	                   0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09}
	newline := simd.u8x16{0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a,
	                       0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a, 0x0a}
	cr := simd.u8x16{0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d,
	                  0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d}
	
	// Process full 16-byte chunks (including padding bytes)
	aligned_length := ((length + 15) / 16) * 16
	data := slice.from_ptr(cast(^u8)ptr, aligned_length)
	
	record_num := 1  // 1-based record numbering
	
	for i := 0; i < aligned_length; i += 16 {
		// Load 16 bytes
		chunk := (cast(^simd.u8x16)&data[i])^
		
		// SIMD check for invalid characters (tab, CR, or LF)
		has_tab := simd.lanes_eq(chunk, tab)
		has_cr := simd.lanes_eq(chunk, cr)
		has_lf := simd.lanes_eq(chunk, newline)
		
		// Combine masks with OR
		invalid_mask := simd.bit_or(simd.bit_or(has_tab, has_cr), has_lf)
		
		// Check if any invalid characters found (only in valid data range)
		if i < length {
			// Extract bits to see if any lanes matched
			invalid_bits := simd.extract_msbs(invalid_mask)
			if card(invalid_bits) > 0 {
				// Need to check if the match is within actual data bounds
				check_len := min(16, length - i)
				for j in 0..<check_len {
					if data[i + j] == 0x09 || data[i + j] == 0x0d || data[i + j] == 0x0a {
						return record_num
					}
				}
			}
		}
		
		// Transform: replace separators
		field_mask := simd.lanes_eq(chunk, field_sep)
		record_mask := simd.lanes_eq(chunk, record_sep)
		
		result := simd.select(field_mask, tab, chunk)
		result = simd.select(record_mask, newline, result)
		
		// Count records in this chunk (only in valid data range)
		if i < length {
			check_len := min(16, length - i)
			for j in 0..<check_len {
				if data[i + j] == 0x1e {
					record_num += 1
				}
			}
		}
		
		// Store result back
		(cast(^simd.u8x16)&data[i])^ = result
	}
	
	return 0  // Success
}
