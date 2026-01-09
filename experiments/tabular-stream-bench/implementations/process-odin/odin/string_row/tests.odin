package string_row

import "core:testing"
import "core:strings"

@(test)
test_basic_serialization :: proc(t: ^testing.T) {
    columns := []string{"a", "b", "c"}
    
    serialized := serialize(columns)
    defer delete(serialized)
    
    result, ok := deserialize(serialized)
    testing.expect(t, ok, "Deserialization should succeed")
    defer delete(result)
    
    testing.expect(t, len(result) == 3, "Expected 3 columns")
    testing.expect(t, result[0] == "a", "Column 0 should be 'a'")
    testing.expect(t, result[1] == "b", "Column 1 should be 'b'")
    testing.expect(t, result[2] == "c", "Column 2 should be 'c'")
}

@(test)
test_empty_columns :: proc(t: ^testing.T) {
    columns := []string{"", "hello", ""}
    
    serialized := serialize(columns)
    defer delete(serialized)
    
    result, ok := deserialize(serialized)
    testing.expect(t, ok, "Deserialization should succeed")
    defer delete(result)
    
    testing.expect(t, result[0] == "", "Column 0 should be empty")
    testing.expect(t, result[1] == "hello", "Column 1 should be 'hello'")
    testing.expect(t, result[2] == "", "Column 2 should be empty")
}

@(test)
test_unicode_support :: proc(t: ^testing.T) {
    // Test various Unicode scenarios that JavaScript handles
    columns := []string{
        "café",        // Latin with accent (4 chars in both UTF-8 and UTF-16)
        "世界",         // CJK (2 chars in UTF-16, 6 bytes in UTF-8)
        "🌍",          // Emoji (2 UTF-16 code units, 4 bytes UTF-8)
        "a🌍b",        // Mixed ASCII + emoji (4 UTF-16 code units)
    }
    
    serialized := serialize(columns)
    defer delete(serialized)
    
    result, ok := deserialize(serialized)
    testing.expect(t, ok, "Deserialization should succeed")
    defer delete(result)
    
    testing.expect(t, len(result) == 4, "Should have 4 columns")
    testing.expect(t, result[0] == "café", "Column 0 should be 'café'")
    testing.expect(t, result[1] == "世界", "Column 1 should be '世界'")
    testing.expect(t, result[2] == "🌍", "Column 2 should be '🌍'")
    testing.expect(t, result[3] == "a🌍b", "Column 3 should be 'a🌍b'")
}

@(test)
test_large_strings :: proc(t: ^testing.T) {
    large_str := strings.repeat("x", 1000)
    defer delete(large_str)
    
    columns := []string{"small", large_str, "tiny"}
    
    serialized := serialize(columns)
    defer delete(serialized)
    
    result, ok := deserialize(serialized)
    testing.expect(t, ok, "Deserialization should succeed")
    defer delete(result)
    
    testing.expect(t, len(result[1]) == 1000, "Large string should have correct length")
    testing.expect(t, result[1] == large_str, "Large string should match original")
}

@(test)
test_binary_format_compatibility :: proc(t: ^testing.T) {
    columns := []string{"a", "bb", "ccc"}
    
    serialized := serialize(columns)
    defer delete(serialized)
    
    // Verify binary format structure
    // [columnCount:i32][positions:i32...][text_data]
    
    // Check column count (first 4 bytes)
    column_count := (cast(^i32)raw_data(serialized))^
    testing.expect(t, column_count == 3, "Column count should be 3")
    
    // Check text data starts after positions
    text_start := 4 + 4 * 4  // header + 4 positions
    text_data := string(serialized[text_start:])
    expected_text := "abbccc"
    testing.expect(t, text_data == expected_text, "Text data should be concatenated correctly")
}

@(test)
test_empty_array :: proc(t: ^testing.T) {
    columns := []string{}
    
    serialized := serialize(columns)
    defer delete(serialized)
    
    result, ok := deserialize(serialized)
    testing.expect(t, ok, "Deserialization should succeed")
    defer delete(result)
    
    testing.expect(t, len(result) == 0, "Empty array should have 0 columns")
}

@(test)
test_single_column :: proc(t: ^testing.T) {
    columns := []string{"single"}
    
    serialized := serialize(columns)
    defer delete(serialized)
    
    result, ok := deserialize(serialized)
    testing.expect(t, ok, "Deserialization should succeed")
    defer delete(result)
    
    testing.expect(t, len(result) == 1, "Should have 1 column")
    testing.expect(t, result[0] == "single", "Single column should be 'single'")
}

@(test)
test_error_handling :: proc(t: ^testing.T) {
    // Test invalid buffer sizes
    empty_buffer := []u8{}
    result, ok := deserialize(empty_buffer)
    testing.expect(t, !ok, "Empty buffer should fail")
    testing.expect(t, result == nil, "Result should be nil on failure")
    
    // Test buffer too small for header
    small_buffer := []u8{1, 0, 0, 0}  // column_count=1 but no positions
    result2, ok2 := deserialize(small_buffer)
    testing.expect(t, !ok2, "Undersized buffer should fail")
    testing.expect(t, result2 == nil, "Result should be nil on failure")
    
    // Test negative column count
    negative_buffer := []u8{0xFF, 0xFF, 0xFF, 0xFF, 0, 0, 0, 0}  // -1 columns
    result3, ok3 := deserialize(negative_buffer)
    testing.expect(t, !ok3, "Negative column count should fail")
    testing.expect(t, result3 == nil, "Result should be nil on failure")
}
