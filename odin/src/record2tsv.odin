package csv_wasm

import "base:runtime"
import "core:slice"
import "core:simd"

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
	when #config(FLATDATA_SIMD, false) {
		// SIMD needs 16-byte alignment
		aligned_size := ((size + 15) / 16) * 16
		return raw_data(make([]byte, aligned_size))
	} else {
		return raw_data(make([]byte, size))
	}
}

@(export)
deallocate :: proc "c" (ptr: rawptr, size: int) {
	context = runtime.default_context()
}

// Transform record format to TSV
@(export)
record_to_tsv :: proc "c" (ptr: rawptr, length: int) -> int {
	context = runtime.default_context()
	
	when #config(FLATDATA_SIMD, false) {
		return record_to_tsv_simd(ptr, length)
	} else {
		return record_to_tsv_scalar(ptr, length)
	}
}

// Scalar implementation
record_to_tsv_scalar :: proc "c" (ptr: rawptr, length: int) -> int {
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

// SIMD implementation
record_to_tsv_simd :: proc "c" (ptr: rawptr, length: int) -> int {
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
						return 0  // Invalid input, return 0
					}
				}
			}
		}
		
		// Transform
		field_mask := simd.lanes_eq(chunk, field_sep)
		record_mask := simd.lanes_eq(chunk, record_sep)
		result := simd.select(field_mask, tab, chunk)
		result = simd.select(record_mask, newline, result)
		
		(cast(^simd.u8x16)&data[i])^ = result
	}
	
	return length  // Return output length (same as input for in-place transform)
}
