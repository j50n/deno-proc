#!/bin/bash

set -e
set -x

# Update Rust and Cargo
rustup update 
cargo install mdbook mdbook-graphviz

HERE="$(realpath "$(dirname "$0")")"

cd "$HERE" && (
    # Generate API documentation from Deno
    echo "Generating API documentation..."
    deno doc --html --name="proc" --output=./site/src/api-docs ./mod.ts
)

cd "$HERE/site/" && (
    deno fmt **/*.md
    deno fmt **/*.ts

    mdbook build
    
    rm -rf ../docs/
    mkdir ../docs/
    rsync -av ./book/ ../docs/
)

cd "$HERE/wasm/docs/" && (
    # Generate cover image from SVG
    convert -density 150 src/cover.svg src/cover.png
    
    # Concatenate markdown for pandoc
    cat src/introduction.md \
        src/part1/ch01-getting-started.md \
        src/part1/ch02-runtime-bridge.md \
        src/part1/ch03-testing.md \
        src/part2/ch04-numbers.md \
        src/part2/ch05-memory.md \
        src/part2/ch06-strings.md \
        src/part2/ch06b-returning-data.md \
        src/part2/ch07-errors.md \
        src/part3/ch08-advanced-memory.md \
        src/part3/ch09-multiple-instances.md \
        src/part3/ch10-applications.md \
        src/part4/ch10-build-automation.md \
        src/part4/ch11-performance.md \
        src/part4/ch12-production.md \
        src/appendices/odin-reference.md \
        src/appendices/odin-wasm-env.md \
        src/appendices/deno-reference.md \
        src/appendices/troubleshooting.md \
        src/appendices/resources.md \
        > book.md
    
    # Generate EPUB with pandoc
    pandoc book.md \
        -o book.epub \
        --toc --toc-depth=2 \
        --epub-cover-image=src/cover.png \
        --metadata title="WebAssembly with Deno and Odin" \
        --metadata author="Jason Smith"
    
    # Generate PDF with pandoc (cover + content)
    echo '<html><body style="margin:0;padding:0;"><img src="src/cover.png" style="width:100%;height:100%;"></body></html>' | \
        weasyprint - cover-page.pdf
    pandoc book.md \
        -o content.pdf \
        --toc --toc-depth=2 \
        --pdf-engine=weasyprint \
        --metadata title="WebAssembly with Deno and Odin" \
        --metadata author="Jason Smith"
    gs -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -sOutputFile=book.pdf cover-page.pdf content.pdf
    
    # Cleanup temp files
    rm -f book.md cover-page.pdf content.pdf
    
    # Build HTML with mdbook (do this last as it clears book/)
    mdbook build
    
    # Move epub and pdf into book output
    mv book.epub book/
    mv book.pdf book/
)
