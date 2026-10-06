/// Bytes past the end of the data that a scan may read: SIMD classification
/// works on whole 64-byte blocks. Every buffer a scan reads keeps this much
/// extra.
let scanPadding = 64

/// Bytes past the end of a copy that `copyWithSlack` may write. Every buffer
/// it writes keeps this much extra.
let copySlack = 16

/// An allocated array that only grows. Elements past what its owner wrote are
/// unspecified. It frees itself, so it can't be copied.
struct GrowableBuffer<Element>: ~Copyable {
    private(set) var base: UnsafeMutablePointer<Element>
    private(set) var capacity: Int

    init(capacity: Int) {
        base = .allocate(capacity: capacity)
        self.capacity = capacity
    }

    deinit { base.deallocate() }

    /// Makes room for `needed` elements, keeping the first `keeping`. It at
    /// least doubles when it grows, and the base moves, so pointers handed
    /// out earlier go stale.
    mutating func reserve(_ needed: Int, keeping: Int) {
        guard needed > capacity else { return }
        let grownCapacity = max(needed, capacity * 2)
        let grown = UnsafeMutablePointer<Element>.allocate(capacity: grownCapacity)
        grown.moveInitialize(from: base, count: keeping)
        base.deallocate()
        base = grown
        capacity = grownCapacity
    }

    /// Moves `count` elements starting at `from` to the front.
    func moveToFront(from: Int, count: Int) {
        guard from > 0, count > 0 else { return }
        UnsafeMutableRawPointer(base).copyMemory(
            from: base + from, byteCount: count * MemoryLayout<Element>.stride)
    }
}

/// Copies `count` bytes (at least one) 16 at a time. Short runs are the
/// common case, so it may read up to 15 bytes past `src + count` and write up
/// to 15 past `dst + count`; callers keep `copySlack` on both sides.
@inline(__always)
func copyWithSlack(_ dst: UnsafeMutablePointer<UInt8>, _ src: UnsafePointer<UInt8>, _ count: Int) {
    var k = 0
    repeat {
        let v = UnsafeRawPointer(src + k).loadUnaligned(as: SIMD16<UInt8>.self)
        UnsafeMutableRawPointer(dst + k).storeBytes(of: v, as: SIMD16<UInt8>.self)
        k &+= 16
    } while k < count
}

enum ASCII {
    static let tab: UInt8 = 0x09
    static let lf: UInt8 = 0x0A
    static let cr: UInt8 = 0x0D
    static let quote: UInt8 = 0x22
    static let unitSeparator: UInt8 = 0x1F
    static let recordSeparator: UInt8 = 0x1E
}
