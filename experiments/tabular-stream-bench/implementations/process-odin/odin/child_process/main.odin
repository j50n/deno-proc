package child_process

import "core:os"
import "../csv_parser"

main :: proc() {
    success := csv_parser.process_csv_stdin_streaming_with_temp()
    
    if !success {
        os.exit(1)
    }
}
