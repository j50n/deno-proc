#!/usr/bin/bash 
":"; //#; exec deno run "$0" "$@"

/**
 * Basic shebang hack to run on Ubuntu 18.04 and prior.
 *
 * `deno fmt` fights with this hack, so here is a simple `sed` script
 * to remove the semicolon it insists on adding.
 *
 * Because this one time, I am right and it is wrong.
 *
 * ```sh
 * HERE="$(realpath "$(dirname $0)")"
 * deno fmt "$HERE"
 *
 * # This detects the hack pattern, only on the second line of the file
 * # and removes the added semicolon if present.
 * sed -i -r '2s|^":";\s[/][/]#;|":" //#;|' `find "$HERE" -name '*.ts'`
 * ```
 */

console.log("Hello, Bionic Beaver.");
