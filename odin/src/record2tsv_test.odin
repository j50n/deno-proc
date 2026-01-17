package csv_wasm

import "core:testing"
import "core:slice"

// Helper to test record_to_tsv
test_record_to_tsv :: proc(t: ^testing.T, input: string, expected: string, msg: string = "") {
	// Copy input to mutable buffer
	buf := make([]u8, len(input))
	defer delete(buf)
	copy(buf, transmute([]u8)input)
	
	// Transform in-place
	new_len := record_to_tsv(raw_data(buf), len(buf))
	
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
test_record2tsv_basic :: proc(t: ^testing.T) {
	test_record_to_tsv(t, "a\x1Fb\x1Fc\x1E", "a\tb\tc\n", "basic record to TSV")
}

@(test)
test_record2tsv_multi_row :: proc(t: ^testing.T) {
	test_record_to_tsv(t, "a\x1Fb\x1Ec\x1Fd\x1E", "a\tb\nc\td\n", "multiple rows")
}

@(test)
test_record2tsv_empty_fields :: proc(t: ^testing.T) {
	test_record_to_tsv(t, "\x1Fb\x1F\x1E", "\tb\t\n", "empty fields")
}

@(test)
test_record2tsv_single_field :: proc(t: ^testing.T) {
	test_record_to_tsv(t, "abc\x1E", "abc\n", "single field")
}

@(test)
test_record2tsv_no_trailing_record_sep :: proc(t: ^testing.T) {
	test_record_to_tsv(t, "a\x1Fb\x1Fc", "a\tb\tc", "no trailing record separator")
}

// =============================================================================
// Invalid Input Tests
// =============================================================================

@(test)
test_record2tsv_invalid_tab :: proc(t: ^testing.T) {
	// Record format should not contain tabs
	buf := make([]u8, 10)
	defer delete(buf)
	copy(buf, transmute([]u8)string("a\tb\x1E"))
	
	result_len := record_to_tsv(raw_data(buf), 4)
	testing.expect_value(t, result_len, 0)  // Should fail
}

@(test)
test_record2tsv_invalid_newline :: proc(t: ^testing.T) {
	// Record format should not contain newlines
	buf := make([]u8, 10)
	defer delete(buf)
	copy(buf, transmute([]u8)string("a\nb\x1E"))
	
	result_len := record_to_tsv(raw_data(buf), 4)
	testing.expect_value(t, result_len, 0)  // Should fail
}

@(test)
test_record2tsv_invalid_cr :: proc(t: ^testing.T) {
	// Record format should not contain carriage returns
	buf := make([]u8, 10)
	defer delete(buf)
	copy(buf, transmute([]u8)string("a\rb\x1E"))
	
	result_len := record_to_tsv(raw_data(buf), 4)
	testing.expect_value(t, result_len, 0)  // Should fail
}

// =============================================================================
// Edge Cases
// =============================================================================

@(test)
test_record2tsv_empty_input :: proc(t: ^testing.T) {
	test_record_to_tsv(t, "", "", "empty input")
}

@(test)
test_record2tsv_only_field_seps :: proc(t: ^testing.T) {
	test_record_to_tsv(t, "\x1F\x1F\x1F", "\t\t\t", "only field separators")
}

@(test)
test_record2tsv_only_record_seps :: proc(t: ^testing.T) {
	test_record_to_tsv(t, "\x1E\x1E\x1E", "\n\n\n", "only record separators")
}

@(test)
test_record2tsv_unicode :: proc(t: ^testing.T) {
	test_record_to_tsv(t, "hello\x1F世界\x1E", "hello\t世界\n", "unicode preserved")
}

@(test)
test_record2tsv_special_chars :: proc(t: ^testing.T) {
	// Commas, quotes, etc. should pass through unchanged
	test_record_to_tsv(t, "a,b\x1F\"c\"\x1E", "a,b\t\"c\"\n", "special chars preserved")
}

// =============================================================================
// Large Data Tests
// =============================================================================

@(test)
test_record2tsv_many_fields :: proc(t: ^testing.T) {
	// 100 fields
	input := make([dynamic]u8)
	defer delete(input)
	
	expected := make([dynamic]u8)
	defer delete(expected)
	
	for i in 0..<100 {
		append(&input, 'x')
		append(&expected, 'x')
		if i < 99 {
			append(&input, 0x1F)
			append(&expected, '\t')
		}
	}
	append(&input, 0x1E)
	append(&expected, '\n')
	
	buf := make([]u8, len(input))
	defer delete(buf)
	copy(buf, input[:])
	
	new_len := record_to_tsv(raw_data(buf), len(buf))
	
	testing.expect_value(t, new_len, len(expected))
	testing.expect(t, slice.equal(buf[:new_len], expected[:]), "output matches")
}

@(test)
test_record2tsv_many_rows :: proc(t: ^testing.T) {
	// 1000 rows
	input := make([dynamic]u8)
	defer delete(input)
	
	for _ in 0..<1000 {
		append(&input, 'a')
		append(&input, 0x1F)
		append(&input, 'b')
		append(&input, 0x1E)
	}
	
	buf := make([]u8, len(input))
	defer delete(buf)
	copy(buf, input[:])
	
	new_len := record_to_tsv(raw_data(buf), len(buf))
	
	// Each row: "a\tb\n" = 4 bytes × 1000 = 4000 bytes
	testing.expect_value(t, new_len, 4000)
}

@(test)
test_record2tsv_large_field :: proc(t: ^testing.T) {
	// Single field with 10000 characters
	input := make([dynamic]u8, 10001)
	defer delete(input)
	
	for i in 0..<10000 {
		input[i] = 'x'
	}
	input[10000] = 0x1E
	
	buf := make([]u8, len(input))
	defer delete(buf)
	copy(buf, input[:])
	
	new_len := record_to_tsv(raw_data(buf), len(buf))
	
	testing.expect_value(t, new_len, 10001)  // 10000 'x' + 1 '\n'
	testing.expect_value(t, buf[10000], u8('\n'))
}

// =============================================================================
// In-Place Transformation Tests
// =============================================================================

@(test)
test_record2tsv_same_length :: proc(t: ^testing.T) {
	// Record format and TSV should have same length (both use single-byte separators)
	input := "a\x1Fb\x1Fc\x1E"
	expected := "a\tb\tc\n"
	
	testing.expect_value(t, len(input), len(expected))
	
	buf := make([]u8, len(input))
	defer delete(buf)
	copy(buf, transmute([]u8)input)
	
	new_len := record_to_tsv(raw_data(buf), len(buf))
	
	testing.expect_value(t, new_len, len(expected))
}

// =============================================================================
// Round-trip Tests
// =============================================================================

@(test)
test_record2tsv_roundtrip :: proc(t: ^testing.T) {
	// TSV → Record → TSV should be identity (if no special chars)
	original_tsv := "a\tb\tc\n"
	
	// TSV → Record
	buf1 := make([]u8, len(original_tsv))
	defer delete(buf1)
	copy(buf1, transmute([]u8)original_tsv)
	
	record_len := tsv_to_record(raw_data(buf1), len(buf1))
	record_data := buf1[:record_len]
	
	// Record → TSV
	buf2 := make([]u8, len(record_data))
	defer delete(buf2)
	copy(buf2, record_data)
	
	tsv_len := record_to_tsv(raw_data(buf2), len(buf2))
	result_tsv := buf2[:tsv_len]
	
	testing.expect(t, slice.equal(result_tsv, transmute([]u8)original_tsv), "round-trip preserves data")
}

@(test)
test_record2tsv_roundtrip_multi_row :: proc(t: ^testing.T) {
	original_tsv := "a\tb\nc\td\ne\tf\n"
	
	// TSV → Record
	buf1 := make([]u8, len(original_tsv))
	defer delete(buf1)
	copy(buf1, transmute([]u8)original_tsv)
	
	record_len := tsv_to_record(raw_data(buf1), len(buf1))
	record_data := buf1[:record_len]
	
	// Record → TSV
	buf2 := make([]u8, len(record_data))
	defer delete(buf2)
	copy(buf2, record_data)
	
	tsv_len := record_to_tsv(raw_data(buf2), len(buf2))
	result_tsv := buf2[:tsv_len]
	
	testing.expect(t, slice.equal(result_tsv, transmute([]u8)original_tsv), "multi-row round-trip")
}
