package csv_wasm

import "core:testing"
import "core:slice"

// Helper to test tsv_to_csv
test_tsv_to_csv :: proc(t: ^testing.T, input: string, separator: u8, expected: string, msg: string = "") {
	output := make([]u8, 10000)
	defer delete(output)
	
	result_len := tsv_to_csv(raw_data(transmute([]u8)input), len(input), raw_data(output), len(output), separator)
	
	if result_len < 0 {
		testing.expectf(t, false, "%s: tsv_to_csv failed (buffer too small)", msg)
		return
	}
	
	result := output[:result_len]
	exp := transmute([]u8)expected
	if !slice.equal(result, exp) {
		testing.expectf(t, false, "%s: got %v, expected %v", msg, result, exp)
	}
}

// =============================================================================
// Basic Functionality Tests
// =============================================================================

@(test)
test_tsv2csv_basic :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "a\tb\tc\n", ',', "a,b,c\n", "basic TSV to CSV")
}

@(test)
test_tsv2csv_multi_row :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "a\tb\nc\td\n", ',', "a,b\nc,d\n", "multiple rows")
}

@(test)
test_tsv2csv_empty_fields :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "\tb\t\n", ',', ",b,\n", "empty fields")
}

@(test)
test_tsv2csv_single_field :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "abc\n", ',', "abc\n", "single field")
}

@(test)
test_tsv2csv_no_trailing_newline :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "a\tb\tc", ',', "a,b,c", "no trailing newline")
}

// =============================================================================
// Carriage Return Handling
// =============================================================================

@(test)
test_tsv2csv_crlf :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "a\tb\r\nc\td\r\n", ',', "a,b\nc,d\n", "CRLF line endings")
}

@(test)
test_tsv2csv_bare_cr :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "a\rb\tc\n", ',', "ab,c\n", "bare CR stripped")
}

@(test)
test_tsv2csv_multiple_cr :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "a\r\r\tb\r\n", ',', "a,b\n", "multiple CRs stripped")
}

// =============================================================================
// Custom Separator Tests
// =============================================================================

@(test)
test_tsv2csv_semicolon :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "a\tb\tc\n", ';', "a;b;c\n", "semicolon separator")
}

@(test)
test_tsv2csv_pipe :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "a\tb\tc\n", '|', "a|b|c\n", "pipe separator")
}

@(test)
test_tsv2csv_space :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "a\tb\tc\n", ' ', "a b c\n", "space separator")
}

// =============================================================================
// Edge Cases
// =============================================================================

@(test)
test_tsv2csv_empty_input :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "", ',', "", "empty input")
}

@(test)
test_tsv2csv_only_tabs :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "\t\t\t", ',', ",,,", "only tabs")
}

@(test)
test_tsv2csv_only_newlines :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "\n\n\n", ',', "\n\n\n", "only newlines")
}

@(test)
test_tsv2csv_unicode :: proc(t: ^testing.T) {
	test_tsv_to_csv(t, "hello\t世界\n", ',', "hello,世界\n", "unicode preserved")
}

// =============================================================================
// Ambiguous Output Tests (no quoting)
// =============================================================================

@(test)
test_tsv2csv_field_with_comma :: proc(t: ^testing.T) {
	// NOTE: This produces ambiguous CSV! Field contains comma but no quoting.
	// This is expected behavior - tsv_to_csv is a simple delimiter replacer.
	test_tsv_to_csv(t, "a,b\tc\n", ',', "a,b,c\n", "field with comma (ambiguous)")
}

@(test)
test_tsv2csv_field_with_quote :: proc(t: ^testing.T) {
	// Quotes pass through unchanged - no CSV escaping
	test_tsv_to_csv(t, "a\"b\tc\n", ',', "a\"b,c\n", "field with quote (no escaping)")
}

@(test)
test_tsv2csv_field_with_newline :: proc(t: ^testing.T) {
	// Embedded newlines pass through - produces multi-line field without quoting
	test_tsv_to_csv(t, "a\nb\tc\n", ',', "a\nb,c\n", "field with newline (ambiguous)")
}

// =============================================================================
// Buffer Capacity Tests
// =============================================================================

@(test)
test_tsv2csv_buffer_too_small :: proc(t: ^testing.T) {
	output := make([]u8, 5)  // Too small
	defer delete(output)
	
	input := "a\tb\tc\n"
	result_len := tsv_to_csv(raw_data(transmute([]u8)input), len(input), raw_data(output), len(output), ',')
	
	testing.expect_value(t, result_len, -1)
}

@(test)
test_tsv2csv_exact_capacity :: proc(t: ^testing.T) {
	output := make([]u8, 6)  // Exactly "a,b,c\n"
	defer delete(output)
	
	input := "a\tb\tc\n"
	result_len := tsv_to_csv(raw_data(transmute([]u8)input), len(input), raw_data(output), len(output), ',')
	
	testing.expect_value(t, result_len, 6)
	testing.expect(t, slice.equal(output[:result_len], transmute([]u8)string("a,b,c\n")), "output matches")
}

// =============================================================================
// Length Reduction Tests
// =============================================================================

@(test)
test_tsv2csv_length_reduction :: proc(t: ^testing.T) {
	// Input with CRs should produce shorter output
	output := make([]u8, 100)
	defer delete(output)
	
	input := "a\r\tb\r\n"  // 6 bytes
	result_len := tsv_to_csv(raw_data(transmute([]u8)input), len(input), raw_data(output), len(output), ',')
	
	testing.expect_value(t, result_len, 4)  // "a,b\n"
}

@(test)
test_tsv2csv_no_length_change :: proc(t: ^testing.T) {
	// Input without CRs should have same length
	output := make([]u8, 100)
	defer delete(output)
	
	input := "a\tb\n"  // 4 bytes
	result_len := tsv_to_csv(raw_data(transmute([]u8)input), len(input), raw_data(output), len(output), ',')
	
	testing.expect_value(t, result_len, 4)  // "a,b\n"
}

// =============================================================================
// Large Data Tests
// =============================================================================

@(test)
test_tsv2csv_many_fields :: proc(t: ^testing.T) {
	// 100 fields
	input := make([dynamic]u8)
	defer delete(input)
	
	expected := make([dynamic]u8)
	defer delete(expected)
	
	for i in 0..<100 {
		append(&input, 'x')
		append(&expected, 'x')
		if i < 99 {
			append(&input, '\t')
			append(&expected, ',')
		}
	}
	append(&input, '\n')
	append(&expected, '\n')
	
	output := make([]u8, 10000)
	defer delete(output)
	
	result_len := tsv_to_csv(raw_data(input), len(input), raw_data(output), len(output), ',')
	
	testing.expect_value(t, result_len, len(expected))
	testing.expect(t, slice.equal(output[:result_len], expected[:]), "output matches")
}

@(test)
test_tsv2csv_many_rows :: proc(t: ^testing.T) {
	// 1000 rows
	input := make([dynamic]u8)
	defer delete(input)
	
	for _ in 0..<1000 {
		append(&input, 'a')
		append(&input, '\t')
		append(&input, 'b')
		append(&input, '\n')
	}
	
	output := make([]u8, 100000)
	defer delete(output)
	
	result_len := tsv_to_csv(raw_data(input), len(input), raw_data(output), len(output), ',')
	
	// Each row: "a,b\n" = 4 bytes × 1000 = 4000 bytes
	testing.expect_value(t, result_len, 4000)
}
