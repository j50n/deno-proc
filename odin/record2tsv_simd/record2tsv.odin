package record2tsv_simd

import "base:runtime"
import "core:slice"
import "core:simd"

main :: proc() {}

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

// Allocate buffer - SIMD version needs alignment
@(export)
allocate :: proc "c" (size: int) -> rawptr {
	context = runtime.default_context()
	// Round up to 16-byte alignment for SIMD
	aligned_size := ((size + 15) / 16) * 16
	return raw_data(make([]byte, aligned_size))
}

@(export)
deallocate :: proc "c" (ptr: rawptr, size: int) {
	context = runtime.default_context()
}

// Transform record format to TSV (SIMD implementation)
@(export)
record_to_tsv :: proc "c" (ptr: rawptr, length: int) -> int {
	context = runtime.default_context()
	
	// SIMD implementation
	field_sep := simd.u8x16{FIELD_SEPARATOR, FIELD_SEPARATOR, FIELD_SEPARATOR, FIELD_SEPARATOR,
	                        FIELD_SEPARATOR, FIELD_SEPARATOR, FIELD_SEPARATOR, FIELD_SEPARATOR,
	                        FIELD_SEPARATOR, FIELD_SEPARATOR, FIELD_SEPARATOR, FIELD_SEPARATOR,
	                        FIELD_SEPARATOR, FIELD_SEPARATOR, FIELD_SEPARATOR, FIELD_SEPARATOR}
	record_sep := simd.u8x16{RECORD_SEPARATOR, RECORD_SEPARATOR, RECORD_SEPARATOR, RECORD_SEPARATOR,
	                          RECORD_SEPARATOR, RECORD_SEPARATOR, RECORD_SEPARATOR, RECORD_SEPARATOR,
	                          RECORD_SEPARATOR, RECORD_SEPARATOR, RECORD_SEPARATOR, RECORD_SEPARATOR,
	                          RECORD_SEPARATOR, RECORD_SEPARATOR, RECORD_SEPARATOR, RECORD_SEPARATOR}
	tab := simd.u8x16{TAB, TAB, TAB, TAB, TAB, TAB, TAB, TAB, TAB, TAB, TAB, TAB, TAB, TAB, TAB, TAB}
	newline := simd.u8x16{NEWLINE, NEWLINE, NEWLINE, NEWLINE, NEWLINE, NEWLINE, NEWLINE, NEWLINE,
	                       NEWLINE, NEWLINE, NEWLINE, NEWLINE, NEWLINE, NEWLINE, NEWLINE, NEWLINE}
	cr := simd.u8x16{CR, CR, CR, CR, CR, CR, CR, CR, CR, CR, CR, CR, CR, CR, CR, CR}
	
	aligned_length := ((length + 15) / 16) * 16
	data := slice.from_ptr(cast(^u8)ptr, aligned_length)
	record_num := 1
	
	for i := 0; i < aligned_length; i += 16 {
		chunk := (cast(^simd.u8x16)&data[i])^
		
		// Validate
		if i < length {
			has_tab := simd.lanes_eq(chunk, tab)
			has_cr := simd.lanes_eq(chunk, cr)
			has_lf := simd.lanes_eq(chunk, newline)
			invalid_mask := simd.bit_or(simd.bit_or(has_tab, has_cr), has_lf)
			invalid_bits := simd.extract_msbs(invalid_mask)
			
			if card(invalid_bits) > 0 {
				check_len := min(16, length - i)
				for j in 0..<check_len {
					if is_invalid_tsv_char(data[i + j]) {
						return record_num
					}
				}
			}
		}
		
		// Transform
		field_mask := simd.lanes_eq(chunk, field_sep)
		record_mask := simd.lanes_eq(chunk, record_sep)
		result := simd.select(field_mask, tab, chunk)
		result = simd.select(record_mask, newline, result)
		
		// Count records
		if i < length {
			check_len := min(16, length - i)
			for j in 0..<check_len {
				if data[i + j] == RECORD_SEPARATOR {
					record_num += 1
				}
			}
		}
		
		(cast(^simd.u8x16)&data[i])^ = result
	}
	
	return 0
}
