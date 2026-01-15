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
