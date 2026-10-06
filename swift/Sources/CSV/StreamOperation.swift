/// What every streaming operation behind a handle shares: the first byte of
/// input it refused, which the caller reports once a feed returns -1.
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
}

/// A place in the data, counting from 1. Rows are rows of data: blank lines
/// don't count.
struct Position {
    var row = 1, field = 1
}

/// The first byte refused, and where; row 0 while there is none.
struct Invalid {
    var row = 0, field = 0
    var byte: UInt8 = 0
    /// The output format can't hold the byte, as opposed to the input format
    /// not allowing it where it is.
    var inOutput = false

    init() {}

    init(_ byte: UInt8, at position: Position, inOutput: Bool = false) {
        row = position.row
        field = position.field
        self.byte = byte
        self.inOutput = inOutput
    }
}

extension UnsafeMutablePointer<Invalid> {
    /// Keeps `b` at `position` as the refusal, unless there is one already.
    @inline(__always)
    func refuse(_ b: UInt8, at position: Position, inOutput: Bool = false) {
        if pointee.row == 0 { pointee = Invalid(b, at: position, inOutput: inOutput) }
    }
}
