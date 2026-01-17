package csv

import "core:testing"
import "core:slice"

// Helper to compare byte slices
expect_bytes :: proc(t: ^testing.T, got: []u8, expected: string, msg: string = "output mismatch") {
    exp := transmute([]u8)expected
    if !slice.equal(got, exp) {
        testing.expectf(t, false, "%s: got %v, expected %v", msg, got, exp)
    }
}

// =============================================================================
// Delimited Parser Tests
// =============================================================================

@(test)
test_delimited_basic :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("a,b,c\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "a\x1Fb\x1Fc\x1E", "output mismatch")
}

@(test)
test_delimited_no_trailing_newline :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("a,b,c"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(0))
    
    rows, ok = delimited_finish(&p)
    testing.expect(t, ok, "finish should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "a\x1Fb\x1Fc\x1E", "output mismatch")
}

@(test)
test_delimited_crlf :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("a,b\r\nc,d\r\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(2))
    expect_bytes(t, p.output[:], "a\x1Fb\x1Ec\x1Fd\x1E", "output mismatch")
}

@(test)
test_delimited_empty_fields :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string(",b,\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "\x1Fb\x1F\x1E", "output mismatch")
}

@(test)
test_delimited_quoted_basic :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("\"a\",b,c\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "a\x1Fb\x1Fc\x1E", "output mismatch")
}

@(test)
test_delimited_quoted_with_comma :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("\"a,b\",c\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "a,b\x1Fc\x1E", "output mismatch")
}

@(test)
test_delimited_quoted_with_newline :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("\"a\nb\",c\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "a\nb\x1Fc\x1E", "output mismatch")
}

@(test)
test_delimited_escaped_quote :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("\"a\"\"b\",c\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "a\"b\x1Fc\x1E", "output mismatch")
}

@(test)
test_delimited_empty_quoted :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("\"\",b\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "\x1Fb\x1E", "output mismatch")
}

@(test)
test_delimited_multi_row :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("a,b\nc,d\ne,f\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(3))
    expect_bytes(t, p.output[:], "a\x1Fb\x1Ec\x1Fd\x1Ee\x1Ff\x1E", "output mismatch")
}

@(test)
test_delimited_custom_separator :: proc(t: ^testing.T) {
    p := delimited_init(CsvOptions{separator = '\t'})
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("a\tb\tc\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "a\x1Fb\x1Fc\x1E", "output mismatch")
}

// =============================================================================
// Delimited Parser Error Tests
// =============================================================================

@(test)
test_delimited_error_bare_quote_strict :: proc(t: ^testing.T) {
    p := delimited_init(CsvOptions{strict = true})
    defer delimited_destroy(&p)
    
    _, ok := delimited_parse(&p, transmute([]u8)string("a\"b,c\n"))
    testing.expect(t, !ok, "parse should fail")
    testing.expect_value(t, p.error.kind, CsvErrorKind.BareQuote)
    testing.expect_value(t, p.error.row, u32(0))
    testing.expect_value(t, p.error.col, u32(1))
}

@(test)
test_delimited_error_bare_quote_lenient :: proc(t: ^testing.T) {
    p := delimited_init()  // lenient by default
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("a\"b,c\n"))
    testing.expect(t, ok, "parse should succeed in lenient mode")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "a\"b\x1Fc\x1E", "output mismatch")
}

@(test)
test_delimited_error_invalid_after_quote :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    _, ok := delimited_parse(&p, transmute([]u8)string("\"a\"b,c\n"))
    testing.expect(t, !ok, "parse should fail")
    testing.expect_value(t, p.error.kind, CsvErrorKind.InvalidCharAfterQuote)
}

@(test)
test_delimited_error_unclosed_quote_strict :: proc(t: ^testing.T) {
    p := delimited_init(CsvOptions{strict = true})
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("\"abc"))
    testing.expect(t, ok, "parse should succeed (quote not closed yet)")
    
    rows, ok = delimited_finish(&p)
    testing.expect(t, !ok, "finish should fail")
    testing.expect_value(t, p.error.kind, CsvErrorKind.UnclosedQuote)
}

@(test)
test_delimited_error_unclosed_quote_lenient :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("\"abc"))
    testing.expect(t, ok, "parse should succeed")
    
    rows, ok = delimited_finish(&p)
    testing.expect(t, ok, "finish should succeed in lenient mode")
    testing.expect_value(t, rows, u32(1))
}

@(test)
test_delimited_error_bare_cr_strict :: proc(t: ^testing.T) {
    p := delimited_init(CsvOptions{strict = true})
    defer delimited_destroy(&p)
    
    _, ok := delimited_parse(&p, transmute([]u8)string("a,b\rc,d"))
    testing.expect(t, !ok, "parse should fail")
    testing.expect_value(t, p.error.kind, CsvErrorKind.BareCR)
}

@(test)
test_delimited_error_bare_cr_lenient :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("a,b\rc,d\n"))
    testing.expect(t, ok, "parse should succeed in lenient mode")
    testing.expect_value(t, rows, u32(2))
}

@(test)
test_delimited_error_field_count_strict :: proc(t: ^testing.T) {
    p := delimited_init(CsvOptions{strict = true, expected_fields = 3})
    defer delimited_destroy(&p)
    
    _, ok := delimited_parse(&p, transmute([]u8)string("a,b,c\nd,e\n"))
    testing.expect(t, !ok, "parse should fail")
    testing.expect_value(t, p.error.kind, CsvErrorKind.FieldCountMismatch)
    testing.expect_value(t, p.error.row, u32(1))
}

// =============================================================================
// Span Parser Tests
// =============================================================================

@(test)
test_span_basic :: proc(t: ^testing.T) {
    p := span_init()
    defer span_destroy(&p)
    
    rows, ok := span_parse(&p, transmute([]u8)string("a,b,c\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    testing.expect_value(t, len(p.spans), 3)
    testing.expect_value(t, len(p.row_ends), 1)
    
    // Check spans
    testing.expect_value(t, p.spans[0], FieldSpan{0, 1, 0})
    testing.expect_value(t, p.spans[1], FieldSpan{2, 3, 0})
    testing.expect_value(t, p.spans[2], FieldSpan{4, 5, 0})
}

@(test)
test_span_quoted :: proc(t: ^testing.T) {
    p := span_init()
    defer span_destroy(&p)
    
    _, ok := span_parse(&p, transmute([]u8)string("\"a,b\",c\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, len(p.spans), 2)
    
    // Quoted field: start after quote, end before quote
    testing.expect_value(t, p.spans[0], FieldSpan{1, 4, SPAN_FLAG_QUOTED})
    testing.expect_value(t, p.spans[1], FieldSpan{6, 7, 0})
}

@(test)
test_span_empty_fields :: proc(t: ^testing.T) {
    p := span_init()
    defer span_destroy(&p)
    
    _, ok := span_parse(&p, transmute([]u8)string(",b,\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, len(p.spans), 3)
    
    testing.expect_value(t, p.spans[0], FieldSpan{0, 0, 0})  // empty
    testing.expect_value(t, p.spans[1], FieldSpan{1, 2, 0})  // "b"
    testing.expect_value(t, p.spans[2], FieldSpan{3, 3, 0})  // empty
}

@(test)
test_span_multi_row :: proc(t: ^testing.T) {
    p := span_init()
    defer span_destroy(&p)
    
    rows, ok := span_parse(&p, transmute([]u8)string("a,b\nc,d\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(2))
    testing.expect_value(t, len(p.spans), 4)
    testing.expect_value(t, len(p.row_ends), 2)
    
    testing.expect_value(t, p.row_ends[0], u32(2))  // first row ends at span index 2
    testing.expect_value(t, p.row_ends[1], u32(4))  // second row ends at span index 4
}

@(test)
test_span_escaped_quote :: proc(t: ^testing.T) {
    p := span_init()
    defer span_destroy(&p)
    
    // "a""b" -> field contains a""b, caller must unescape
    _, ok := span_parse(&p, transmute([]u8)string("\"a\"\"b\",c\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, len(p.spans), 2)
    
    // Span includes the "" escape sequence
    testing.expect_value(t, p.spans[0], FieldSpan{1, 5, SPAN_FLAG_QUOTED})
}

@(test)
test_span_base_offset :: proc(t: ^testing.T) {
    p := span_init()
    defer span_destroy(&p)
    
    _, ok := span_parse(&p, transmute([]u8)string("a,b\n"), 1000)
    testing.expect(t, ok, "parse should succeed")
    
    testing.expect_value(t, p.spans[0], FieldSpan{1000, 1001, 0})
    testing.expect_value(t, p.spans[1], FieldSpan{1002, 1003, 0})
}

// =============================================================================
// Streaming / Chunk Boundary Tests
// =============================================================================

@(test)
test_delimited_chunk_mid_field :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("abc"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(0))
    
    rows, ok = delimited_parse(&p, transmute([]u8)string("def,g\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "abcdef\x1Fg\x1E", "output mismatch")
}

@(test)
test_delimited_chunk_mid_quote :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("\"abc"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(0))
    
    rows, ok = delimited_parse(&p, transmute([]u8)string("def\",g\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "abcdef\x1Fg\x1E", "output mismatch")
}

@(test)
test_delimited_chunk_mid_escape :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    // Split right after first quote of ""
    rows, ok := delimited_parse(&p, transmute([]u8)string("\"a\""))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(0))
    
    rows, ok = delimited_parse(&p, transmute([]u8)string("\"b\",c\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "a\"b\x1Fc\x1E", "output mismatch")
}

@(test)
test_delimited_chunk_mid_crlf :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("a,b\r"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(0))
    
    rows, ok = delimited_parse(&p, transmute([]u8)string("\nc,d\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(2))
}

// =============================================================================
// Edge Cases
// =============================================================================

@(test)
test_delimited_empty_input :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string(""))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(0))
    
    rows, ok = delimited_finish(&p)
    testing.expect(t, ok, "finish should succeed")
    testing.expect_value(t, rows, u32(0))
    testing.expect_value(t, len(p.output), 0)
}

@(test)
test_delimited_only_newlines :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("\n\n\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(0))  // empty rows not emitted
}

@(test)
test_delimited_single_field :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    rows, ok := delimited_parse(&p, transmute([]u8)string("abc\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "abc\x1E", "output mismatch")
}

@(test)
test_delimited_quoted_only_quote :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    // """" = quoted field containing single quote
    rows, ok := delimited_parse(&p, transmute([]u8)string("\"\"\"\"\n"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(1))
    expect_bytes(t, p.output[:], "\"\x1E", "output mismatch")
}

@(test)
test_span_finish_no_newline :: proc(t: ^testing.T) {
    p := span_init()
    defer span_destroy(&p)
    
    rows, ok := span_parse(&p, transmute([]u8)string("a,b,c"))
    testing.expect(t, ok, "parse should succeed")
    testing.expect_value(t, rows, u32(0))
    
    rows, ok = span_finish(&p, 5)
    testing.expect(t, ok, "finish should succeed")
    testing.expect_value(t, rows, u32(1))
    testing.expect_value(t, len(p.spans), 3)
}


// =============================================================================
// Delimited Stringifier Tests
// =============================================================================

@(test)
test_stringify_basic :: proc(t: ^testing.T) {
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok := delimited_stringify(&s, transmute([]u8)string("a\x1Fb\x1Fc\x1E"))
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "a,b,c\n")
}

@(test)
test_stringify_multi_row :: proc(t: ^testing.T) {
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok := delimited_stringify(&s, transmute([]u8)string("a\x1Fb\x1Ec\x1Fd\x1E"))
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "a,b\nc,d\n")
}

@(test)
test_stringify_empty_fields :: proc(t: ^testing.T) {
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok := delimited_stringify(&s, transmute([]u8)string("\x1Fb\x1F\x1E"))
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], ",b,\n")
}

@(test)
test_stringify_quote_comma :: proc(t: ^testing.T) {
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok := delimited_stringify(&s, transmute([]u8)string("a,b\x1Fc\x1E"))
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "\"a,b\",c\n")
}

@(test)
test_stringify_quote_newline :: proc(t: ^testing.T) {
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok := delimited_stringify(&s, transmute([]u8)string("a\nb\x1Fc\x1E"))
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "\"a\nb\",c\n")
}

@(test)
test_stringify_escape_quote :: proc(t: ^testing.T) {
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok := delimited_stringify(&s, transmute([]u8)string("a\"b\x1Fc\x1E"))
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "\"a\"\"b\",c\n")
}

@(test)
test_stringify_always_quote :: proc(t: ^testing.T) {
    s := delimited_stringify_init(StringifyOptions{always_quote = true})
    defer delimited_stringify_destroy(&s)
    
    ok := delimited_stringify(&s, transmute([]u8)string("a\x1Fb\x1E"))
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "\"a\",\"b\"\n")
}

@(test)
test_stringify_crlf :: proc(t: ^testing.T) {
    s := delimited_stringify_init(StringifyOptions{line_ending = .CRLF})
    defer delimited_stringify_destroy(&s)
    
    ok := delimited_stringify(&s, transmute([]u8)string("a\x1Fb\x1E"))
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "a,b\r\n")
}

@(test)
test_stringify_custom_sep :: proc(t: ^testing.T) {
    s := delimited_stringify_init(StringifyOptions{separator = '\t'})
    defer delimited_stringify_destroy(&s)
    
    ok := delimited_stringify(&s, transmute([]u8)string("a\x1Fb\x1Fc\x1E"))
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "a\tb\tc\n")
}

@(test)
test_stringify_field_count_error :: proc(t: ^testing.T) {
    s := delimited_stringify_init(StringifyOptions{expected_fields = 3})
    defer delimited_stringify_destroy(&s)
    
    ok := delimited_stringify(&s, transmute([]u8)string("a\x1Fb\x1E"))
    testing.expect(t, !ok, "stringify should fail")
    testing.expect_value(t, s.error.kind, StringifyErrorKind.FieldCountMismatch)
    testing.expect_value(t, s.error.row, u32(0))
}

// =============================================================================
// Span Stringifier Tests
// =============================================================================

@(test)
test_span_stringify_basic :: proc(t: ^testing.T) {
    s := span_stringify_init()
    defer span_stringify_destroy(&s)
    
    source := transmute([]u8)string("a,b,c\n")
    spans := []FieldSpan{{0, 1, 0}, {2, 3, 0}, {4, 5, 0}}
    row_ends := []u32{3}
    
    ok := span_stringify(&s, source, spans, row_ends)
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "a,b,c\n")
}

@(test)
test_span_stringify_quoted :: proc(t: ^testing.T) {
    s := span_stringify_init()
    defer span_stringify_destroy(&s)
    
    // Source: "a,b",c\n - quoted field containing comma
    source := transmute([]u8)string("\"a,b\",c\n")
    spans := []FieldSpan{{1, 4, SPAN_FLAG_QUOTED}, {6, 7, 0}}
    row_ends := []u32{2}
    
    ok := span_stringify(&s, source, spans, row_ends)
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "\"a,b\",c\n")
}

@(test)
test_span_stringify_multi_row :: proc(t: ^testing.T) {
    s := span_stringify_init()
    defer span_stringify_destroy(&s)
    
    source := transmute([]u8)string("a,b\nc,d\n")
    spans := []FieldSpan{{0, 1, 0}, {2, 3, 0}, {4, 5, 0}, {6, 7, 0}}
    row_ends := []u32{2, 4}
    
    ok := span_stringify(&s, source, spans, row_ends)
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], "a,b\nc,d\n")
}

// =============================================================================
// Round-trip Tests
// =============================================================================

@(test)
test_roundtrip_basic :: proc(t: ^testing.T) {
    // Parse
    p := delimited_init()
    defer delimited_destroy(&p)
    
    input := "a,b,c\n"
    _, ok := delimited_parse(&p, transmute([]u8)input)
    testing.expect(t, ok, "parse should succeed")
    
    // Stringify
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok = delimited_stringify(&s, p.output[:])
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], input)
}

@(test)
test_roundtrip_quoted :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    input := "\"a,b\",c\n"
    _, ok := delimited_parse(&p, transmute([]u8)input)
    testing.expect(t, ok, "parse should succeed")
    
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok = delimited_stringify(&s, p.output[:])
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], input)
}

@(test)
test_roundtrip_escaped_quote :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    input := "\"a\"\"b\",c\n"
    _, ok := delimited_parse(&p, transmute([]u8)input)
    testing.expect(t, ok, "parse should succeed")
    
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok = delimited_stringify(&s, p.output[:])
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], input)
}

@(test)
test_roundtrip_newline_in_field :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    input := "\"a\nb\",c\n"
    _, ok := delimited_parse(&p, transmute([]u8)input)
    testing.expect(t, ok, "parse should succeed")
    
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok = delimited_stringify(&s, p.output[:])
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], input)
}

@(test)
test_roundtrip_empty_fields :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    input := ",b,\n"
    _, ok := delimited_parse(&p, transmute([]u8)input)
    testing.expect(t, ok, "parse should succeed")
    
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok = delimited_stringify(&s, p.output[:])
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], input)
}

@(test)
test_roundtrip_multi_row :: proc(t: ^testing.T) {
    p := delimited_init()
    defer delimited_destroy(&p)
    
    input := "a,b\nc,d\ne,f\n"
    _, ok := delimited_parse(&p, transmute([]u8)input)
    testing.expect(t, ok, "parse should succeed")
    
    s := delimited_stringify_init()
    defer delimited_stringify_destroy(&s)
    
    ok = delimited_stringify(&s, p.output[:])
    testing.expect(t, ok, "stringify should succeed")
    expect_bytes(t, s.output[:], input)
}

// =============================================================================
// LazyRow Encoder Tests
// =============================================================================

@(test)
test_lazyrow_encode_basic :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    // Single row: "a", "b", "c"
    input := transmute([]u8)string("a\x1Fb\x1Fc\x1E")
    written := lazyrow_encode(&e, input)
    
    testing.expect(t, written > 0, "should write data")
    
    // Verify format: row_length(4) + field_count(4) + 3*field_len(12) + data(3) = 23 bytes total
    testing.expect_value(t, len(e.output), 23)
}

@(test)
test_lazyrow_encode_empty_fields :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    // Row with empty fields: "", "b", ""
    input := transmute([]u8)string("\x1Fb\x1F\x1E")
    written := lazyrow_encode(&e, input)
    
    testing.expect(t, written > 0, "should write data")
    
    // field_count=3, field_lens=[0,1,0], data="b"
    // row_length = 4 + 3*4 + 1 = 17, total = 4 + 17 = 21
    testing.expect_value(t, len(e.output), 21)
}

@(test)
test_lazyrow_encode_multi_row :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    // Two rows
    input := transmute([]u8)string("a\x1Fb\x1Ec\x1Fd\x1E")
    written := lazyrow_encode(&e, input)
    
    testing.expect(t, written > 0, "should write data")
    
    // Should have two row_length headers
    testing.expect(t, len(e.output) > 8, "should have at least 2 row headers")
}

@(test)
test_lazyrow_encode_empty_input :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    written := lazyrow_encode(&e, []u8{})
    testing.expect_value(t, written, 0)
    testing.expect_value(t, len(e.output), 0)
}

@(test)
test_lazyrow_encode_single_field :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    input := transmute([]u8)string("hello\x1E")
    written := lazyrow_encode(&e, input)
    
    testing.expect(t, written > 0, "should write data")
    
    // field_count=1, field_len=5, data="hello"
    // row_length = 4 + 1*4 + 5 = 13, total = 4 + 13 = 17
    testing.expect_value(t, len(e.output), 17)
}

@(test)
test_lazyrow_encode_unicode :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    input := transmute([]u8)string("hello\x1F世界\x1E")
    written := lazyrow_encode(&e, input)
    
    testing.expect(t, written > 0, "should write data")
    testing.expect(t, len(e.output) > 0, "should encode unicode")
}

// =============================================================================
// LazyRow Decoder Tests
// =============================================================================

@(test)
test_lazyrow_decode_basic :: proc(t: ^testing.T) {
    // Encode first
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    input := transmute([]u8)string("a\x1Fb\x1Fc\x1E")
    lazyrow_encode(&e, input)
    
    // Decode
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    
    written := lazyrow_decode(&d, e.output[:])
    testing.expect(t, written > 0, "should decode data")
    expect_bytes(t, d.output[:], "a\x1Fb\x1Fc\x1E")
}

@(test)
test_lazyrow_decode_empty_fields :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    input := transmute([]u8)string("\x1Fb\x1F\x1E")
    lazyrow_encode(&e, input)
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    
    written := lazyrow_decode(&d, e.output[:])
    testing.expect(t, written > 0, "should decode data")
    expect_bytes(t, d.output[:], "\x1Fb\x1F\x1E")
}

@(test)
test_lazyrow_decode_multi_row :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    input := transmute([]u8)string("a\x1Fb\x1Ec\x1Fd\x1E")
    lazyrow_encode(&e, input)
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    
    written := lazyrow_decode(&d, e.output[:])
    testing.expect(t, written > 0, "should decode data")
    expect_bytes(t, d.output[:], "a\x1Fb\x1Ec\x1Fd\x1E")
}

@(test)
test_lazyrow_decode_incomplete_header :: proc(t: ^testing.T) {
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    
    // Only 3 bytes - not enough for row_length
    written := lazyrow_decode(&d, []u8{1, 2, 3})
    testing.expect_value(t, written, 0)
    testing.expect_value(t, d.consumed, 0)
}

@(test)
test_lazyrow_decode_incomplete_row :: proc(t: ^testing.T) {
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    
    // row_length=100 but only provide 10 bytes total
    input := []u8{100, 0, 0, 0, 1, 2, 3, 4, 5, 6}
    written := lazyrow_decode(&d, input)
    
    testing.expect_value(t, written, 0)
    testing.expect_value(t, d.consumed, 0)
}

@(test)
test_lazyrow_decode_single_field :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    input := transmute([]u8)string("hello\x1E")
    lazyrow_encode(&e, input)
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    
    written := lazyrow_decode(&d, e.output[:])
    testing.expect(t, written > 0, "should decode data")
    expect_bytes(t, d.output[:], "hello\x1E")
}

@(test)
test_lazyrow_decode_unicode :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    input := transmute([]u8)string("hello\x1F世界\x1E")
    lazyrow_encode(&e, input)
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    
    written := lazyrow_decode(&d, e.output[:])
    testing.expect(t, written > 0, "should decode data")
    expect_bytes(t, d.output[:], "hello\x1F世界\x1E")
}

// =============================================================================
// LazyRow Round-trip Tests
// =============================================================================

@(test)
test_lazyrow_roundtrip_basic :: proc(t: ^testing.T) {
    input := transmute([]u8)string("a\x1Fb\x1Fc\x1E")
    
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, input)
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    lazyrow_decode(&d, e.output[:])
    
    expect_bytes(t, d.output[:], "a\x1Fb\x1Fc\x1E")
}

@(test)
test_lazyrow_roundtrip_empty_fields :: proc(t: ^testing.T) {
    input := transmute([]u8)string("\x1F\x1F\x1E")
    
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, input)
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    lazyrow_decode(&d, e.output[:])
    
    expect_bytes(t, d.output[:], "\x1F\x1F\x1E")
}

@(test)
test_lazyrow_roundtrip_multi_row :: proc(t: ^testing.T) {
    input := transmute([]u8)string("a\x1Fb\x1Ec\x1Fd\x1Ee\x1Ff\x1E")
    
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, input)
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    lazyrow_decode(&d, e.output[:])
    
    expect_bytes(t, d.output[:], "a\x1Fb\x1Ec\x1Fd\x1Ee\x1Ff\x1E")
}

@(test)
test_lazyrow_roundtrip_large_fields :: proc(t: ^testing.T) {
    // Create a large field
    large := make([dynamic]u8)
    defer delete(large)
    for i := 0; i < 1000; i += 1 {
        append(&large, 'x')
    }
    append(&large, FIELD_SEP)
    append(&large, 'y')
    append(&large, RECORD_SEP)
    
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, large[:])
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    lazyrow_decode(&d, e.output[:])
    
    testing.expect(t, slice.equal(d.output[:], large[:]), "roundtrip should preserve data")
}

@(test)
test_lazyrow_roundtrip_many_fields :: proc(t: ^testing.T) {
    // Create row with 100 fields
    many := make([dynamic]u8)
    defer delete(many)
    for i := 0; i < 100; i += 1 {
        append(&many, 'a')
        if i < 99 {
            append(&many, FIELD_SEP)
        }
    }
    append(&many, RECORD_SEP)
    
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, many[:])
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    lazyrow_decode(&d, e.output[:])
    
    testing.expect(t, slice.equal(d.output[:], many[:]), "roundtrip should preserve data")
}

// =============================================================================
// LazyRow Streaming Tests
// =============================================================================

@(test)
test_lazyrow_decode_partial_then_complete :: proc(t: ^testing.T) {
    // Encode two rows
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1Ec\x1Fd\x1E"))
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    
    // Feed partial data (just first row header)
    written := lazyrow_decode(&d, e.output[:10])
    testing.expect_value(t, written, 0)
    
    // Feed complete data
    lazyrow_decoder_reset(&d)
    written = lazyrow_decode(&d, e.output[:])
    testing.expect(t, written > 0, "should decode complete data")
    expect_bytes(t, d.output[:], "a\x1Fb\x1Ec\x1Fd\x1E")
}

@(test)
test_lazyrow_encode_reset :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1E"))
    first_len := len(e.output)
    
    lazyrow_encoder_reset(&e)
    testing.expect_value(t, len(e.output), 0)
    
    lazyrow_encode(&e, transmute([]u8)string("c\x1Fd\x1E"))
    testing.expect_value(t, len(e.output), first_len)
}

@(test)
test_lazyrow_decode_reset :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1E"))
    
    d := lazyrow_decoder_init()
    defer lazyrow_decoder_destroy(&d)
    
    lazyrow_decode(&d, e.output[:])
    testing.expect(t, len(d.output) > 0, "should have output")
    
    lazyrow_decoder_reset(&d)
    testing.expect_value(t, len(d.output), 0)
    testing.expect_value(t, d.consumed, 0)
}

// =============================================================================
// Streaming LazyRow Decoder Tests
// =============================================================================

@(test)
test_streaming_lazyrow_basic :: proc(t: ^testing.T) {
    // Encode some data first
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1Ec\x1Fd\x1E"))
    
    // Decode with streaming decoder
    d := streaming_lazyrow_decoder_init(',', '\n')
    defer streaming_lazyrow_decoder_destroy(&d)
    
    written := streaming_lazyrow_decode(&d, e.output[:])
    testing.expect(t, written > 0, "should decode data")
    expect_bytes(t, d.output[:], "a,b\nc,d\n")
}

@(test)
test_streaming_lazyrow_incomplete_header :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1E"))
    
    d := streaming_lazyrow_decoder_init(',', '\n')
    defer streaming_lazyrow_decoder_destroy(&d)
    
    // Feed only 3 bytes (incomplete row_length header)
    written := streaming_lazyrow_decode(&d, e.output[:3])
    testing.expect_value(t, written, 0)
    testing.expect_value(t, len(d.carry), 3)
    
    // Feed rest of data
    written = streaming_lazyrow_decode(&d, e.output[3:])
    testing.expect(t, written > 0, "should decode after completing header")
    expect_bytes(t, d.output[:], "a,b\n")
}

@(test)
test_streaming_lazyrow_incomplete_row :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1E"))
    
    d := streaming_lazyrow_decoder_init(',', '\n')
    defer streaming_lazyrow_decoder_destroy(&d)
    
    // Feed only half the data
    half := len(e.output) / 2
    written := streaming_lazyrow_decode(&d, e.output[:half])
    testing.expect_value(t, written, 0)
    testing.expect(t, len(d.carry) > 0, "should buffer incomplete row")
    
    // Feed rest
    written = streaming_lazyrow_decode(&d, e.output[half:])
    testing.expect(t, written > 0, "should decode complete row")
    expect_bytes(t, d.output[:], "a,b\n")
}

@(test)
test_streaming_lazyrow_multi_chunk :: proc(t: ^testing.T) {
    // Encode multiple rows
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1Ec\x1Fd\x1Ee\x1Ff\x1E"))
    
    d := streaming_lazyrow_decoder_init(',', '\n')
    defer streaming_lazyrow_decoder_destroy(&d)
    
    // Feed in small chunks
    chunk_size := 10
    for i := 0; i < len(e.output); i += chunk_size {
        end := min(i + chunk_size, len(e.output))
        streaming_lazyrow_decode(&d, e.output[i:end])
    }
    
    expect_bytes(t, d.output[:], "a,b\nc,d\ne,f\n")
}

@(test)
test_streaming_lazyrow_empty_fields :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("\x1Fb\x1F\x1E"))
    
    d := streaming_lazyrow_decoder_init(',', '\n')
    defer streaming_lazyrow_decoder_destroy(&d)
    
    streaming_lazyrow_decode(&d, e.output[:])
    expect_bytes(t, d.output[:], ",b,\n")
}

@(test)
test_streaming_lazyrow_custom_separators :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1Fc\x1E"))
    
    d := streaming_lazyrow_decoder_init('\t', '\n')
    defer streaming_lazyrow_decoder_destroy(&d)
    
    streaming_lazyrow_decode(&d, e.output[:])
    expect_bytes(t, d.output[:], "a\tb\tc\n")
}

@(test)
test_streaming_lazyrow_clear_output :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1E"))
    
    d := streaming_lazyrow_decoder_init(',', '\n')
    defer streaming_lazyrow_decoder_destroy(&d)
    
    streaming_lazyrow_decode(&d, e.output[:])
    testing.expect(t, len(d.output) > 0, "should have output")
    
    streaming_lazyrow_clear_output(&d)
    testing.expect_value(t, len(d.output), 0)
}

@(test)
test_streaming_lazyrow_output_len :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1E"))
    
    d := streaming_lazyrow_decoder_init(',', '\n')
    defer streaming_lazyrow_decoder_destroy(&d)
    
    testing.expect_value(t, streaming_lazyrow_output_len(&d), 0)
    
    streaming_lazyrow_decode(&d, e.output[:])
    testing.expect(t, streaming_lazyrow_output_len(&d) > 0, "should have output")
}

@(test)
test_streaming_lazyrow_finish :: proc(t: ^testing.T) {
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, transmute([]u8)string("a\x1Fb\x1Ec\x1Fd\x1E"))
    
    d := streaming_lazyrow_decoder_init(',', '\n')
    defer streaming_lazyrow_decoder_destroy(&d)
    
    // Feed incomplete data
    half := len(e.output) / 2
    streaming_lazyrow_decode(&d, e.output[:half])
    
    // Finish should process remaining complete rows
    output_len := streaming_lazyrow_finish(&d)
    testing.expect(t, output_len >= 0, "finish should return output length")
}

@(test)
test_streaming_lazyrow_large_row :: proc(t: ^testing.T) {
    // Create a large field
    large := make([dynamic]u8)
    defer delete(large)
    for i := 0; i < 1000; i += 1 {
        append(&large, 'x')
    }
    append(&large, FIELD_SEP)
    append(&large, 'y')
    append(&large, RECORD_SEP)
    
    e := lazyrow_encoder_init()
    defer lazyrow_encoder_destroy(&e)
    lazyrow_encode(&e, large[:])
    
    d := streaming_lazyrow_decoder_init(',', '\n')
    defer streaming_lazyrow_decoder_destroy(&d)
    
    // Feed in small chunks
    chunk_size := 50
    for i := 0; i < len(e.output); i += chunk_size {
        end := min(i + chunk_size, len(e.output))
        streaming_lazyrow_decode(&d, e.output[i:end])
    }
    
    testing.expect(t, len(d.output) > 1000, "should decode large field")
}

// =============================================================================
// Streaming Record Stringifier Tests
// =============================================================================

@(test)
test_streaming_stringify_basic :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init(',', FIELD_SEP, RECORD_SEP, false, false)
    defer streaming_record_stringifier_destroy(&s)
    
    input := transmute([]u8)string("a\x1Fb\x1Fc\x1E")
    written := streaming_record_stringify(&s, input)
    
    testing.expect(t, written > 0, "should write data")
    expect_bytes(t, s.output[:], "a,b,c\n")
}

@(test)
test_streaming_stringify_incomplete_record :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init(',', FIELD_SEP, RECORD_SEP, false, false)
    defer streaming_record_stringifier_destroy(&s)
    
    // Feed incomplete record (no RECORD_SEP)
    written := streaming_record_stringify(&s, transmute([]u8)string("a\x1Fb"))
    testing.expect_value(t, written, 0)
    testing.expect(t, len(s.carry) > 0, "should buffer incomplete record")
    
    // Complete the record
    written = streaming_record_stringify(&s, transmute([]u8)string("\x1Fc\x1E"))
    testing.expect(t, written > 0, "should output complete record")
    expect_bytes(t, s.output[:], "a,b,c\n")
}

@(test)
test_streaming_stringify_multi_chunk :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init(',', FIELD_SEP, RECORD_SEP, false, false)
    defer streaming_record_stringifier_destroy(&s)
    
    // Feed data in chunks
    streaming_record_stringify(&s, transmute([]u8)string("a\x1Fb\x1E"))
    streaming_record_stringify(&s, transmute([]u8)string("c\x1Fd\x1E"))
    
    expect_bytes(t, s.output[:], "a,b\nc,d\n")
}

@(test)
test_streaming_stringify_quote_comma :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init(',', FIELD_SEP, RECORD_SEP, false, false)
    defer streaming_record_stringifier_destroy(&s)
    
    streaming_record_stringify(&s, transmute([]u8)string("a,b\x1Fc\x1E"))
    expect_bytes(t, s.output[:], "\"a,b\",c\n")
}

@(test)
test_streaming_stringify_quote_newline :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init(',', FIELD_SEP, RECORD_SEP, false, false)
    defer streaming_record_stringifier_destroy(&s)
    
    streaming_record_stringify(&s, transmute([]u8)string("a\nb\x1Fc\x1E"))
    expect_bytes(t, s.output[:], "\"a\nb\",c\n")
}

@(test)
test_streaming_stringify_escape_quote :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init(',', FIELD_SEP, RECORD_SEP, false, false)
    defer streaming_record_stringifier_destroy(&s)
    
    streaming_record_stringify(&s, transmute([]u8)string("a\"b\x1Fc\x1E"))
    expect_bytes(t, s.output[:], "\"a\"\"b\",c\n")
}

@(test)
test_streaming_stringify_always_quote :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init(',', FIELD_SEP, RECORD_SEP, false, true)
    defer streaming_record_stringifier_destroy(&s)
    
    streaming_record_stringify(&s, transmute([]u8)string("a\x1Fb\x1E"))
    expect_bytes(t, s.output[:], "\"a\",\"b\"\n")
}

@(test)
test_streaming_stringify_crlf :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init(',', FIELD_SEP, RECORD_SEP, true, false)
    defer streaming_record_stringifier_destroy(&s)
    
    streaming_record_stringify(&s, transmute([]u8)string("a\x1Fb\x1E"))
    expect_bytes(t, s.output[:], "a,b\r\n")
}

@(test)
test_streaming_stringify_custom_sep :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init('\t', FIELD_SEP, RECORD_SEP, false, false)
    defer streaming_record_stringifier_destroy(&s)
    
    streaming_record_stringify(&s, transmute([]u8)string("a\x1Fb\x1Fc\x1E"))
    expect_bytes(t, s.output[:], "a\tb\tc\n")
}

@(test)
test_streaming_stringify_empty_fields :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init(',', FIELD_SEP, RECORD_SEP, false, false)
    defer streaming_record_stringifier_destroy(&s)
    
    streaming_record_stringify(&s, transmute([]u8)string("\x1Fb\x1F\x1E"))
    expect_bytes(t, s.output[:], ",b,\n")
}

@(test)
test_streaming_stringify_output_len :: proc(t: ^testing.T) {
    s := streaming_record_stringifier_init(',', FIELD_SEP, RECORD_SEP, false, false)
    defer streaming_record_stringifier_destroy(&s)
    
    testing.expect_value(t, streaming_record_output_len(&s), 0)
    
    streaming_record_stringify(&s, transmute([]u8)string("a\x1Fb\x1E"))
    testing.expect(t, streaming_record_output_len(&s) > 0, "should have output")
}
