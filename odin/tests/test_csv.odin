package csv_tests

import "core:testing"
import csv "../src"

// Test full parser with simple input
@(test)
test_parser_simple :: proc(t: ^testing.T) {
    opts := csv.default_parse_options()
    parser := csv.make_parser(opts)
    defer csv.destroy_parser(&parser)
    
    input := transmute([]u8)string("a,b,c\nd,e,f\n")
    rows, bytes := csv.process_chunk(&parser, input)
    
    testing.expect_value(t, rows, 2)
    testing.expect(t, bytes > 0, "Should have output bytes")
    
    output := csv.get_output(&parser)
    output_str := string(output)
    testing.expect(t, len(output_str) > 0, "Should have output")
}

@(test)
test_parser_quoted :: proc(t: ^testing.T) {
    opts := csv.default_parse_options()
    parser := csv.make_parser(opts)
    defer csv.destroy_parser(&parser)
    
    input := transmute([]u8)string("\"hello\",\"world\"\n")
    rows, _ := csv.process_chunk(&parser, input)
    
    testing.expect_value(t, rows, 1)
}

@(test)
test_parser_escaped_quotes :: proc(t: ^testing.T) {
    opts := csv.default_parse_options()
    parser := csv.make_parser(opts)
    defer csv.destroy_parser(&parser)
    
    input := transmute([]u8)string("\"say \"\"hi\"\"\"\n")
    rows, _ := csv.process_chunk(&parser, input)
    
    testing.expect_value(t, rows, 1)
    
    output := string(csv.get_output(&parser))
    // Should contain unescaped quote
    testing.expect(t, output == "say \"hi\"", "Should unescape quotes")
}

@(test)
test_parser_chunked :: proc(t: ^testing.T) {
    opts := csv.default_parse_options()
    parser := csv.make_parser(opts)
    defer csv.destroy_parser(&parser)
    
    // Send data in two chunks, splitting in middle of quoted field
    chunk1 := transmute([]u8)string("a,b,c\n\"hel")
    chunk2 := transmute([]u8)string("lo\",f\n")
    
    rows1, _ := csv.process_chunk(&parser, chunk1)
    testing.expect_value(t, rows1, 1) // Only first row complete
    
    rows2, _ := csv.process_chunk(&parser, chunk2)
    testing.expect_value(t, rows2, 1) // Second row now complete
}

@(test)
test_parser_quoted_multiline :: proc(t: ^testing.T) {
    opts := csv.default_parse_options()
    parser := csv.make_parser(opts)
    defer csv.destroy_parser(&parser)
    
    // Quoted field with embedded newline
    input := transmute([]u8)string("a,\"hello\nworld\",c\n")
    rows, _ := csv.process_chunk(&parser, input)
    
    testing.expect_value(t, rows, 1)
}

@(test)
test_parser_trailing_empty :: proc(t: ^testing.T) {
    opts := csv.default_parse_options()
    parser := csv.make_parser(opts)
    defer csv.destroy_parser(&parser)
    
    input := transmute([]u8)string(",b,\n")
    rows, _ := csv.process_chunk(&parser, input)
    
    testing.expect_value(t, rows, 1)
    
    output := string(csv.get_output(&parser))
    // Should have 3 fields: empty, b, empty
    // Format: field1 FIELD_SEP field2 FIELD_SEP field3
    parts := 0
    for c in output {
        if c == rune(csv.FIELD_SEP) {
            parts += 1
        }
    }
    testing.expect_value(t, parts, 2) // 2 separators = 3 fields
}

@(test)
test_parser_empty_fields :: proc(t: ^testing.T) {
    opts := csv.default_parse_options()
    parser := csv.make_parser(opts)
    defer csv.destroy_parser(&parser)
    
    input := transmute([]u8)string("a,,c\n")
    rows, _ := csv.process_chunk(&parser, input)
    
    testing.expect_value(t, rows, 1)
}
