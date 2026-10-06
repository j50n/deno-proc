import SIMDKernels

/// Receives what a `CSVLexer` finds. Every method is called in input order.
protocol CSVSink {
    /// Whether the sink reads `utf8Excess`. When false the lexer never
    /// computes it, and the code for it is specialized away.
    static var tracksText: Bool { get }

    /// Field content copied as is: a run with no special bytes in it.
    mutating func content(_ bytes: UnsafePointer<UInt8>, count: Int)

    /// One byte of field content that a run left out: an escaped quote; a
    /// separator, LF or CR inside quotes; or the lexer's `extra` byte.
    mutating func byte(_ b: UInt8)

    /// A field ended, and its row goes on. `utf8Excess` counts, from the start
    /// of the stream and wrapping, how many more UTF-8 bytes than UTF-16 code
    /// units the input has had before this point.
    mutating func fieldEnd(utf8Excess: Int)

    /// The last field of a row ended. `utf8Excess` is as for `fieldEnd`.
    mutating func rowEnd(utf8Excess: Int)

    /// The row and field the sink is in. The sinks count field and row ends
    /// anyway, or nearly, so the lexer doesn't count them again for the rare
    /// byte it refuses.
    var position: Position { get }

    /// Where the stream keeps the first byte refused (`StreamOperation`). The
    /// lexer and the sink both refuse through it, so it holds the first in
    /// input order.
    var refusal: UnsafeMutablePointer<Invalid> { get }
}

extension CSVSink {
    /// Refuses `b` where the sink is now, unless something was refused before.
    @inline(__always)
    func refuse(_ b: UInt8, inOutput: Bool = false, kind: Refusal = .byte) {
        refusal.refuse(b, at: position, inOutput: inOutput, kind: kind)
    }
}

/// An RFC 4180 lexer that takes CSV in chunks of any size and reports
/// content, field ends and row ends to a sink. With `quoting` off and a tab
/// separator it reads TSV, where a quote is content like any other byte.
///
/// How it reads CSV, where RFC 4180 leaves room:
/// - A quote opens a quoted field only at the start of a field; anywhere else
///   it is content. Text after a closing quote is content too, so `"a"b` is `ab`.
/// - Rows end in LF or CRLF. Outside quotes, and so everywhere in TSV, a CR
///   anywhere but right before LF is refused through the sink's `refusal`, a
///   CR that ends the input included: a CR-only file is refused at its first
///   line end, not read as one row. Inside quotes a CR is content.
/// - A blank line is no row. A line holding only `""` is a row of one empty field.
/// - A quote still open at the end of the input is refused, as an
///   `unclosedQuote` at the row and field where it opened: read as a field, it
///   would take in the rest of the input without a word. No field or row ends
///   inside quotes, so the sink is still where the quote opened.
///
/// It is a plain state machine over the special bytes only: quote, LF, CR, the
/// separator, and `extra`, found 64 at a time with simd128. The bytes between
/// them go to the sink as runs. A CR outside quotes looks at the byte after it;
/// when the CR ends the chunk, the next chunk's first byte decides
/// (`crEndsChunk`).
///
/// At a CR it refuses, the scan stops, so the sink is where the CR is and
/// `refuse` finds its row and field there, after the loop. Refusing inside
/// the loop kept what it needs live through every iteration, and the readers
/// ran 10 to 20% slower for a path that almost never runs.
///
/// The separator and `extra` must be ASCII. Between chunks it keeps only its
/// state. The input must have `scanPadding` readable bytes past `count`.
struct CSVLexer {
    enum State: UInt8 { case fieldStart, unquoted, quoted, quoteInQuoted }

    let separator: UInt8
    /// Whether a quote at the start of a field opens a quoted field.
    let quoting: Bool
    /// One more byte for the sink to see through `byte`, such as a tab when
    /// writing TSV. Defaults to the quote, which is special anyway.
    let extra: UInt8
    private var state = State.fieldStart
    private var rowIsEmpty = true
    /// The last chunk ended in a CR outside quotes, so the next byte must be LF.
    private var crEndsChunk = false
    private var utf8Excess = 0

    init(separator: UInt8, quoting: Bool = true, extra: UInt8 = ASCII.quote) {
        self.separator = separator
        self.quoting = quoting
        self.extra = extra
    }

    mutating func scan<Sink: CSVSink>(
        _ input: UnsafePointer<UInt8>, count: Int, into sink: inout Sink
    ) {
        // `self` and `sink` live in linear memory, where any byte the sink
        // writes might alias them, so working on them directly stores and
        // reloads the state and the write cursor at every special byte. On
        // local copies LLVM keeps both in registers.
        var lexer = self
        var writer = sink
        lexer.scanLocally(input, count: count, into: &writer)
        self = lexer
        sink = writer
    }

    /// Ends a last row that had no trailing newline.
    mutating func finish<Sink: CSVSink>(into sink: inout Sink) {
        if crEndsChunk { refuseCR(into: &sink) }
        if state == .quoted { sink.refuse(ASCII.quote, kind: .unclosedQuote) }
        if !rowIsEmpty || state != .fieldStart { sink.rowEnd(utf8Excess: utf8Excess) }
        state = .fieldStart
        rowIsEmpty = true
        crEndsChunk = false
    }

    @inline(__always)
    private mutating func scanLocally<Sink: CSVSink>(
        _ input: UnsafePointer<UInt8>, count: Int, into sink: inout Sink
    ) {
        if crEndsChunk && count > 0 {
            crEndsChunk = false
            if input[0] != ASCII.lf { return refuseCR(into: &sink) }
        }
        var block = 0
        var runStart = 0
        while block < count {
            let p = input + block
            var specials = special_mask64(p, separator, extra)
            var continuations: UInt64 = 0
            var fourByteLeads: UInt64 = 0
            if Sink.tracksText {
                continuations = continuation_mask64(p)
                fourByteLeads = four_byte_lead_mask64(p)
            }
            let remaining = count &- block
            if remaining < 64 {
                let valid = (UInt64(1) &<< UInt64(remaining)) &- 1
                specials &= valid
                continuations &= valid
                fourByteLeads &= valid
            }
            while specials != 0 {
                let k = specials.trailingZeroBitCount
                specials &= specials &- 1
                let position = block &+ k
                if position > runStart {
                    plain(input + runStart, count: position &- runStart, into: &sink)
                }
                runStart = position &+ 1
                var excess = 0
                if Sink.tracksText {
                    // A continuation byte adds one byte and no code unit; a
                    // four-byte lead's surrogate pair takes one back.
                    let before = (UInt64(1) &<< UInt64(k)) &- 1
                    excess = utf8Excess
                        &+ (continuations & before).nonzeroBitCount
                        &- (fourByteLeads & before).nonzeroBitCount
                }
                if !special(input, at: position, count: count, utf8Excess: excess, into: &sink) {
                    return refuseCR(into: &sink)
                }
            }
            if Sink.tracksText {
                utf8Excess = utf8Excess
                    &+ continuations.nonzeroBitCount &- fourByteLeads.nonzeroBitCount
            }
            block &+= 64
        }
        if count > runStart {
            plain(input + runStart, count: count &- runStart, into: &sink)
        }
    }

    @inline(__always)
    private mutating func plain<Sink: CSVSink>(
        _ bytes: UnsafePointer<UInt8>, count: Int, into sink: inout Sink
    ) {
        sink.content(bytes, count: count)
        if state != .quoted {
            state = .unquoted
            rowIsEmpty = false
        }
    }

    /// One step of the state machine, on `input[i]`. False at a CR to refuse.
    @inline(__always)
    private mutating func special<Sink: CSVSink>(
        _ input: UnsafePointer<UInt8>, at i: Int, count: Int, utf8Excess: Int,
        into sink: inout Sink
    ) -> Bool {
        let b = input[i]
        switch state {
        case .quoted:
            if b == ASCII.quote { state = .quoteInQuoted } else { sink.byte(b) }
            return true
        case .quoteInQuoted:
            if b == ASCII.quote {
                sink.byte(ASCII.quote)
                state = .quoted
                return true
            }
            state = .unquoted
        case .fieldStart, .unquoted:
            break
        }
        if b == separator {
            sink.fieldEnd(utf8Excess: utf8Excess)
            state = .fieldStart
            rowIsEmpty = false
        } else if b == ASCII.lf {
            if !rowIsEmpty || state != .fieldStart { sink.rowEnd(utf8Excess: utf8Excess) }
            state = .fieldStart
            rowIsEmpty = true
        } else if b == ASCII.cr {
            // Nothing but a CRLF's CR, which its LF's row end covers.
            if i &+ 1 == count {
                crEndsChunk = true
            } else if input[i &+ 1] != ASCII.lf {
                return false
            }
        } else if b == ASCII.quote && state == .fieldStart && quoting {
            state = .quoted
            rowIsEmpty = false
        } else {
            sink.byte(b)
            state = .unquoted
            rowIsEmpty = false
        }
        return true
    }
}

/// Refuses a CR where the sink is. Out of line, so that nothing it needs is
/// kept live through the scan loop that calls it on the way out.
@inline(never)
private func refuseCR<Sink: CSVSink>(into sink: inout Sink) {
    sink.refuse(ASCII.cr)
}
