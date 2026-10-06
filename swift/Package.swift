// swift-tools-version: 6.2
import PackageDescription

// The CSV and TSV kernels behind @j50n/proc/transforms, built as one
// WebAssembly module with Embedded Swift. `build.sh` builds it and copies it
// to wasm/flatdata.wasm.
//
// -Xcc -msimd128 is what turns on simd128 for the Swift code too: Swift's
// IRGen takes its LLVM target features from the Clang importer, so every
// Swift function gets "+simd128", SIMD16 loads and stores become v128 ops,
// and the static inline C classifiers inline into Swift. Every runtime Deno
// ships on has wasm SIMD, so there is no scalar build.
//
// -enforce-exclusivity=unchecked drops the calls to swift_beginAccess that
// guard each access to a class's stored var. The Embedded runtime's
// swift_beginAccess does nothing, but the calls stayed in hot paths.
//
// -disable-stack-protector: the stack guard's only source of randomness in
// wasi-libc is the WASI random_get import, and with it gone the module has no
// imports at all. No function here keeps an array on the stack.
let package = Package(
    name: "CSV",
    targets: [
        .executableTarget(
            name: "CSV",
            dependencies: ["SIMDKernels", "Arena"],
            swiftSettings: [.unsafeFlags([
                "-enforce-exclusivity=unchecked", "-Xcc", "-msimd128",
                "-Xfrontend", "-disable-stack-protector",
            ])],
            linkerSettings: [.unsafeFlags([
                "-Xclang-linker", "-mexec-model=reactor",
                "-Xlinker", "--strip-all",
            ])]
        ),
        .target(name: "SIMDKernels", cSettings: [.unsafeFlags(["-msimd128"])]),
        .target(name: "Arena", publicHeadersPath: "."),
    ]
)
