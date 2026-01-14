# JSON Transforms

Process JSON Lines (JSONL) format with full object structure support and optional schema validation.

> ⚠️ **Experimental (v0.24.0+)**: JSON transforms are under active development. API may change as we improve correctness and streaming performance. Test thoroughly with your data patterns.

## Overview

JSON transforms handle **JSON Lines** format - one complete JSON value per line. Unlike other formats, JSON preserves full object structure including nested objects, arrays, and all JSON data types. This makes it ideal for APIs, configuration data, and complex structured information.

## Performance Characteristics

| Dataset Size | Parsing Speed | Best Use Case |
|--------------|---------------|---------------|
| Small (1K)   | 98.20 MB/s    | **Fastest for small data** |
| Medium (10K) | 80.68 MB/s    | Good for structured data |
| Large (50K)  | 70.31 MB/s    | Performance degrades with size |

> **Performance Note**: JSON is fastest for small datasets but performance decreases with larger files. Use for rich object structures rather than simple tabular data.

## Basic Usage

### Parsing JSON Lines

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromJsonToRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Parse JSONL into objects
const objects = await read("events.jsonl")
  .transform(fromJsonToRows())
  .collect();

// Each object preserves full JSON structure
// objects[0] = { id: "evt_123", type: "click", user: { name: "Alice" } }
// objects[1] = { id: "evt_124", type: "view", metadata: [1, 2, 3] }
```

### Generating JSON Lines

```typescript
import { toJson } from "jsr:@j50n/proc@{{gitv}}/transforms";

// From objects
const events = [
  { id: "evt_123", type: "click", timestamp: "2024-01-15T10:30:00Z" },
  { id: "evt_124", type: "view", user: { id: 456, name: "Bob" } }
];

await enumerate(events)
  .transform(toJson())
  .writeTo("events.jsonl");
```

## Schema Validation

### Using Zod Schemas

```typescript
import { z } from "zod";

// Define schema
const EventSchema = z.object({
  id: z.string(),
  type: z.enum(["click", "view", "purchase"]),
  timestamp: z.string().datetime(),
  user: z.object({
    id: z.number(),
    name: z.string()
  }).optional(),
  metadata: z.record(z.unknown()).optional()
});

type Event = z.infer<typeof EventSchema>;

// Parse with validation
const validEvents = await read("events.jsonl")
  .transform(fromJsonToRows<Event>({ 
    schema: EventSchema 
  }))
  .collect();
```

### Partial Validation for Performance

```typescript
// Validate only first 1000 rows for performance
const events = await read("large-events.jsonl")
  .transform(fromJsonToRows<Event>({ 
    schema: EventSchema,
    sampleSize: 1000  // Only validate first 1000 rows
  }))
  .collect();
```

### Custom Validation

```typescript
// Custom validation logic
const validateEvent = (obj: unknown): obj is Event => {
  return typeof obj === 'object' && 
         obj !== null && 
         'id' in obj && 
         'type' in obj;
};

const events = await read("events.jsonl")
  .transform(fromJsonToRows())
  .filter((obj): obj is Event => {
    if (!validateEvent(obj)) {
      console.warn(`Invalid event: ${JSON.stringify(obj)}`);
      return false;
    }
    return true;
  })
  .collect();
```

## Real-World Examples

### API Event Processing

```typescript
// Process webhook events
interface WebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

await read("webhook-events.jsonl")
  .transform(fromJsonToRows<WebhookEvent>())
  .filter(event => event.type === "user.created")
  .map(event => ({
    userId: event.data.id as string,
    email: event.data.email as string,
    createdAt: new Date(event.timestamp),
    source: "webhook"
  }))
  .transform(toJson())
  .writeTo("new-users.jsonl");
```

### Configuration Processing

```typescript
// Process application configurations
interface AppConfig {
  name: string;
  version: string;
  features: string[];
  database: {
    host: string;
    port: number;
    ssl: boolean;
  };
  cache?: {
    ttl: number;
    maxSize: number;
  };
}

const configs = await read("app-configs.jsonl")
  .transform(fromJsonToRows<AppConfig>())
  .filter(config => config.version.startsWith("2."))  // Version 2.x only
  .map(config => ({
    ...config,
    features: config.features.filter(f => f !== "deprecated-feature"),
    database: {
      ...config.database,
      ssl: true  // Force SSL for all configs
    }
  }))
  .collect();

// Write updated configurations
await enumerate(configs)
  .transform(toJson())
  .writeTo("updated-configs.jsonl");
```

### Log Analysis

```typescript
// Analyze structured application logs
interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  service: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Extract error patterns
const errorPatterns = new Map<string, number>();

await read("app-logs.jsonl")
  .transform(fromJsonToRows<LogEntry>())
  .filter(log => log.level === "error" && log.error)
  .forEach(log => {
    const errorType = log.error!.name;
    errorPatterns.set(errorType, (errorPatterns.get(errorType) || 0) + 1);
  });

// Output error summary
const sortedErrors = Array.from(errorPatterns.entries())
  .sort(([,a], [,b]) => b - a);

console.log("Top error types:");
sortedErrors.slice(0, 10).forEach(([type, count]) => {
  console.log(`  ${type}: ${count} occurrences`);
});
```

### Data Transformation Pipeline

```typescript
// Transform nested data structures
interface RawOrder {
  orderId: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  shipping: {
    address: string;
    method: string;
    cost: number;
  };
}

interface ProcessedOrder {
  id: string;
  customerId: string;
  customerEmail: string;
  totalAmount: number;
  itemCount: number;
  shippingCost: number;
  processedAt: string;
}

await read("raw-orders.jsonl")
  .transform(fromJsonToRows<RawOrder>())
  .map((order): ProcessedOrder => ({
    id: order.orderId,
    customerId: order.customer.id,
    customerEmail: order.customer.email,
    totalAmount: order.items.reduce((sum, item) => 
      sum + (item.quantity * item.price), 0
    ),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    shippingCost: order.shipping.cost,
    processedAt: new Date().toISOString()
  }))
  .filter(order => order.totalAmount > 100)  // High-value orders only
  .transform(toJson())
  .writeTo("processed-orders.jsonl");
```

## Advanced Usage

### Streaming Large JSON Files

```typescript
// Process large JSONL files with memory control
let processedCount = 0;
const batchSize = 1000;
let batch: LogEntry[] = [];

await read("huge-logs.jsonl")
  .transform(fromJsonToRows<LogEntry>())
  .forEach(async (log) => {
    batch.push(log);
    processedCount++;
    
    if (batch.length >= batchSize) {
      await processBatch(batch);
      batch = [];
      
      if (processedCount % 10000 === 0) {
        console.log(`Processed ${processedCount} log entries`);
      }
    }
  });

// Process remaining entries
if (batch.length > 0) {
  await processBatch(batch);
}
```

### Nested Object Manipulation

```typescript
// Deep object transformation
interface NestedData {
  user: {
    profile: {
      personal: {
        name: string;
        age: number;
      };
      preferences: {
        theme: string;
        notifications: boolean;
      };
    };
  };
  metadata: Record<string, unknown>;
}

await read("nested-data.jsonl")
  .transform(fromJsonToRows<NestedData>())
  .map(data => ({
    // Flatten nested structure
    userName: data.user.profile.personal.name,
    userAge: data.user.profile.personal.age,
    theme: data.user.profile.preferences.theme,
    notifications: data.user.profile.preferences.notifications,
    // Preserve metadata as-is
    metadata: data.metadata
  }))
  .transform(toJson())
  .writeTo("flattened-data.jsonl");
```

### Array Processing

```typescript
// Handle arrays within JSON objects
interface EventBatch {
  batchId: string;
  timestamp: string;
  events: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
}

// Flatten event batches into individual events
await read("event-batches.jsonl")
  .transform(fromJsonToRows<EventBatch>())
  .flatMap(batch => 
    batch.events.map(event => ({
      batchId: batch.batchId,
      batchTimestamp: batch.timestamp,
      eventType: event.type,
      eventData: event.data
    }))
  )
  .transform(toJson())
  .writeTo("individual-events.jsonl");
```

## Error Handling

### JSON Parsing Errors

```typescript
try {
  await read("malformed.jsonl")
    .transform(fromJsonToRows())
    .collect();
} catch (error) {
  if (error.message.includes("JSON")) {
    console.error("Invalid JSON format in file");
  } else if (error.message.includes("UTF-8")) {
    console.error("Invalid character encoding");
  }
}
```

### Schema Validation Errors

```typescript
try {
  await read("events.jsonl")
    .transform(fromJsonToRows({ schema: EventSchema }))
    .collect();
} catch (error) {
  if (error.name === "ZodError") {
    console.error("Schema validation failed:");
    error.errors.forEach((err: any) => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
  }
}
```

### Graceful Error Recovery

```typescript
// Continue processing despite individual JSON errors
const errors: Array<{line: number, error: string}> = [];
let successCount = 0;

await read("mixed-quality.jsonl")
  .lines
  .forEach((line, index) => {
    try {
      const obj = JSON.parse(line);
      // Process valid JSON
      successCount++;
    } catch (error) {
      errors.push({
        line: index + 1,
        error: error.message
      });
    }
  });

console.log(`Successfully parsed ${successCount} objects`);
if (errors.length > 0) {
  console.error(`${errors.length} lines had JSON errors`);
}
```

## Performance Optimization

### Selective Processing

```typescript
// Only parse objects that match criteria
await read("events.jsonl")
  .lines
  .filter(line => line.includes('"type":"error"'))  // Quick string check
  .map(line => JSON.parse(line))  // Parse only matching lines
  .transform(toJson())
  .writeTo("error-events.jsonl");
```

### Streaming vs Batch Processing

```typescript
// ✅ Streaming - constant memory usage
await read("large-data.jsonl")
  .transform(fromJsonToRows())
  .filter(obj => obj.status === "active")
  .transform(toJson())
  .writeTo("active-data.jsonl");

// ❌ Batch - loads everything into memory
const allData = await read("large-data.jsonl")
  .transform(fromJsonToRows())
  .collect();  // Memory explosion!
```

## Integration Examples

### JSON to Database

```typescript
// Load JSON data into database
interface User {
  id: string;
  name: string;
  email: string;
  metadata: Record<string, unknown>;
}

await read("users.jsonl")
  .transform(fromJsonToRows<User>())
  .concurrentMap(async (user) => {
    await db.users.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        metadata: JSON.stringify(user.metadata)
      }
    });
  }, { concurrency: 10 })
  .forEach(() => {}); // Consume the stream
```

### JSON to Other Formats

```typescript
// Convert JSON to CSV (flatten objects)
await read("users.jsonl")
  .transform(fromJsonToRows<User>())
  .map(user => [
    user.id,
    user.name,
    user.email,
    JSON.stringify(user.metadata)  // Serialize complex data
  ])
  .transform(toCsv())
  .writeTo("users.csv");
```

## Best Practices

1. **Use for rich object structures** - JSON excels with nested data
2. **Validate with schemas** for production data processing
3. **Sample validation** for large files to balance safety and performance
4. **Handle parsing errors gracefully** - not all lines may be valid JSON
5. **Stream large files** - avoid loading everything into memory
6. **Consider flattening** complex nested structures for simpler processing
7. **Use selective parsing** when you only need specific object types
8. **Preserve object structure** when possible rather than flattening unnecessarily

## Comparison with Other Formats

### JSON vs CSV/TSV
- **Structure**: JSON supports nested objects, CSV/TSV are flat
- **Types**: JSON preserves data types, CSV/TSV are all strings
- **Size**: JSON is larger due to field names and structure
- **Speed**: CSV/TSV are faster for simple tabular data

### JSON vs Record
- **Readability**: JSON is human-readable, Record is binary
- **Flexibility**: JSON supports any structure, Record is tabular
- **Performance**: Record is faster for large datasets
- **Compatibility**: JSON works everywhere, Record is specialized

## Next Steps

- [Record Format](./record.md) - For maximum performance with structured data
- [CSV Transforms](./csv.md) - When you need tabular compatibility
- [LazyRow Guide](./lazyrow.md) - Not applicable to JSON (preserves object structure)
- [Performance Guide](./performance.md) - Optimization strategies for all formats
