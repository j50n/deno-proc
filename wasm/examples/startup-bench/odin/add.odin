package main

main :: proc() {}

@(export)
add :: proc "c" (a: i32, b: i32) -> i32 {
	return a + b
}
