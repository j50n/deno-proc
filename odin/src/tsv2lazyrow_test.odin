package csv_wasm

import "core:testing"

// Helper to decode lazyrow binary format for testing
decode_lazyrow :: proc(data: []u8, allocator := context.allocator) -> (rows: [dynamic][dynamic]string, ok: bool) {
	context.allocator = allocator
	rows = make([dynamic][dynamic]string)
	
	pos := 0
	for pos < len(data) {
		if pos + 4 > len(data) do return rows, false
		
		// Read row_length
		row_length := u32(data[pos]) | (u32(data[pos+1]) << 8) | (u32(data[pos+2]) << 16) | (u32(data[pos+3]) << 24)
		pos += 4
		
		if pos + int(row_length) - 4 > len(data) do return rows, false
		
		// Read field_count
		field_count := u32(data[pos]) | (u32(data[pos+1]) << 8) | (u32(data[pos+2]) << 16) | (u32(data[pos+3]) << 24)
		pos += 4
		
		// Read field lengths
		field_lengths := make([dynamic]u32, field_count)
		defer delete(field_lengths)
		for i in 0..<field_count {
			if pos + 4 > len(data) do return rows, false
			field_lengths[i] = u32(data[pos]) | (u32(data[pos+1]) << 8) | (u32(data[pos+2]) << 16) | (u32(data[pos+3]) << 24)
			pos += 4
		}
		
		// Read field data
		row := make([dynamic]string)
		for flen in field_lengths {
			if pos + int(flen) > len(data) do return rows, false
			field := string(data[pos:pos+int(flen)])
			append(&row, field)
			pos += int(flen)
		}
		
		append(&rows, row)
	}
	
	return rows, true
}

// Helper to test tsv_to_lazyrow
test_tsv_to_lazyrow :: proc(t: ^testing.T, input: string, expected_rows: [][]string, msg: string = "") {
	output := make([]u8, 10000)
	defer delete(output)
	
	result_len := tsv_to_lazyrow(raw_data(transmute([]u8)input), len(input), raw_data(output), len(output))
	
	if result_len < 0 {
		testing.expectf(t, false, "%s: tsv_to_lazyrow failed (buffer too small)", msg)
		return
	}
	
	rows, ok := decode_lazyrow(output[:result_len])
	defer {
		for row in rows {
			delete(row)
		}
		delete(rows)
	}
	
	if !ok {
		testing.expectf(t, false, "%s: failed to decode lazyrow output", msg)
		return
	}
	
	if len(rows) != len(expected_rows) {
		testing.expectf(t, false, "%s: expected %d rows, got %d", msg, len(expected_rows), len(rows))
		return
	}
	
	for i in 0..<len(rows) {
		if len(rows[i]) != len(expected_rows[i]) {
			testing.expectf(t, false, "%s: row %d: expected %d fields, got %d", msg, i, len(expected_rows[i]), len(rows[i]))
			return
		}
		for j in 0..<len(rows[i]) {
			if rows[i][j] != expected_rows[i][j] {
				testing.expectf(t, false, "%s: row %d field %d: expected '%s', got '%s'", msg, i, j, expected_rows[i][j], rows[i][j])
				return
			}
		}
	}
}

// =============================================================================
// Basic Functionality Tests
// =============================================================================

@(test)
test_tsv2lazyrow_basic :: proc(t: ^testing.T) {
	expected := [][]string{{"a", "b", "c"}}
	test_tsv_to_lazyrow(t, "a\tb\tc\n", expected, "basic TSV row")
}

@(test)
test_tsv2lazyrow_multi_row :: proc(t: ^testing.T) {
	expected := [][]string{{"a", "b"}, {"c", "d"}}
	test_tsv_to_lazyrow(t, "a\tb\nc\td\n", expected, "multiple rows")
}

@(test)
test_tsv2lazyrow_empty_fields :: proc(t: ^testing.T) {
	expected := [][]string{{"", "b", ""}}
	test_tsv_to_lazyrow(t, "\tb\t\n", expected, "empty fields")
}

@(test)
test_tsv2lazyrow_single_field :: proc(t: ^testing.T) {
	expected := [][]string{{"abc"}}
	test_tsv_to_lazyrow(t, "abc\n", expected, "single field")
}

@(test)
test_tsv2lazyrow_no_trailing_newline :: proc(t: ^testing.T) {
	expected := [][]string{{"a", "b", "c"}}
	test_tsv_to_lazyrow(t, "a\tb\tc", expected, "no trailing newline")
}

// =============================================================================
// Carriage Return Handling
// =============================================================================

@(test)
test_tsv2lazyrow_crlf :: proc(t: ^testing.T) {
	expected := [][]string{{"a", "b"}, {"c", "d"}}
	test_tsv_to_lazyrow(t, "a\tb\r\nc\td\r\n", expected, "CRLF line endings")
}

@(test)
test_tsv2lazyrow_bare_cr :: proc(t: ^testing.T) {
	expected := [][]string{{"ab", "c"}}
	test_tsv_to_lazyrow(t, "a\rb\tc\n", expected, "bare CR stripped")
}

@(test)
test_tsv2lazyrow_cr_in_field :: proc(t: ^testing.T) {
	expected := [][]string{{"helloworld", "test"}}
	test_tsv_to_lazyrow(t, "hello\rworld\ttest\n", expected, "CR in field stripped")
}

// =============================================================================
// Edge Cases
// =============================================================================

@(test)
test_tsv2lazyrow_empty_input :: proc(t: ^testing.T) {
	output := make([]u8, 1000)
	defer delete(output)
	
	result_len := tsv_to_lazyrow(raw_data(transmute([]u8)string("")), 0, raw_data(output), len(output))
	testing.expect_value(t, result_len, 0)
}

@(test)
test_tsv2lazyrow_only_tabs :: proc(t: ^testing.T) {
	expected := [][]string{{"", "", "", ""}}
	test_tsv_to_lazyrow(t, "\t\t\t\n", expected, "only tabs")
}

@(test)
test_tsv2lazyrow_only_newline :: proc(t: ^testing.T) {
	expected := [][]string{{""}}
	test_tsv_to_lazyrow(t, "\n", expected, "only newline")
}

@(test)
test_tsv2lazyrow_unicode :: proc(t: ^testing.T) {
	expected := [][]string{{"hello", "世界"}}
	test_tsv_to_lazyrow(t, "hello\t世界\n", expected, "unicode preserved")
}

@(test)
test_tsv2lazyrow_special_chars :: proc(t: ^testing.T) {
	expected := [][]string{{"a,b", "\"c\""}}
	test_tsv_to_lazyrow(t, "a,b\t\"c\"\n", expected, "special chars preserved")
}

// =============================================================================
// Buffer Capacity Tests
// =============================================================================

@(test)
test_tsv2lazyrow_buffer_too_small :: proc(t: ^testing.T) {
	output := make([]u8, 10)  // Too small
	defer delete(output)
	
	input := "a\tb\tc\n"
	result_len := tsv_to_lazyrow(raw_data(transmute([]u8)input), len(input), raw_data(output), len(output))
	
	testing.expect_value(t, result_len, -1)
}

@(test)
test_tsv2lazyrow_exact_capacity :: proc(t: ^testing.T) {
	// Calculate exact size needed: row_length(4) + field_count(4) + 3*field_len(12) + data(3) = 23
	output := make([]u8, 23)
	defer delete(output)
	
	input := "a\tb\tc\n"
	result_len := tsv_to_lazyrow(raw_data(transmute([]u8)input), len(input), raw_data(output), len(output))
	
	testing.expect_value(t, result_len, 23)
}

// =============================================================================
// Large Data Tests
// =============================================================================

@(test)
test_tsv2lazyrow_many_fields :: proc(t: ^testing.T) {
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
	
	output := make([]u8, 10000)
	defer delete(output)
	
	result_len := tsv_to_lazyrow(raw_data(input), len(input), raw_data(output), len(output))
	
	rows, ok := decode_lazyrow(output[:result_len])
	defer {
		for row in rows {
			delete(row)
		}
		delete(rows)
	}
	
	testing.expect(t, ok, "decode should succeed")
	testing.expect_value(t, len(rows), 1)
	testing.expect_value(t, len(rows[0]), 100)
	for field in rows[0] {
		testing.expect_value(t, field, "x")
	}
}

@(test)
test_tsv2lazyrow_many_rows :: proc(t: ^testing.T) {
	// 100 rows
	input := make([dynamic]u8)
	defer delete(input)
	
	for _ in 0..<100 {
		append(&input, 'a')
		append(&input, '\t')
		append(&input, 'b')
		append(&input, '\n')
	}
	
	output := make([]u8, 100000)
	defer delete(output)
	
	result_len := tsv_to_lazyrow(raw_data(input), len(input), raw_data(output), len(output))
	
	rows, ok := decode_lazyrow(output[:result_len])
	defer {
		for row in rows {
			delete(row)
		}
		delete(rows)
	}
	
	testing.expect(t, ok, "decode should succeed")
	testing.expect_value(t, len(rows), 100)
	for row in rows {
		testing.expect_value(t, len(row), 2)
		testing.expect_value(t, row[0], "a")
		testing.expect_value(t, row[1], "b")
	}
}

@(test)
test_tsv2lazyrow_large_field :: proc(t: ^testing.T) {
	// Single field with 1000 characters
	input := make([dynamic]u8, 1001)
	defer delete(input)
	
	for j in 0..<1000 {
		input[j] = 'x'
	}
	input[1000] = '\n'
	
	// Build expected string
	expected_field := make([dynamic]u8, 1000)
	defer delete(expected_field)
	for _ in 0..<1000 {
		append(&expected_field, 'x')
	}
	
	output := make([]u8, 10000)
	defer delete(output)
	
	result_len := tsv_to_lazyrow(raw_data(input), len(input), raw_data(output), len(output))
	
	rows, ok := decode_lazyrow(output[:result_len])
	defer {
		for row in rows {
			delete(row)
		}
		delete(rows)
	}
	
	testing.expect(t, ok, "decode should succeed")
	testing.expect_value(t, len(rows), 1)
	testing.expect_value(t, len(rows[0]), 1)
	testing.expect_value(t, len(rows[0][0]), 1000)
}

// =============================================================================
// Binary Format Validation Tests
// =============================================================================

@(test)
test_tsv2lazyrow_binary_format :: proc(t: ^testing.T) {
	output := make([]u8, 1000)
	defer delete(output)
	
	input := "a\tb\n"
	result_len := tsv_to_lazyrow(raw_data(transmute([]u8)input), len(input), raw_data(output), len(output))
	
	// Manually verify binary format
	// row_length = 4 (field_count) + 2*4 (field_lengths) + 2 (data) = 14
	// Total with row_length header = 18
	testing.expect_value(t, result_len, 18)
	
	// Check row_length (little-endian u32)
	row_length := u32(output[0]) | (u32(output[1]) << 8) | (u32(output[2]) << 16) | (u32(output[3]) << 24)
	testing.expect_value(t, row_length, u32(14))
	
	// Check field_count
	field_count := u32(output[4]) | (u32(output[5]) << 8) | (u32(output[6]) << 16) | (u32(output[7]) << 24)
	testing.expect_value(t, field_count, u32(2))
	
	// Check first field length
	flen1 := u32(output[8]) | (u32(output[9]) << 8) | (u32(output[10]) << 16) | (u32(output[11]) << 24)
	testing.expect_value(t, flen1, u32(1))
	
	// Check second field length
	flen2 := u32(output[12]) | (u32(output[13]) << 8) | (u32(output[14]) << 16) | (u32(output[15]) << 24)
	testing.expect_value(t, flen2, u32(1))
	
	// Check field data
	testing.expect_value(t, output[16], u8('a'))
	testing.expect_value(t, output[17], u8('b'))
}
