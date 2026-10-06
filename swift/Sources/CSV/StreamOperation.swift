/// What every streaming operation behind a handle shares: the first thing in
/// its input it refused, which the caller reports once a feed returns -1, and
/// the row it is working on, which the caller reports if a feed traps.
///
/// Refusing is final. The operation keeps reading what it's fed, but its
/// output from the refusing feed on means nothing, and the caller stops there.
/// Output from earlier feeds has already gone out: streaming can't take it back.
class StreamOperation {
    /// Where the refusal is kept, written through the pointer by the scanning
    /// loops. Kept in a sink's own fields instead, it became state the loop
    /// carried for a path that almost never runs, and `csvToTsv`, which
    /// refuses inside its loop, ran about 20% slower.
    let refusal: UnsafeMutablePointer<Invalid>

    init() {
        refusal = .allocate(capacity: 1)
        refusal.initialize(to: Invalid())
    }

    var invalid: Invalid { refusal.pointee }

    var refused: Bool { refusal.pointee.row != 0 }

    /// The row, counted from 1, that a feed's allocations are for. Each
    /// operation sets it before it grows a buffer, so that when an allocation
    /// fails and the module traps, the caller can still read it and say which
    /// row was too large.
    var currentRow = 1
}

/// A place in the data, counting from 1. Rows are rows of data: blank lines
/// don't count.
struct Position {
    var row = 1, field = 1
}

/// What was refused.
enum Refusal: UInt8 {
    /// A byte the input doesn't allow where it is, or the output can't hold.
    case byte
    /// A quoted field still open at the end of the input; `byte` is the quote.
    case unclosedQuote
    /// A row of one empty field, which the output would write as a blank
    /// line, and blank lines are no row.
    case emptyRow
}

/// The first thing refused, and where; row 0 while there is none.
struct Invalid {
    var row = 0, field = 0
    var kind = Refusal.byte
    var byte: UInt8 = 0
    /// The output format can't hold the byte, as opposed to the input format
    /// not allowing it where it is.
    var inOutput = false

    init() {}

    init(_ kind: Refusal, _ byte: UInt8, at position: Position, inOutput: Bool) {
        row = position.row
        field = position.field
        self.kind = kind
        self.byte = byte
        self.inOutput = inOutput
    }
}

extension UnsafeMutablePointer<Invalid> {
    /// Keeps `b` at `position` as the refusal, unless there is one already.
    @inline(__always)
    func refuse(
        _ b: UInt8, at position: Position, inOutput: Bool = false, kind: Refusal = .byte
    ) {
        if pointee.row == 0 { pointee = Invalid(kind, b, at: position, inOutput: inOutput) }
    }
}
