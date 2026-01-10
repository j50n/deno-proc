package main

import "core:math"
import "core:testing"

// Logic functions for testing (duplicated for testing)
fibonacci_logic :: proc(n: int) -> int {
	if n <= 1 do return n

	a, b := 0, 1
	for _ in 2 ..= n {
		a, b = b, a + b
	}
	return b
}

circle_area_logic :: proc(radius: f64) -> f64 {
	return math.PI * radius * radius
}

// Tests
@(test)
test_fibonacci_base_cases :: proc(t: ^testing.T) {
	testing.expect_value(t, fibonacci_logic(0), 0)
	testing.expect_value(t, fibonacci_logic(1), 1)
}

@(test)
test_fibonacci_sequence :: proc(t: ^testing.T) {
	testing.expect_value(t, fibonacci_logic(5), 5)
	testing.expect_value(t, fibonacci_logic(10), 55)
	testing.expect_value(t, fibonacci_logic(15), 610)
}

@(test)
test_circle_area :: proc(t: ^testing.T) {
	testing.expect_value(t, circle_area_logic(1.0), math.PI)
	testing.expect_value(t, circle_area_logic(2.0), math.PI * 4)
	testing.expect_value(t, circle_area_logic(5.0), math.PI * 25)
}
