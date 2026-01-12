package csv_wasm

import "base:runtime"

// Fast fixed-size buffer for output - no dynamic allocation in hot path
FastBuffer :: struct {
    data: []u8,
    len: int,
    cap: int,
    allocator: runtime.Allocator,
}

make_fast_buffer :: proc(capacity: int, allocator := context.allocator) -> FastBuffer {
    data := make([]u8, capacity, allocator)
    return FastBuffer{
        data = data,
        len = 0,
        cap = capacity,
        allocator = allocator,
    }
}

destroy_fast_buffer :: proc(buf: ^FastBuffer) {
    delete(buf.data, buf.allocator)
    buf.data = nil
    buf.len = 0
    buf.cap = 0
}

clear_fast_buffer :: proc(buf: ^FastBuffer) {
    buf.len = 0
}

ensure_fast_capacity :: proc(buf: ^FastBuffer, required: int) {
    if required > buf.cap {
        new_cap := max(required, buf.cap * 2)
        new_data := make([]u8, new_cap, buf.allocator)
        copy(new_data[:buf.len], buf.data[:buf.len])
        delete(buf.data, buf.allocator)
        buf.data = new_data
        buf.cap = new_cap
    }
}

// Inline byte append - no function call overhead
fast_append_byte :: #force_inline proc(buf: ^FastBuffer, b: u8) {
    if buf.len < buf.cap {
        buf.data[buf.len] = b
        buf.len += 1
    }
}

// Fast string copy - manual loop beats builtins in WASM
fast_append_string :: #force_inline proc(buf: ^FastBuffer, s: string) {
    n := len(s)
    if buf.len + n <= buf.cap {
        dst := buf.data[buf.len:]
        for i := 0; i < n; i += 1 {
            dst[i] = s[i]
        }
        buf.len += n
    }
}

// Legacy GrowBuffer for compatibility
GrowBuffer :: struct {
    data: [dynamic]u8,
    allocator: runtime.Allocator,
}

make_grow_buffer :: proc(initial_capacity: int = 4096, allocator := context.allocator) -> GrowBuffer {
    return GrowBuffer{
        data = make([dynamic]u8, 0, initial_capacity, allocator),
        allocator = allocator,
    }
}

ensure_capacity :: proc(buf: ^GrowBuffer, required: int) {
    if cap(buf.data) < required {
        reserve(&buf.data, required)
    }
}

clear_buffer :: proc(buf: ^GrowBuffer) {
    clear(&buf.data)
}

destroy_buffer :: proc(buf: ^GrowBuffer) {
    delete(buf.data)
    buf.data = nil
}

append_bytes :: proc(buf: ^GrowBuffer, bytes: []u8) {
    append(&buf.data, ..bytes)
}

append_byte :: proc(buf: ^GrowBuffer, b: u8) {
    append(&buf.data, b)
}

append_string :: proc(buf: ^GrowBuffer, s: string) {
    append(&buf.data, ..transmute([]u8)s)
}
