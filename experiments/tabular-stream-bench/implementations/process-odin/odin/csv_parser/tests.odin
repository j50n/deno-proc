package csv_parser

import "core:testing"
import "../string_row"

@(test)
test_basic_csv_parsing :: proc(t: ^testing.T) {
    csv_input := "a,b,c\n1,2,3"
    
    rows, ok := parse_csv_string_to_string_rows(csv_input)
    testing.expect(t, ok, "CSV parsing should succeed")
    defer {
        for row in rows {
            delete(row)
        }
        delete(rows)
    }
    
    testing.expect(t, len(rows) == 2, "Should have 2 rows")
    
    // Test first row
    result_0, ok_0 := string_row.deserialize(rows[0])
    testing.expect(t, ok_0, "First row deserialization should succeed")
    defer delete(result_0)
    testing.expect_value(t, len(result_0), 3)
    testing.expect_value(t, result_0[0], "a")
    testing.expect_value(t, result_0[1], "b")
    testing.expect_value(t, result_0[2], "c")
    
    // Test second row  
    result_1, ok_1 := string_row.deserialize(rows[1])
    testing.expect(t, ok_1, "Second row deserialization should succeed")
    defer delete(result_1)
    testing.expect_value(t, result_1[0], "1")
    testing.expect_value(t, result_1[1], "2")
    testing.expect_value(t, result_1[2], "3")
}

@(test)
test_quoted_fields :: proc(t: ^testing.T) {
    csv_input := `"hello","world","test"`
    
    rows, ok := parse_csv_string_to_string_rows(csv_input)
    testing.expect(t, ok, "Quoted CSV parsing should succeed")
    defer {
        for row in rows {
            delete(row)
        }
        delete(rows)
    }
    
    testing.expect(t, len(rows) == 1, "Should have 1 row")
    
    result, ok_result := string_row.deserialize(rows[0])
    testing.expect(t, ok_result, "Deserialization should succeed")
    defer delete(result)
    testing.expect_value(t, len(result), 3)
    testing.expect_value(t, result[0], "hello")
    testing.expect_value(t, result[1], "world")
    testing.expect_value(t, result[2], "test")
}

@(test)
test_empty_fields :: proc(t: ^testing.T) {
    csv_input := "a,,c\n,b,"
    
    rows, ok := parse_csv_string_to_string_rows(csv_input)
    testing.expect(t, ok, "Empty field CSV parsing should succeed")
    defer {
        for row in rows {
            delete(row)
        }
        delete(rows)
    }
    
    testing.expect(t, len(rows) == 2, "Should have 2 rows")
    
    // Test first row with empty middle field
    result_0, ok_0 := string_row.deserialize(rows[0])
    testing.expect(t, ok_0, "First row deserialization should succeed")
    defer delete(result_0)
    testing.expect_value(t, result_0[0], "a")
    testing.expect_value(t, result_0[1], "")
    testing.expect_value(t, result_0[2], "c")
    
    // Test second row with empty first and last fields
    result_1, ok_1 := string_row.deserialize(rows[1])
    testing.expect(t, ok_1, "Second row deserialization should succeed")
    defer delete(result_1)
    testing.expect_value(t, result_1[0], "")
    testing.expect_value(t, result_1[1], "b")
    testing.expect_value(t, result_1[2], "")
}

@(test)
test_single_row :: proc(t: ^testing.T) {
    csv_input := "single"
    
    rows, ok := parse_csv_string_to_string_rows(csv_input)
    testing.expect(t, ok, "Single field CSV parsing should succeed")
    defer {
        for row in rows {
            delete(row)
        }
        delete(rows)
    }
    
    testing.expect(t, len(rows) == 1, "Should have 1 row")
    
    result, ok_result := string_row.deserialize(rows[0])
    testing.expect(t, ok_result, "Deserialization should succeed")
    defer delete(result)
    testing.expect_value(t, len(result), 1)
    testing.expect_value(t, result[0], "single")
}

@(test)
test_empty_input :: proc(t: ^testing.T) {
    csv_input := ""
    
    rows, ok := parse_csv_string_to_string_rows(csv_input)
    testing.expect(t, ok, "Empty CSV parsing should succeed")
    defer {
        for row in rows {
            delete(row)
        }
        delete(rows)
    }
    
    testing.expect(t, len(rows) == 0, "Should have 0 rows")
}
