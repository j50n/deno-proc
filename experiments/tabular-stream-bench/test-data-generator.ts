// Simple seedrandom implementation
function seedRandom(seed: number): () => number {
    let state = seed;
    return function() {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

// Generate deterministic test row based on line number
export function generateTestRow(lineNumber: number): string[] {
    const rng = seedRandom(lineNumber);
    
    const columns = [
        lineNumber.toString(), // First column is line number
    ];
    
    // Generate 20 more columns with random content
    for (let col = 1; col <= 20; col++) {
        const length = Math.floor(rng() * 32) + 1; // 1-32 characters
        let content = "";
        
        for (let i = 0; i < length; i++) {
            const charType = Math.floor(rng() * 100);
            
            if (charType < 70) {
                // 70% ASCII letters and digits
                const ascii = Math.floor(rng() * 62);
                if (ascii < 26) {
                    content += String.fromCharCode(65 + ascii); // A-Z
                } else if (ascii < 52) {
                    content += String.fromCharCode(97 + ascii - 26); // a-z
                } else {
                    content += String.fromCharCode(48 + ascii - 52); // 0-9
                }
            } else if (charType < 75) {
                // 5% problematic CSV characters
                const problemChars = [',', '"', '\t'];
                content += problemChars[Math.floor(rng() * problemChars.length)];
            } else if (charType < 85) {
                // 10% basic punctuation and spaces
                content += ' !@#$%^&*()[]{}|\\:;<>?/~`-_=+'[Math.floor(rng() * 32)];
            } else if (charType < 95) {
                // 10% Unicode in Latin Extended range (128-255)
                content += String.fromCharCode(128 + Math.floor(rng() * 128));
            } else if (charType < 98) {
                // 3% Unicode in higher ranges (256-2047)
                content += String.fromCharCode(256 + Math.floor(rng() * 1792));
            } else {
                // 2% Emoji and other high Unicode (multi-character UTF-16)
                const emojiStart = 0x1F600; // Emoticons block
                const emojiCode = emojiStart + Math.floor(rng() * 80);
                content += String.fromCodePoint(emojiCode);
            }
        }
        
        columns.push(content);
    }
    
    return columns;
}

// Convert row to CSV format with proper escaping
export function rowToCsv(row: string[]): string {
    return row.map(field => {
        // Escape fields that contain commas, quotes, newlines, or tabs
        if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\t')) {
            return '"' + field.replace(/"/g, '""') + '"';
        }
        return field;
    }).join(',');
}

// Test the function
if (import.meta.main) {
    console.log("Testing generateTestRow function:");
    
    for (let i = 1; i <= 5; i++) {
        const row = generateTestRow(i);
        const csv = rowToCsv(row);
        console.log(`Line ${i}: ${row.length} columns`);
        console.log(`CSV: ${csv.substring(0, 100)}${csv.length > 100 ? '...' : ''}`);
        console.log(`Lengths: ${row.map(col => col.length).join(', ')}`);
        console.log('---');
    }
    
    // Test determinism
    console.log("Testing determinism:");
    const row1a = generateTestRow(42);
    const row1b = generateTestRow(42);
    console.log("Same seed produces same result:", JSON.stringify(row1a) === JSON.stringify(row1b));
    
    const row2 = generateTestRow(43);
    console.log("Different seed produces different result:", JSON.stringify(row1a) !== JSON.stringify(row2));
}
