package line_processor_dynamic

import "core:mem"
import "core:slice"
import "base:runtime"

// Simple bump allocator for WASM with memory growth
INITIAL_HEAP_SIZE :: 8 * 1024 * 1024  // 8MB initial heap
heap_memory: []u8
heap_offset: uintptr

// Initialize heap with external memory
init_heap :: proc "contextless" (memory_ptr: rawptr, size: int) {
    heap_memory = slice.from_ptr(cast(^u8)memory_ptr, size)
    heap_offset = 0
}

bump_allocator_proc :: proc(allocator_data: rawptr, mode: mem.Allocator_Mode, 
                           size, alignment: int, old_memory: rawptr, old_size: int, 
                           location := #caller_location) -> ([]byte, mem.Allocator_Error) {
    
    #partial switch mode {
    case .Alloc, .Alloc_Non_Zeroed:
        aligned_offset := mem.align_forward_uintptr(heap_offset, uintptr(alignment))
        if aligned_offset + uintptr(size) > uintptr(len(heap_memory)) {
            return nil, .Out_Of_Memory
        }
        
        result := heap_memory[aligned_offset:aligned_offset + uintptr(size)]
        heap_offset = aligned_offset + uintptr(size)
        
        if mode == .Alloc {
            mem.zero_slice(result)
        }
        return result, .None
        
    case .Free:
        // Bump allocator doesn't support individual frees
        return nil, .None
        
    case .Free_All:
        heap_offset = 0
        return nil, .None
        
    case .Resize, .Resize_Non_Zeroed:
        if old_memory == nil {
            alloc_mode := mem.Allocator_Mode.Alloc if mode == .Resize else mem.Allocator_Mode.Alloc_Non_Zeroed
            return bump_allocator_proc(allocator_data, alloc_mode, size, alignment, nil, 0, location)
        }
        
        alloc_mode := mem.Allocator_Mode.Alloc if mode == .Resize else mem.Allocator_Mode.Alloc_Non_Zeroed
        new_memory, err := bump_allocator_proc(allocator_data, alloc_mode, size, alignment, nil, 0, location)
        if err != .None {
            return nil, err
        }
        
        copy_size := min(old_size, size)
        mem.copy(raw_data(new_memory), old_memory, copy_size)
        return new_memory, .None
        
    case .Query_Features:
        set := (^mem.Allocator_Mode_Set)(old_memory)
        if set != nil {
            set^ = {.Alloc, .Alloc_Non_Zeroed, .Free, .Free_All, .Resize, .Resize_Non_Zeroed, .Query_Features}
        }
        return nil, .None
        
    case .Query_Info:
        return nil, .Mode_Not_Implemented
    }
    
    return nil, .Mode_Not_Implemented
}

bump_allocator := mem.Allocator{
    procedure = bump_allocator_proc,
    data = nil,
}

// Initialize context with our custom allocator
init_context :: proc "contextless" () -> runtime.Context {
    ctx: runtime.Context
    ctx.allocator = bump_allocator
    ctx.temp_allocator = bump_allocator
    return ctx
}

@(export)
init_memory :: proc "c" (memory_ptr: rawptr, size: u32) {
    init_heap(memory_ptr, int(size))
}

@(export)
get_heap_usage :: proc "c" () -> u32 {
    return u32(heap_offset)
}

// Dynamic memory management for line processing
leftover_data: []u8
output_data: [dynamic]u8

@(export)
process_lines_dynamic :: proc "c" (input_ptr: rawptr, input_len: u32) -> rawptr {
    context = init_context()
    
    // Get input data
    input_data: []u8
    if input_len > 0 {
        input_data = slice.from_ptr(cast(^u8)input_ptr, int(input_len))
    }
    
    // Combine with leftover data
    combined_data: []u8
    if len(leftover_data) > 0 {
        combined_data = make([]u8, len(leftover_data) + len(input_data))
        copy(combined_data[:len(leftover_data)], leftover_data)
        if len(input_data) > 0 {
            copy(combined_data[len(leftover_data):], input_data)
        }
        delete(leftover_data)
        leftover_data = nil
    } else if len(input_data) > 0 {
        combined_data = make([]u8, len(input_data))
        copy(combined_data, input_data)
    }
    
    // Clear previous output
    clear(&output_data)
    
    // Process lines
    line_start := 0
    
    for i in 0..<len(combined_data) {
        if combined_data[i] == '\n' {
            line_end := i
            
            // Remove trailing \r if present
            if line_end > line_start && combined_data[line_end-1] == '\r' {
                line_end -= 1
            }
            
            line_len := u32(line_end - line_start)
            
            // Write 32-bit length prefix (little-endian)
            length_bytes := transmute([4]u8)line_len
            append(&output_data, length_bytes[0])
            append(&output_data, length_bytes[1])
            append(&output_data, length_bytes[2])
            append(&output_data, length_bytes[3])
            
            // Write line data
            if line_len > 0 {
                for j in line_start..<line_end {
                    append(&output_data, combined_data[j])
                }
            }
            
            line_start = i + 1
        }
    }
    
    // Handle leftover data
    if line_start < len(combined_data) {
        leftover_len := len(combined_data) - line_start
        leftover_data = make([]u8, leftover_len)
        copy(leftover_data, combined_data[line_start:])
    }
    
    if len(combined_data) > 0 {
        delete(combined_data)
    }
    
    return raw_data(output_data)
}

@(export)
get_output_size :: proc "c" () -> u32 {
    return u32(len(output_data))
}

@(export)
reset_processor :: proc "c" () {
    context = init_context()
    
    if len(leftover_data) > 0 {
        delete(leftover_data)
        leftover_data = nil
    }
    clear(&output_data)
}

@(export)
get_leftover_size :: proc "c" () -> u32 {
    return u32(len(leftover_data))
}

// Flush remaining leftover data as final line
@(export)
flush_leftover :: proc "c" () -> rawptr {
    context = init_context()
    
    if len(leftover_data) == 0 {
        return nil
    }
    
    // Clear previous output
    clear(&output_data)
    
    // Write leftover as final line
    line_len := u32(len(leftover_data))
    length_bytes := transmute([4]u8)line_len
    append(&output_data, length_bytes[0])
    append(&output_data, length_bytes[1])
    append(&output_data, length_bytes[2])
    append(&output_data, length_bytes[3])
    
    for byte in leftover_data {
        append(&output_data, byte)
    }
    
    delete(leftover_data)
    leftover_data = nil
    
    return raw_data(output_data)
}
