package csv_tests

import "core:testing"
import csv "../src"

// Helper to call parse_field_out and return values for testing
parse_field_test :: proc(input: string, start: int, sep: u8) -> (end, field_start, field_end: int, needs_unescape, complete: bool) {
    complete = csv.parse_field_out(input, start, sep, &end, &field_start, &field_end, &needs_unescape)
    return
}

@(test)
test_parse_simple_field :: proc(t: ^testing.T) {
    end, field_start, field_end, needs_unescape, complete := parse_field_test("hello,world", 0, ',')
    testing.expect(t, complete, "Field should be complete")
    testing.expect_value(t, field_start, 0)
    testing.expect_value(t, field_end, 5)
    testing.expect_value(t, end, 6)
    testing.expect(t, !needs_unescape, "Should not need unescape")
}

@(test)
test_parse_quoted_field :: proc(t: ^testing.T) {
    end, field_start, field_end, needs_unescape, complete := parse_field_test("\"hello\",world", 0, ',')
    testing.expect(t, complete, "Field should be complete")
    testing.expect_value(t, field_start, 1)
    testing.expect_value(t, field_end, 6)
    testing.expect(t, !needs_unescape, "Should not need unescape")
    _ = end
}

@(test)
test_parse_escaped_quote :: proc(t: ^testing.T) {
    _, _, _, needs_unescape, complete := parse_field_test("\"say \"\"hi\"\"\",next", 0, ',')
    testing.expect(t, complete, "Field should be complete")
    testing.expect(t, needs_unescape, "Should need unescape")
}

@(test)
test_parse_incomplete_quoted :: proc(t: ^testing.T) {
    _, _, _, _, complete := parse_field_test("\"hello", 0, ',')
    testing.expect(t, !complete, "Field should be incomplete")
}

@(test)
test_parse_field_at_line_end :: proc(t: ^testing.T) {
    _, _, field_end, _, complete := parse_field_test("hello\nworld", 0, ',')
    testing.expect(t, complete, "Field should be complete")
    testing.expect_value(t, field_end, 5)
}

@(test)
test_parse_empty_field :: proc(t: ^testing.T) {
    _, field_start, field_end, _, complete := parse_field_test(",next", 0, ',')
    testing.expect(t, complete, "Field should be complete")
    testing.expect_value(t, field_start, 0)
    testing.expect_value(t, field_end, 0)
}
