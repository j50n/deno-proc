package csv_wasm

import "core:testing"
import "core:slice"

// Helper to test tsv_to_record in-place transformation
test_tsv_to_record :: proc(t: ^testing.T, input: string, expected: string, msg: string = "") {
	// Copy input to mutable buffer
	buf := make([]u8, len(input))
	defer delete(buf)
	copy(buf, transmute([]u8)input)
	
	// Transform in-place
	new_len := tsv_to_record(raw_data(buf), len(buf))
	
	// Compare result
	result := buf[:new_len]
	exp := transmute([]u8)expected
	if !slice.equal(result, exp) {
		testing.expectf(t, false, "%s: got %v, expected %v", msg, result, exp)
	}
}

// =============================================================================
// Basic Functionality Tests
// =============================================================================

@(test)
test_tsv2record_basic :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "a\tb\tc\n", "a\x1Fb\x1Fc\x1E", "basic TSV row")
}

@(test)
test_tsv2record_multi_row :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "a\tb\nc\td\n", "a\x1Fb\x1Ec\x1Fd\x1E", "multiple rows")
}

@(test)
test_tsv2record_empty_fields :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "\tb\t\n", "\x1Fb\x1F\x1E", "empty fields")
}

@(test)
test_tsv2record_single_field :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "abc\n", "abc\x1E", "single field")
}

@(test)
test_tsv2record_no_trailing_newline :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "a\tb\tc", "a\x1Fb\x1Fc", "no trailing newline")
}

// =============================================================================
// Carriage Return Handling
// =============================================================================

@(test)
test_tsv2record_crlf :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "a\tb\r\nc\td\r\n", "a\x1Fb\x1Ec\x1Fd\x1E", "CRLF line endings")
}

@(test)
test_tsv2record_bare_cr :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "a\rb\tc\n", "ab\x1Fc\x1E", "bare CR stripped")
}

@(test)
test_tsv2record_multiple_cr :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "a\r\r\tb\r\n", "a\x1Fb\x1E", "multiple CRs stripped")
}

// =============================================================================
// Edge Cases
// =============================================================================

@(test)
test_tsv2record_empty_input :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "", "", "empty input")
}

@(test)
test_tsv2record_only_tabs :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "\t\t\t", "\x1F\x1F\x1F", "only tabs")
}

@(test)
test_tsv2record_only_newlines :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "\n\n\n", "\x1E\x1E\x1E", "only newlines")
}

@(test)
test_tsv2record_unicode :: proc(t: ^testing.T) {
	test_tsv_to_record(t, "hello\t世界\n", "hello\x1F世界\x1E", "unicode preserved")
}

@(test)
test_tsv2record_special_chars :: proc(t: ^testing.T) {
	// Commas, quotes, etc. should pass through unchanged
	test_tsv_to_record(t, "a,b\t\"c\"\n", "a,b\x1F\"c\"\x1E", "special chars preserved")
}

@(test)
test_tsv2record_embedded_separators :: proc(t: ^testing.T) {
	// Test that existing \x1F and \x1E in data are preserved
	buf := []u8{'a', 0x1F, 'b', '\t', 'c', 0x1E, 'd', '\n'}
	input := make([]u8, len(buf))
	defer delete(input)
	copy(input, buf)
	
	new_len := tsv_to_record(raw_data(input), len(input))
	
	expected := []u8{'a', 0x1F, 'b', 0x1F, 'c', 0x1E, 'd', 0x1E}
	result := input[:new_len]
	
	testing.expect(t, slice.equal(result, expected), "embedded separators preserved")
}

// =============================================================================
// Length Reduction Tests
// =============================================================================

@(test)
test_tsv2record_length_reduction :: proc(t: ^testing.T) {
	// Input with CRs should produce shorter output
	buf := make([]u8, 100)
	defer delete(buf)
	copy(buf, transmute([]u8)string("a\r\tb\r\n"))
	
	new_len := tsv_to_record(raw_data(buf), 6)
	testing.expect_value(t, new_len, 4) // "a\x1Fb\x1E"
}

@(test)
test_tsv2record_no_length_change :: proc(t: ^testing.T) {
	// Input without CRs should have same length
	buf := make([]u8, 100)
	defer delete(buf)
	copy(buf, transmute([]u8)string("a\tb\n"))
	
	new_len := tsv_to_record(raw_data(buf), 4)
	testing.expect_value(t, new_len, 4) // "a\x1Fb\x1E"
}

// =============================================================================
// Large Data Tests
// =============================================================================

@(test)
test_tsv2record_many_fields :: proc(t: ^testing.T) {
	// 100 fields
	input := make([dynamic]u8)
	defer delete(input)
	
	for i in 0..<100 {
		append(&input, 'x')
		if i < 99 {
			append(&input, '\t')
		}
	}
	append(&input, '\n')
	
	buf := make([]u8, len(input))
	defer delete(buf)
	copy(buf, input[:])
	
	new_len := tsv_to_record(raw_data(buf), len(buf))
	
	// Should have 100 'x' + 99 field seps + 1 record sep = 200 bytes
	testing.expect_value(t, new_len, 200)
}

@(test)
test_tsv2record_many_rows :: proc(t: ^testing.T) {
	// 1000 rows
	input := make([dynamic]u8)
	defer delete(input)
	
	for _ in 0..<1000 {
		append(&input, 'a')
		append(&input, '\t')
		append(&input, 'b')
		append(&input, '\n')
	}
	
	buf := make([]u8, len(input))
	defer delete(buf)
	copy(buf, input[:])
	
	new_len := tsv_to_record(raw_data(buf), len(buf))
	
	// Each row: a\x1Fb\x1E = 4 bytes × 1000 = 4000 bytes
	testing.expect_value(t, new_len, 4000)
}
