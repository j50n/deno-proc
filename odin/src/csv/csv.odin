package csv

// RFC 4180 compliant CSV push parser
// Two implementations: DelimitedParser (copies output) and SpanParser (zero-copy offsets)

FIELD_SEP :: 0x1F  // Unit Separator
RECORD_SEP :: 0x1E // Record Separator

CsvState :: enum u8 {
    FieldStart,
    Unquoted,
    Quoted,
    QuoteInQuoted,
    RecordEnd,
}

CsvErrorKind :: enum u8 {
    None = 0,
    BareQuote,
    UnclosedQuote,
    InvalidCharAfterQuote,
    BareCR,
    FieldCountMismatch,
}

CsvError :: struct {
    kind: CsvErrorKind,
    row: u32,
    col: u32,
}

CsvOptions :: struct {
    separator: u8,
    strict: bool,
    expected_fields: u32,
}

default_csv_options :: proc() -> CsvOptions {
    return CsvOptions{separator = ',', strict = false, expected_fields = 0}
}

// =============================================================================
// Delimited Output Parser
// =============================================================================

DelimitedParser :: struct {
    state: CsvState,
    row: u32,
    col: u32,
    fields_in_row: u32,
    opts: CsvOptions,
    error: CsvError,
    output: [dynamic]u8,
    carry: [dynamic]u8,
    row_started: bool,
    complete_output_len: int,  // length of output containing only complete records
}

delimited_init :: proc(opts := CsvOptions{}) -> DelimitedParser {
    o := opts
    if o.separator == 0 do o.separator = ','
    return DelimitedParser{
        state = .FieldStart,
        opts = o,
        output = make([dynamic]u8),
        carry = make([dynamic]u8),
    }
}

delimited_destroy :: proc(p: ^DelimitedParser) {
    delete(p.output)
    delete(p.carry)
}

delimited_reset_output :: proc(p: ^DelimitedParser) {
    // Keep incomplete record data, remove only complete records
    if p.complete_output_len > 0 && p.complete_output_len < len(p.output) {
        // Move incomplete data to start
        incomplete := p.output[p.complete_output_len:]
        copy(p.output[:len(incomplete)], incomplete)
        resize(&p.output, len(incomplete))
    } else {
        clear(&p.output)
    }
    p.complete_output_len = 0
}

// Get only complete records from output
delimited_get_complete_output :: proc(p: ^DelimitedParser) -> []u8 {
    return p.output[:p.complete_output_len]
}

delimited_parse :: proc(p: ^DelimitedParser, input: []u8) -> (rows: u32, ok: bool) {
    if p.error.kind != .None do return 0, false
    
    sep := p.opts.separator
    rows = 0
    i := 0
    n := len(input)
    
    for i < n {
        c := input[i]
        
        switch p.state {
        case .FieldStart:
            if c == '"' {
                p.state = .Quoted
                p.col += 1
            } else if c == sep {
                // Empty field
                if p.row_started do append(&p.output, FIELD_SEP)
                p.row_started = true
                p.fields_in_row += 1
                p.col += 1
            } else if c == '\r' {
                // Empty field before CR
                if p.row_started {
                    append(&p.output, FIELD_SEP)
                    p.fields_in_row += 1
                }
                p.state = .RecordEnd
            } else if c == '\n' {
                // Empty field before LF
                if p.row_started {
                    append(&p.output, FIELD_SEP)
                    p.fields_in_row += 1
                }
                rows += delimited_emit_record(p)
                if p.error.kind != .None do return rows, false
            } else {
                // Start unquoted field
                append(&p.carry, c)
                p.state = .Unquoted
                p.col += 1
            }
            
        case .Unquoted:
            if c == sep {
                delimited_emit_field(p)
                p.state = .FieldStart
                p.col += 1
            } else if c == '\r' {
                delimited_emit_field(p)
                p.state = .RecordEnd
            } else if c == '\n' {
                delimited_emit_field(p)
                rows += delimited_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else if c == '"' && p.opts.strict {
                p.error = CsvError{.BareQuote, p.row, p.col}
                return rows, false
            } else {
                append(&p.carry, c)
                p.col += 1
            }
            
        case .Quoted:
            if c == '"' {
                p.state = .QuoteInQuoted
            } else {
                append(&p.carry, c)
                if c == '\n' {
                    p.col = 0
                } else {
                    p.col += 1
                }
            }
            
        case .QuoteInQuoted:
            if c == '"' {
                // Escaped quote
                append(&p.carry, '"')
                p.state = .Quoted
                p.col += 1
            } else if c == sep {
                delimited_emit_field(p)
                p.state = .FieldStart
                p.col += 1
            } else if c == '\r' {
                delimited_emit_field(p)
                p.state = .RecordEnd
            } else if c == '\n' {
                delimited_emit_field(p)
                rows += delimited_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else {
                p.error = CsvError{.InvalidCharAfterQuote, p.row, p.col}
                return rows, false
            }
            
        case .RecordEnd:
            if c == '\n' {
                rows += delimited_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else if p.opts.strict {
                p.error = CsvError{.BareCR, p.row, p.col}
                return rows, false
            } else {
                // Lenient: treat bare CR as line ending
                rows += delimited_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
                // Re-process this character
                continue
            }
        }
        i += 1
    }
    
    return rows, true
}

delimited_finish :: proc(p: ^DelimitedParser) -> (rows: u32, ok: bool) {
    if p.error.kind != .None do return 0, false
    
    // Handle unterminated states
    switch p.state {
    case .Quoted:
        if p.opts.strict {
            p.error = CsvError{.UnclosedQuote, p.row, p.col}
            return 0, false
        }
        // Lenient: close the quote
        delimited_emit_field(p)
        return delimited_emit_record(p), true
        
    case .QuoteInQuoted:
        delimited_emit_field(p)
        return delimited_emit_record(p), true
        
    case .Unquoted:
        delimited_emit_field(p)
        return delimited_emit_record(p), true
        
    case .RecordEnd:
        return delimited_emit_record(p), true
        
    case .FieldStart:
        // Only emit if we have pending content
        if p.row_started || len(p.carry) > 0 {
            return delimited_emit_record(p), true
        }
    }
    
    return 0, true
}

@(private)
delimited_emit_field :: proc(p: ^DelimitedParser) {
    if p.row_started {
        append(&p.output, FIELD_SEP)
    }
    p.row_started = true
    append(&p.output, ..p.carry[:])
    clear(&p.carry)
    p.fields_in_row += 1
}

@(private)
delimited_emit_record :: proc(p: ^DelimitedParser) -> u32 {
    // Check field count if strict
    if p.opts.expected_fields > 0 && p.fields_in_row != p.opts.expected_fields {
        if p.opts.strict {
            p.error = CsvError{.FieldCountMismatch, p.row, 0}
            return 0
        }
    }
    
    // Don't emit empty rows
    if !p.row_started && p.fields_in_row == 0 {
        return 0
    }
    
    append(&p.output, RECORD_SEP)
    p.complete_output_len = len(p.output)  // mark complete record boundary
    p.row += 1
    p.col = 0
    p.fields_in_row = 0
    p.row_started = false
    return 1
}

// =============================================================================
// Span Output Parser (zero-copy)
// =============================================================================

FieldSpan :: struct {
    start: u32,
    end: u32,
    flags: u8,  // bit 0: quoted (needs unescape)
}

SPAN_FLAG_QUOTED :: u8(1)

SpanParser :: struct {
    state: CsvState,
    row: u32,
    col: u32,
    field_start: u32,
    fields_in_row: u32,
    opts: CsvOptions,
    error: CsvError,
    spans: [dynamic]FieldSpan,
    row_ends: [dynamic]u32,
    is_quoted: bool,
    base_offset: u32,  // offset added to all spans (for streaming)
}

span_init :: proc(opts := CsvOptions{}) -> SpanParser {
    o := opts
    if o.separator == 0 do o.separator = ','
    return SpanParser{
        state = .FieldStart,
        opts = o,
        spans = make([dynamic]FieldSpan),
        row_ends = make([dynamic]u32),
    }
}

span_destroy :: proc(p: ^SpanParser) {
    delete(p.spans)
    delete(p.row_ends)
}

span_reset_output :: proc(p: ^SpanParser) {
    clear(&p.spans)
    clear(&p.row_ends)
}

span_parse :: proc(p: ^SpanParser, input: []u8, base_offset: u32 = 0) -> (rows: u32, ok: bool) {
    if p.error.kind != .None do return 0, false
    
    sep := p.opts.separator
    p.base_offset = base_offset
    rows = 0
    i := u32(0)
    n := u32(len(input))
    
    for i < n {
        c := input[i]
        
        switch p.state {
        case .FieldStart:
            p.field_start = i
            p.is_quoted = false
            
            if c == '"' {
                p.is_quoted = true
                p.field_start = i + 1  // skip opening quote
                p.state = .Quoted
                p.col += 1
            } else if c == sep {
                // Empty field
                span_emit_field(p, i, i)
                p.col += 1
            } else if c == '\r' {
                span_emit_field(p, i, i)  // empty field
                p.state = .RecordEnd
            } else if c == '\n' {
                span_emit_field(p, i, i)  // empty field
                rows += span_emit_record(p)
                if p.error.kind != .None do return rows, false
            } else {
                p.state = .Unquoted
                p.col += 1
            }
            
        case .Unquoted:
            if c == sep {
                span_emit_field(p, p.field_start, i)
                p.state = .FieldStart
                p.col += 1
            } else if c == '\r' {
                span_emit_field(p, p.field_start, i)
                p.state = .RecordEnd
            } else if c == '\n' {
                span_emit_field(p, p.field_start, i)
                rows += span_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else if c == '"' && p.opts.strict {
                p.error = CsvError{.BareQuote, p.row, p.col}
                return rows, false
            } else {
                p.col += 1
            }
            
        case .Quoted:
            if c == '"' {
                p.state = .QuoteInQuoted
            } else if c == '\n' {
                p.col = 0
            } else {
                p.col += 1
            }
            
        case .QuoteInQuoted:
            if c == '"' {
                // Escaped quote - stay in quoted, field contains ""
                p.state = .Quoted
                p.col += 1
            } else if c == sep {
                span_emit_field(p, p.field_start, i - 1)  // exclude closing quote
                p.state = .FieldStart
                p.col += 1
            } else if c == '\r' {
                span_emit_field(p, p.field_start, i - 1)
                p.state = .RecordEnd
            } else if c == '\n' {
                span_emit_field(p, p.field_start, i - 1)
                rows += span_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else {
                p.error = CsvError{.InvalidCharAfterQuote, p.row, p.col}
                return rows, false
            }
            
        case .RecordEnd:
            if c == '\n' {
                rows += span_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
            } else if p.opts.strict {
                p.error = CsvError{.BareCR, p.row, p.col}
                return rows, false
            } else {
                rows += span_emit_record(p)
                if p.error.kind != .None do return rows, false
                p.state = .FieldStart
                continue
            }
        }
        i += 1
    }
    
    return rows, true
}

span_finish :: proc(p: ^SpanParser, input_len: u32) -> (rows: u32, ok: bool) {
    if p.error.kind != .None do return 0, false
    
    switch p.state {
    case .Quoted:
        if p.opts.strict {
            p.error = CsvError{.UnclosedQuote, p.row, p.col}
            return 0, false
        }
        span_emit_field(p, p.field_start, input_len)
        return span_emit_record(p), true
        
    case .QuoteInQuoted:
        span_emit_field(p, p.field_start, input_len - 1)
        return span_emit_record(p), true
        
    case .Unquoted:
        span_emit_field(p, p.field_start, input_len)
        return span_emit_record(p), true
        
    case .RecordEnd:
        return span_emit_record(p), true
        
    case .FieldStart:
        if p.fields_in_row > 0 {
            return span_emit_record(p), true
        }
    }
    
    return 0, true
}

@(private)
span_emit_field :: proc(p: ^SpanParser, start, end: u32) {
    flags: u8 = SPAN_FLAG_QUOTED if p.is_quoted else 0
    append(&p.spans, FieldSpan{
        start = start + p.base_offset,
        end = end + p.base_offset,
        flags = flags,
    })
    p.fields_in_row += 1
}

@(private)
span_emit_record :: proc(p: ^SpanParser) -> u32 {
    if p.opts.expected_fields > 0 && p.fields_in_row != p.opts.expected_fields {
        if p.opts.strict {
            p.error = CsvError{.FieldCountMismatch, p.row, 0}
            return 0
        }
    }
    
    if p.fields_in_row == 0 {
        return 0
    }
    
    append(&p.row_ends, u32(len(p.spans)))
    p.row += 1
    p.col = 0
    p.fields_in_row = 0
    return 1
}


// =============================================================================
// Stringifier Types
// =============================================================================

LineEnding :: enum u8 {
    LF,
    CRLF,
}

StringifyOptions :: struct {
    separator:       u8,
    line_ending:     LineEnding,
    always_quote:    bool,
    expected_fields: u32,
}

StringifyErrorKind :: enum u8 {
    None = 0,
    FieldCountMismatch,
    InvalidInput,
}

StringifyError :: struct {
    kind: StringifyErrorKind,
    row:  u32,
}

// =============================================================================
// Delimited Stringifier
// =============================================================================

DelimitedStringifier :: struct {
    opts:   StringifyOptions,
    output: [dynamic]u8,
    error:  StringifyError,
    row:    u32,
}

delimited_stringify_init :: proc(opts := StringifyOptions{}) -> DelimitedStringifier {
    o := opts
    if o.separator == 0 do o.separator = ','
    return DelimitedStringifier{
        opts = o,
        output = make([dynamic]u8),
    }
}

delimited_stringify_destroy :: proc(s: ^DelimitedStringifier) {
    delete(s.output)
}

delimited_stringify_reset :: proc(s: ^DelimitedStringifier) {
    clear(&s.output)
    s.error = {}
    s.row = 0
}

// Stringify delimited input (fields separated by \x1F, records by \x1E)
delimited_stringify :: proc(s: ^DelimitedStringifier, input: []u8) -> bool {
    if s.error.kind != .None do return false
    if len(input) == 0 do return true
    
    sep := s.opts.separator
    i := 0
    n := len(input)
    field_start := 0
    fields_in_row: u32 = 0
    first_field := true
    
    for i < n {
        c := input[i]
        
        if c == FIELD_SEP || c == RECORD_SEP {
            field := input[field_start:i]
            
            if !first_field {
                append(&s.output, sep)
            }
            first_field = false
            
            write_field(s, field)
            fields_in_row += 1
            
            if c == RECORD_SEP {
                // Check field count
                if s.opts.expected_fields > 0 && fields_in_row != s.opts.expected_fields {
                    s.error = StringifyError{.FieldCountMismatch, s.row}
                    return false
                }
                
                // Write line ending
                if s.opts.line_ending == .CRLF {
                    append(&s.output, '\r')
                }
                append(&s.output, '\n')
                
                s.row += 1
                fields_in_row = 0
                first_field = true
            }
            
            field_start = i + 1
        }
        
        i += 1
    }
    
    return true
}

@(private)
write_field :: proc(s: ^DelimitedStringifier, field: []u8) {
    needs_quote := s.opts.always_quote
    sep := s.opts.separator
    
    // Check if quoting needed
    if !needs_quote {
        for c in field {
            if c == sep || c == '"' || c == '\n' || c == '\r' {
                needs_quote = true
                break
            }
        }
    }
    
    if needs_quote {
        append(&s.output, '"')
        for c in field {
            if c == '"' {
                append(&s.output, '"', '"')
            } else {
                append(&s.output, c)
            }
        }
        append(&s.output, '"')
    } else {
        append(&s.output, ..field)
    }
}

// =============================================================================
// Span Stringifier
// =============================================================================

SpanStringifier :: struct {
    opts:   StringifyOptions,
    output: [dynamic]u8,
    error:  StringifyError,
    row:    u32,
}

span_stringify_init :: proc(opts := StringifyOptions{}) -> SpanStringifier {
    o := opts
    if o.separator == 0 do o.separator = ','
    return SpanStringifier{
        opts = o,
        output = make([dynamic]u8),
    }
}

span_stringify_destroy :: proc(s: ^SpanStringifier) {
    delete(s.output)
}

span_stringify_reset :: proc(s: ^SpanStringifier) {
    clear(&s.output)
    s.error = {}
    s.row = 0
}

// Stringify from spans and source buffer
span_stringify :: proc(s: ^SpanStringifier, source: []u8, spans: []FieldSpan, row_ends: []u32) -> bool {
    if s.error.kind != .None do return false
    
    sep := s.opts.separator
    span_idx: u32 = 0
    prev_row_end: u32 = 0
    
    for row_idx := 0; row_idx < len(row_ends); row_idx += 1 {
        row_end := row_ends[row_idx]
        fields_in_row := row_end - prev_row_end
        
        // Check field count
        if s.opts.expected_fields > 0 && fields_in_row != s.opts.expected_fields {
            s.error = StringifyError{.FieldCountMismatch, s.row}
            return false
        }
        
        first := true
        for span_idx < row_end {
            if !first {
                append(&s.output, sep)
            }
            first = false
            
            span := spans[span_idx]
            field := source[span.start:span.end]
            is_quoted := (span.flags & SPAN_FLAG_QUOTED) != 0
            
            write_span_field(s, field, is_quoted)
            span_idx += 1
        }
        
        // Write line ending
        if s.opts.line_ending == .CRLF {
            append(&s.output, '\r')
        }
        append(&s.output, '\n')
        
        s.row += 1
        prev_row_end = row_end
    }
    
    return true
}

@(private)
write_span_field :: proc(s: ^SpanStringifier, field: []u8, was_quoted: bool) {
    needs_quote := s.opts.always_quote
    sep := s.opts.separator
    has_escaped_quotes := false
    
    // Check if quoting needed
    if !needs_quote {
        for i := 0; i < len(field); i += 1 {
            c := field[i]
            if c == sep || c == '\n' || c == '\r' {
                needs_quote = true
            }
            if c == '"' {
                needs_quote = true
                // Check for escaped quote
                if was_quoted && i + 1 < len(field) && field[i + 1] == '"' {
                    has_escaped_quotes = true
                }
            }
        }
    }
    
    if needs_quote {
        append(&s.output, '"')
        if was_quoted && has_escaped_quotes {
            // Field contains "" sequences, copy as-is (already escaped)
            append(&s.output, ..field)
        } else if was_quoted {
            // Was quoted but no escapes, just copy
            append(&s.output, ..field)
        } else {
            // Need to escape any quotes
            for c in field {
                if c == '"' {
                    append(&s.output, '"', '"')
                } else {
                    append(&s.output, c)
                }
            }
        }
        append(&s.output, '"')
    } else {
        append(&s.output, ..field)
    }
}
