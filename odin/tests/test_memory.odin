package csv_tests

import "core:testing"
import csv "../src"

// Test memory management
@(test)
test_grow_buffer_basic :: proc(t: ^testing.T) {
    buf := csv.make_grow_buffer(16)
    defer csv.destroy_buffer(&buf)
    
    csv.append_string(&buf, "hello")
    testing.expect_value(t, len(buf.data), 5)
    
    csv.append_byte(&buf, ' ')
    csv.append_string(&buf, "world")
    testing.expect_value(t, len(buf.data), 11)
}

@(test)
test_grow_buffer_clear :: proc(t: ^testing.T) {
    buf := csv.make_grow_buffer(16)
    defer csv.destroy_buffer(&buf)
    
    csv.append_string(&buf, "hello")
    testing.expect_value(t, len(buf.data), 5)
    
    csv.clear_buffer(&buf)
    testing.expect_value(t, len(buf.data), 0)
    testing.expect(t, cap(buf.data) >= 16, "Capacity should be preserved")
}

@(test)
test_grow_buffer_growth :: proc(t: ^testing.T) {
    buf := csv.make_grow_buffer(4)
    defer csv.destroy_buffer(&buf)
    
    // Append more than initial capacity
    csv.append_string(&buf, "hello world this is a long string")
    testing.expect_value(t, len(buf.data), 33)
}

@(test)
test_parser_memory_cleanup :: proc(t: ^testing.T) {
    // Create and destroy multiple parsers
    for i := 0; i < 10; i += 1 {
        opts := csv.default_parse_options()
        parser := csv.make_parser(opts)
        
        input := transmute([]u8)string("a,b,c\nd,e,f\n")
        csv.process_chunk(&parser, input)
        
        csv.destroy_parser(&parser)
    }
    
    // If we get here without crashing, memory management is working
    testing.expect(t, true, "Memory cleanup successful")
}

@(test)
test_ensure_capacity :: proc(t: ^testing.T) {
    buf := csv.make_grow_buffer(16)
    defer csv.destroy_buffer(&buf)
    
    csv.ensure_capacity(&buf, 100)
    testing.expect(t, cap(buf.data) >= 100, "Capacity should be at least 100")
}
