package main

import "core:fmt"
import "core:math"
import "core:slice"
import "base:runtime"

main :: proc() {}

// String memory management functions
@(export)
alloc_string :: proc "c" (size: int) -> rawptr {
	context = runtime.default_context()
	return raw_data(make([]byte, size))
}

@(export)
free_string :: proc "c" (ptr: rawptr, size: int) {
	// Memory freed when Odin's allocator reuses it
}

@(export)
free_buffer :: proc "c" (ptr: rawptr) {
	context = runtime.default_context()
	free(ptr)
}

// print_string prints a string and returns its length
@(export)
print_string :: proc "c" (ptr: rawptr, length: int) -> int {
	context = runtime.default_context()
	data := slice.from_ptr(cast(^u8)ptr, length)
	str := string(data)
	fmt.println(str)
	return length
}

// create_greeting returns a dynamically allocated greeting
// Returns: high 32 bits = length, low 32 bits = pointer
@(export)
create_greeting :: proc "c" (name_ptr: rawptr, name_len: int) -> i64 {
	context = runtime.default_context()
	name := string(slice.from_ptr(cast(^u8)name_ptr, name_len))
	msg := fmt.aprintf("Hello, {}!", name)
	ptr := i64(uintptr(raw_data(msg)))
	length := i64(len(msg))
	return (length << 32) | ptr
}

// Point represents a 2D coordinate
Point :: struct {
	x: f64,
	y: f64,
}

// create_point allocates and returns a Point struct
// Returns pointer to allocated Point
@(export)
create_point :: proc "c" (x: f64, y: f64) -> ^Point {
	context = runtime.default_context()
	p := new(Point)
	p.x = x
	p.y = y
	return p
}

// free_point frees an allocated Point
@(export)
free_point :: proc "c" (p: ^Point) {
	context = runtime.default_context()
	free(p)
}

// calculate_circle computes the area of a circle given its radius.
// Demonstrates math function integration between Odin and JavaScript.
// 
// Parameters:
//   radius: Circle radius as f64
// Returns:
//   Circle area (π * radius²) as f64
@(export)
calculate_circle :: proc "c" (radius: f64) -> f64 {
	// Use standard math functions to demonstrate WASM integration
	angle := math.PI / 4 // 45 degrees
	_ = math.sin(angle)  // Demonstrate math usage
	_ = math.cos(angle)  // Demonstrate math usage
	
	area := math.PI * radius * radius
	
	return area
}

// fibonacci calculates the nth Fibonacci number iteratively.
// Demonstrates integer computation and control flow in WASM.
//
// Parameters:
//   n: Position in Fibonacci sequence (0-based)
// Returns:
//   Fibonacci number at position n (0 for n=0, 1 for n=1, sequence value for n>1)
@(export)
fibonacci :: proc "c" (n: int) -> int {
	if n <= 1 do return n

	a, b := 0, 1
	for _ in 2 ..= n {
		a, b = b, a + b
	}

	return b
}

// allocate_memory demonstrates memory allocation concepts for WASM.
// Returns a fixed pointer for demonstration purposes (not real allocation).
//
// Parameters:
//   size: Requested allocation size in bytes
// Returns:
//   Pointer to allocated memory (nil if size <= 0, fixed demo pointer otherwise)
@(export)
allocate_memory :: proc "c" (size: int) -> rawptr {
	// Return a pointer to some memory area
	if size <= 0 do return nil
	return rawptr(uintptr(1024)) // Fixed offset for demo
}

// free_memory demonstrates memory deallocation concepts for WASM.
// Acknowledges memory free request (no actual deallocation in this demo).
//
// Parameters:
//   ptr: Pointer to memory to be freed
@(export)
free_memory :: proc "c" (ptr: rawptr) {
	// In a real implementation, you'd free the memory
	// For this demo, we just acknowledge the call
	_ = ptr
}

// greet_user demonstrates string handling between WASM and JavaScript.
// Calculates expected greeting message length without actual string processing.
//
// Parameters:
//   name_ptr: Pointer to name string in WASM memory
//   name_len: Length of name string in bytes
// Returns:
//   Expected length of "Hello, [name]!" message
@(export)
greet_user :: proc "c" (name_ptr: rawptr, name_len: int) -> int {
	// In a real implementation, you'd read the string from memory
	// and write a response back. For this demo, we just return a fixed length
	_ = name_ptr
	_ = name_len
	
	// Return length of "Hello, [name]!" message
	return name_len + 8 // "Hello, " (7) + "!" (1) = 8 extra chars
}
