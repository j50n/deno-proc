/// Converts CSV to TSV in chunks, bytes in and bytes out. Fields end in tab
/// and rows in LF.
///
/// TSV has no way to hold a tab, LF or CR inside a field. Replacing one would
/// change the data without a word, and writing it raw would turn one row into
/// several downstream, so the conversion refuses instead: the first such byte
/// is recorded with its row and field, and the caller reports it. The same
/// rule as writing rows with `toTsv`. A CR the lexer refuses in the CSV is
/// recorded the same way, whichever comes first. A row whose only field is
/// empty comes out as a blank line, which TSV readers skip; TSV can't say it
/// either.
///
/// Every input byte makes at most one output byte, and the end of the stream
/// one more, so `output` (one byte longer than a chunk, plus slack) never
/// fills. Output is not held back: a row may straddle two outputs.
final class CSVToTSV: StreamOperation {
    let chunkCapacity: Int
    /// Where the caller writes each chunk of at most `chunkCapacity` bytes.
    let input: UnsafeMutablePointer<UInt8>
    let output: UnsafeMutablePointer<UInt8>
    private var lexer: CSVLexer
    private var position = Position()

    init(separator: UInt8, chunkCapacity: Int) {
        self.chunkCapacity = chunkCapacity
        input = .allocate(capacity: chunkCapacity + scanPadding)
        output = .allocate(capacity: chunkCapacity + 1 + copySlack)
        lexer = CSVLexer(separator: separator, extra: ASCII.tab)
    }

    /// Converts `count` bytes from `input` and returns the bytes written to
    /// `output`, or -1 once the input has had a byte refused. When `last`,
    /// the stream ends here.
    func feed(_ count: Int, last: Bool) -> Int {
        var sink = TSVWriter(out: output, position: position, refusal: refusal)
        var lexer = self.lexer
        lexer.scan(input, count: count, into: &sink)
        if last { lexer.finish(into: &sink) }
        self.lexer = lexer
        position = sink.position
        return refused ? -1 : sink.count
    }
}

struct TSVWriter: CSVSink {
    static var tracksText: Bool { false }

    let out: UnsafeMutablePointer<UInt8>
    var count = 0
    var position: Position
    let refusal: UnsafeMutablePointer<Invalid>

    init(
        out: UnsafeMutablePointer<UInt8>, position: Position,
        refusal: UnsafeMutablePointer<Invalid>
    ) {
        self.out = out
        self.position = position
        self.refusal = refusal
    }

    @inline(__always)
    mutating func content(_ bytes: UnsafePointer<UInt8>, count n: Int) {
        copyWithSlack(out + count, bytes, n)
        count &+= n
    }

    /// Content runs never hold a tab, LF or CR, since the lexer treats all
    /// three as special, so this is the only place to look for them.
    @inline(__always)
    mutating func byte(_ b: UInt8) {
        if b == ASCII.tab || b == ASCII.lf || b == ASCII.cr {
            refuse(b, inOutput: true)
        }
        out[count] = b
        count &+= 1
    }

    @inline(__always)
    mutating func fieldEnd(utf8Excess: Int) {
        out[count] = ASCII.tab
        count &+= 1
        position.field &+= 1
    }

    @inline(__always)
    mutating func rowEnd(utf8Excess: Int) {
        out[count] = ASCII.lf
        count &+= 1
        position.row &+= 1
        position.field = 1
    }
}
