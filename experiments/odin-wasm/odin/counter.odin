package main

import "base:runtime"

// Export function to process bytes and return UTF-16 string array
@(export)
process_bytes :: proc "c" (length: u32) -> u32 {
    // Access input data at memory offset 0
    data_ptr := ([^]u8)(rawptr(uintptr(0)))
    
    // Example: create some sample strings as UTF-16
    strings := []string{"hello", "world", "from", "odin"}
    
    // Serialize strings as UTF-16 to memory starting at offset 1MB
    output_offset: u32 = 1024 * 1024
    current_pos := output_offset
    
    context = runtime.default_context()
    
    // Write number of strings first
    num_strings := u32(len(strings))
    mem_ptr := ([^]u32)(rawptr(uintptr(current_pos)))
    mem_ptr[0] = num_strings
    current_pos += 4
    
    // Write each string as UTF-16
    for str in strings {
        str_bytes := transmute([]u8)str
        
        // Convert UTF-8 to UTF-16 (simplified - assumes ASCII for demo)
        utf16_len := u32(len(str_bytes)) // Each ASCII char becomes 2 bytes in UTF-16
        
        // Write length in bytes (not chars)
        len_ptr := ([^]u32)(rawptr(uintptr(current_pos)))
        len_ptr[0] = utf16_len * 2
        current_pos += 4
        
        // Write UTF-16 data (little-endian)
        utf16_ptr := ([^]u16)(rawptr(uintptr(current_pos)))
        for i in 0..<utf16_len {
            utf16_ptr[i] = u16(str_bytes[i]) // ASCII to UTF-16
        }
        current_pos += utf16_len * 2
    }
    
    return output_offset
}

// Required main procedure for WASM
main :: proc() {
    // Empty main for WASM module
}
