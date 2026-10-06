import SIMDKernels

/// Converts TSV to RFC 4180 CSV in chunks, bytes in and bytes out.
///
/// A field is quoted when it holds the separator or a quote, with each quote
/// doubled; anything else is copied as is. As the TSV reader does, it drops
/// every CR (TSV can't hold one in a field, and CRLF files then read like LF
/// files) and skips blank lines. Lines end in LF, or CRLF when `crlf`.
///
/// Whether a field needs quotes is known only at its end, so a field cut off
/// by the end of a chunk is not written yet: its bytes move to the front of
/// `input`, ahead of the next chunk, which is why the caller asks for
/// `nextChunk` before writing each one. What the scan found in the field is
/// kept, and the next scan starts after it, so a field longer than many
/// chunks is still scanned once.
///
/// A field of n bytes writes at most 2n + 2 bytes and its tab or line end at
/// most 2 more, so output three times the scanned input, plus slack, never
/// fills.
final class TSVToCSV {
    let chunkCapacity: Int
    let separator: UInt8
    let crlf: Bool
    private(set) var input: GrowableBuffer<UInt8>
    private(set) var output: GrowableBuffer<UInt8>
    /// Bytes of the cut-off field at the front of `input`.
    private var carried = 0
    /// What the scan found in the carried field.
    private var carriedScan = FieldScan()
    /// Whether the carried field (or the next one) starts a line.
    private var atLineStart = true

    init(separator: UInt8, crlf: Bool, chunkCapacity: Int) {
        self.separator = separator
        self.crlf = crlf
        self.chunkCapacity = chunkCapacity
        input = GrowableBuffer(capacity: chunkCapacity + scanPadding)
        output = GrowableBuffer(capacity: 3 * (chunkCapacity + scanPadding) + copySlack)
    }

    /// Where the caller writes the next chunk of at most `chunkCapacity` bytes.
    var nextChunk: UnsafeMutablePointer<UInt8> { input.base + carried }

    /// Converts `count` bytes written at `nextChunk` and returns the bytes in
    /// `output`. When `last`, the stream ends here.
    func feed(_ count: Int, last: Bool) -> Int {
        let total = carried + count
        output.reserve(3 * total + 3 + copySlack, keeping: 0)
        // Locals, not stored properties, for the reason in `CSVLexer.scan`.
        let src = UnsafePointer(input.base)
        let separator = self.separator
        let crlf = self.crlf
        var writer = CSVFieldWriter(out: output.base)
        var fieldStart = 0
        var scan = carriedScan
        var atLineStart = self.atLineStart

        func endLine(at end: Int) {
            let blank = atLineStart && end &- fieldStart == scan.crs
            if !blank {
                writer.field(src + fieldStart, count: end &- fieldStart, scan)
                if crlf { writer.byte(ASCII.cr) }
                writer.byte(ASCII.lf)
            }
            scan = FieldScan()
            atLineStart = true
        }

        let scanned = carried
        forEachSpecial(src + scanned, count: count, ASCII.tab, separator) { offset in
            let position = scanned &+ offset
            let b = src[position]
            if b == ASCII.tab {
                writer.field(src + fieldStart, count: position &- fieldStart, scan)
                writer.byte(separator)
                scan = FieldScan()
                fieldStart = position &+ 1
                atLineStart = false
            } else if b == ASCII.lf {
                endLine(at: position)
                fieldStart = position &+ 1
            } else if b == ASCII.cr {
                scan.crs &+= 1
            } else {
                scan.needsQuotes = true
                if b == ASCII.quote { scan.hasQuote = true }
            }
        }

        if last {
            endLine(at: total)
            carried = 0
        } else {
            carried = total &- fieldStart
            input.moveToFront(from: fieldStart, count: carried)
            input.reserve(carried + chunkCapacity + scanPadding, keeping: carried)
        }
        carriedScan = scan
        self.atLineStart = atLineStart
        return writer.count
    }
}

/// What a scan has found in a field so far.
struct FieldScan {
    /// It holds the separator or a quote.
    var needsQuotes = false
    var hasQuote = false
    var crs = 0
}

/// Calls `body`, in order, with the position of every byte in `p[0..<count]`
/// that is a quote, LF, CR, `a` or `b`. It finds them 64 bytes at a time with
/// simd128 and reads up to `scanPadding` bytes past `count`.
@inline(__always)
private func forEachSpecial(
    _ p: UnsafePointer<UInt8>, count: Int, _ a: UInt8, _ b: UInt8,
    _ body: (Int) -> Void
) {
    var block = 0
    while block < count {
        var specials = special_mask64(p + block, a, b)
        if count &- block < 64 {
            specials &= (UInt64(1) &<< UInt64(count &- block)) &- 1
        }
        while specials != 0 {
            body(block &+ specials.trailingZeroBitCount)
            specials &= specials &- 1
        }
        block &+= 64
    }
}

/// Writes CSV fields into a buffer with room for everything it's given.
struct CSVFieldWriter {
    let out: UnsafeMutablePointer<UInt8>
    var count = 0

    init(out: UnsafeMutablePointer<UInt8>) { self.out = out }

    @inline(__always)
    mutating func byte(_ b: UInt8) {
        out[count] = b
        count &+= 1
    }

    /// Writes `n` bytes of TSV as one CSV field, given what a scan found in
    /// them: quoted if needed, quotes doubled, CRs dropped.
    @inline(__always)
    mutating func field(_ bytes: UnsafePointer<UInt8>, count n: Int, _ scan: FieldScan) {
        if scan.needsQuotes { byte(ASCII.quote) }
        if !scan.hasQuote && scan.crs == 0 {
            if n > 0 {
                copyWithSlack(out + count, bytes, n)
                count &+= n
            }
        } else {
            for i in 0..<n {
                let b = bytes[i]
                if b == ASCII.cr { continue }
                byte(b)
                if b == ASCII.quote { byte(ASCII.quote) }
            }
        }
        if scan.needsQuotes { byte(ASCII.quote) }
    }
}
