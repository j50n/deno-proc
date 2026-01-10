package line_processor_dynamic_v2

import "core:mem"
import "core:slice"
import "base:runtime"

// Pool allocator with fixed-size blocks for better memory management
HEAP_SIZE :: 2 * 1024 * 1024  // 2MB heap
BLOCK_SIZE :: 4096            // 4KB blocks
NUM_BLOCKS :: HEAP_SIZE / BLOCK_SIZE

heap_memory: [HEAP_SIZE]u8
block_free: [NUM_BLOCKS]bool
block_allocated: int

pool_allocator_proc :: proc(allocator_data: rawptr, mode: mem.Allocator_Mode, 
                           size, alignment: int, old_memory: rawptr, old_size: int, 
                           location := #caller_location) -> ([]byte, mem.Allocator_Error) {
    
    #partial switch mode {
    case .Alloc, .Alloc_Non_Zeroed:
        // Find enough consecutive free blocks
        blocks_needed := (size + BLOCK_SIZE - 1) / BLOCK_SIZE
        
        if blocks_needed > NUM_BLOCKS {
            return nil, .Out_Of_Memory
        }
        
        // Find consecutive free blocks
        start_block := -1
        consecutive := 0
        
        for i in 0..<NUM_BLOCKS {
            if block_free[i] {
                if consecutive == 0 {
                    start_block = i
                }
                consecutive += 1
                if consecutive >= blocks_needed {
                    break
                }
            } else {
                consecutive = 0
                start_block = -1
            }
        }
        
        if consecutive < blocks_needed {
            return nil, .Out_Of_Memory
        }
        
        // Mark blocks as allocated
        for i in start_block..<start_block + blocks_needed {
            block_free[i] = false
        }
        block_allocated += blocks_needed
        
        offset := start_block * BLOCK_SIZE
        result := heap_memory[offset:offset + size]
        
        if mode == .Alloc {
            mem.zero_slice(result)
        }
        return result, .None
        
    case .Free:
        if old_memory == nil {
            return nil, .None
        }
        
        // Find which block this memory belongs to
        ptr_offset := uintptr(old_memory) - uintptr(raw_data(heap_memory[:]))
        if ptr_offset >= HEAP_SIZE {
            return nil, .Invalid_Pointer
        }
        
        start_block := int(ptr_offset / BLOCK_SIZE)
        blocks_to_free := (old_size + BLOCK_SIZE - 1) / BLOCK_SIZE
        
        // Mark blocks as free
        for i in start_block..<start_block + blocks_to_free {
            if i < NUM_BLOCKS {
                block_free[i] = true
            }
        }
        block_allocated -= blocks_to_free
        return nil, .None
        
    case .Free_All:
        for i in 0..<NUM_BLOCKS {
            block_free[i] = true
        }
        block_allocated = 0
        return nil, .None
        
    case .Resize, .Resize_Non_Zeroed:
        if old_memory == nil {
            alloc_mode := mem.Allocator_Mode.Alloc if mode == .Resize else mem.Allocator_Mode.Alloc_Non_Zeroed
            return pool_allocator_proc(allocator_data, alloc_mode, size, alignment, nil, 0, location)
        }
        
        // Simple resize: allocate new, copy, free old
        alloc_mode := mem.Allocator_Mode.Alloc if mode == .Resize else mem.Allocator_Mode.Alloc_Non_Zeroed
        new_memory, err := pool_allocator_proc(allocator_data, alloc_mode, size, alignment, nil, 0, location)
        if err != .None {
            return nil, err
        }
        
        copy_size := min(old_size, size)
        mem.copy(raw_data(new_memory), old_memory, copy_size)
        
        // Free old memory
        pool_allocator_proc(allocator_data, .Free, 0, 0, old_memory, old_size, location)
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

pool_allocator := mem.Allocator{
    procedure = pool_allocator_proc,
    data = nil,
}

// Initialize allocator
init_allocator :: proc "contextless" () {
    // Mark all blocks as free initially
    for i in 0..<NUM_BLOCKS {
        block_free[i] = true
    }
    block_allocated = 0
}

// Initialize context with pool allocator
init_context :: proc "contextless" () -> runtime.Context {
    ctx: runtime.Context
    ctx.allocator = pool_allocator
    ctx.temp_allocator = pool_allocator
    return ctx
}

// Dynamic memory management for line processing
leftover_data: []u8
output_data: [dynamic]u8

@(export)
init_processor :: proc "c" () {
    init_allocator()
}

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
    defer if len(combined_data) > 0 do delete(combined_data)
    
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
    
    return raw_data(output_data)
}

@(export)
get_output_size :: proc "c" () -> u32 {
    return u32(len(output_data))
}

@(export)
get_memory_stats :: proc "c" () -> u32 {
    // Return blocks allocated (for debugging)
    return u32(block_allocated)
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
