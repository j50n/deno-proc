# FlatText API Test Suite

This directory contains comprehensive tests for the FlatText CSV/TSV converter API.

## Test Coverage

### Basic Functionality (`basic.test.ts`)
- ✅ Basic CSV to TSV conversion
- ✅ Empty input handling
- ✅ Single field processing
- ✅ Quoted fields with embedded commas
- ✅ Escaped quotes in fields

### Configuration Options (`config.test.ts`)
- ✅ Custom delimiters (semicolon, pipe)
- ✅ Comment line filtering (hash, slash)
- ✅ Leading space trimming
- ✅ Default behavior validation

### Character Replacements (`replacements.test.ts`)
- ✅ Tab replacement with spaces/pipes
- ✅ Newline replacement with spaces/semicolons
- ✅ Combined tab and newline replacements
- ✅ Embedded character handling

### Field Validation (`validation.test.ts`)
- ✅ Correct field count validation
- ✅ Too few/many fields error handling
- ✅ Empty row handling
- ✅ Single field validation
- ✅ Variable field count support

### Combined Configurations (`combined.test.ts`)
- ✅ Multiple config options together
- ✅ Custom delimiter + comments + trimming
- ✅ All replacement options + validation
- ✅ Maximum configuration complexity

### Edge Cases (`edge-cases.test.ts`)
- ✅ Empty CSV handling
- ✅ Whitespace-only input
- ✅ Empty fields and quotes
- ✅ Unicode character support
- ✅ Emoji handling
- ✅ Line ending variations (CRLF, mixed)
- ✅ Very long fields
- ✅ Malformed CSV graceful handling

## Running Tests

```bash
# Run all FlatText tests
deno test tests/flattext/ --allow-read

# Run specific test file
deno test tests/flattext/basic.test.ts --allow-read
```

## Test Statistics

- **Total Tests**: 50
- **Test Files**: 6
- **Coverage Areas**: 6 major functionality areas
- **All Tests Passing**: ✅

## ParserConfig Options Tested

All ParserConfig interface options are thoroughly tested:

- `delimiter` - Custom field separators
- `comment` - Comment line filtering  
- `trimLeadingSpace` - Whitespace handling
- `replaceTabs` - Tab character replacement
- `replaceNewlines` - Newline character replacement
- `fieldsPerRecord` - Field count validation
