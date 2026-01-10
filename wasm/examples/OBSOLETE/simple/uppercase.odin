package main

import "core:slice"

// Simple uppercase converter for streaming text
@(export)
uppercase :: proc "c" (input_ptr: rawptr, input_len: int, output_ptr: rawptr) -> int {
    input := slice.from_ptr(cast(^u8)input_ptr, input_len)
    output := slice.from_ptr(cast(^u8)output_ptr, input_len)
    
    for i in 0..<input_len {
        char := input[i]
        if char >= 'a' && char <= 'z' {
            output[i] = char - 32  // Convert to uppercase
        } else {
            output[i] = char
        }
    }
    
    return input_len
}
