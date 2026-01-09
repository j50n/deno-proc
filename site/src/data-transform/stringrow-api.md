# StringRow API Reference

Complete API documentation for the StringRow class.

## Class: StringRow

A high-performance row-based data structure for tabular data with efficient serialization and sparse change tracking.

### Static Methods

#### `StringRow.fromArray(columns: string[]): StringRow`

Creates a StringRow from an array of column values.

```typescript
const row = StringRow.fromArray(["col1", "col2", "col3"]);
```

**Parameters:**
- `columns` - Array of string column values

**Returns:** New StringRow instance

---

#### `StringRow.fromBytes(buffer: Uint8Array): StringRow`

Creates a StringRow from serialized bytes (e.g., from WASM).

```typescript
const bytes = new Uint8Array([/* serialized data */]);
const row = StringRow.fromBytes(bytes);
```

**Parameters:**
- `buffer` - Serialized row data bytes

**Returns:** New StringRow instance

### Properties

#### `columnCount: number` (readonly)

Number of columns in the row.

```typescript
console.log(row.columnCount); // 3
```

#### `isDirty: boolean` (readonly)

Whether the row has been modified since creation.

```typescript
row.set(0, "modified");
console.log(row.isDirty); // true
```

#### `changeCount: number` (readonly)

Number of columns that have been modified.

```typescript
row.set(0, "new1");
row.set(2, "new3");
console.log(row.changeCount); // 2
```

### Instance Methods

#### `get(columnIndex: number): string`

Get column value with bounds checking.

```typescript
const value = row.get(0); // Safe access
```

**Parameters:**
- `columnIndex` - Zero-based column index

**Returns:** String value at the given column

**Throws:** Error if columnIndex is out of bounds

---

#### `getUnsafe(columnIndex: number): string`

Get column value without bounds checking for maximum performance.

```typescript
const value = row.getUnsafe(0); // Fast access
```

**Parameters:**
- `columnIndex` - Zero-based column index

**Returns:** String value at the given column

**⚠️ Warning:** No bounds checking - will crash or return invalid data if index is out of bounds. Use only when you are certain the columnIndex is valid.

---

#### `set(columnIndex: number, value: string): void`

Set column value at the specified index.

```typescript
row.set(1, "new value");
```

**Parameters:**
- `columnIndex` - Zero-based column index
- `value` - New string value

**Throws:** Error if columnIndex is out of bounds

---

#### `toArray(): string[]`

Convert to regular JavaScript array including all changes.

```typescript
const array = row.toArray();
```

**Returns:** Array containing all column values with modifications applied

---

#### `toBytes(): Uint8Array`

Serialize to bytes. Returns original buffer if unchanged, recreates if modified.

```typescript
const bytes = row.toBytes();
```

**Returns:** Serialized bytes in StringRow format

---

#### `slice(start?: number, end?: number): string[]`

Get a slice of the row columns.

```typescript
const firstThree = row.slice(0, 3);
const lastTwo = row.slice(-2);
```

**Parameters:**
- `start` - Start column index (inclusive)
- `end` - End column index (exclusive)

**Returns:** Array slice of column values

---

#### `first(n: number = 1): string[]`

Get first n column values.

```typescript
const firstColumn = row.first();     // ["col1"]
const firstThree = row.first(3);     // ["col1", "col2", "col3"]
```

**Parameters:**
- `n` - Number of columns to return (default: 1)

**Returns:** Array of first n column values

### Change Tracking Methods

#### `getChangedColumns(): number[]`

Get list of changed column indices in sorted order.

```typescript
row.set(0, "new1");
row.set(2, "new3");
console.log(row.getChangedColumns()); // [0, 2]
```

**Returns:** Array of column indices that have been modified

---

#### `getChanges(): Array<{columnIndex: number, oldValue: string, newValue: string}>`

Get all changes with old and new values.

```typescript
const changes = row.getChanges();
// [
//   { columnIndex: 0, oldValue: "col1", newValue: "new1" },
//   { columnIndex: 2, oldValue: "col3", newValue: "new3" }
// ]
```

**Returns:** Array of change objects with columnIndex, oldValue, and newValue

---

#### `resetChanges(): void`

Reset all changes and mark row as clean.

```typescript
row.resetChanges();
console.log(row.isDirty); // false
```

### Iterator Support

StringRow implements the iterable protocol:

```typescript
// Iterate over all columns (includes changes)
for (const value of row) {
  console.log(value);
}

// Use with spread operator
const array = [...row];

// Use with Array.from
const array2 = Array.from(row);
```

## Binary Format

StringRow uses an efficient binary format:

```
[columnCount:int32][positions:int32...][text_data]
```

- **Header**: 4 bytes (int32) - number of columns
- **Positions**: (columnCount + 1) × 4 bytes (int32) - character positions
- **Text Data**: UTF-8 encoded concatenated column text

This format allows:
- Direct column access without full parsing
- Efficient serialization/deserialization
- Minimal memory overhead
- V8 SMI optimization for position arrays

## Performance Tips

1. **Use `getUnsafe()`** for maximum performance when indices are known to be valid
2. **Access columns selectively** - don't call `toArray()` unless you need all columns
3. **Reuse StringRow instances** when possible to amortize construction costs
4. **Batch modifications** before calling `toBytes()` to minimize serialization overhead
5. **Use `isDirty` checks** before serialization to avoid unnecessary work
