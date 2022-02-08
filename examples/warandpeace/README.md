# Count Unique Words in _War and Peace_

Tolstoy's _War and Peace_ is sprawling and immense, and it uses a lot of words.
But how many _unique_ words does it contain?

## Counting in Bash

[countwords.sh](./countwords.sh)

**Example**

```sh
./countwords.sh < ./warandpeace.txt.gz
```

The first version of this program is a shell script.

```sh
cat - | gunzip | grep -o -E "(\\w|')+" | grep -v -P '^\d' | tr '[:upper:]' '[:lower:]' | sort | uniq  | wc -l
```

Read from left to right:

1. read stdin
1. uncompress it, because it is compressed with `gzip`
1. `grep` out the words (skip the numbers)
1. make everything lower case
1. find the unique words
1. count them

This is what we are going to do in Deno.

## Version #1: Streaming with No Shortcuts

[countwords.ts](./countwords.ts)

**Example**

```sh
./countwords.ts < ./warandpeace.txt.gz
```

This version makes a great example because it does a little bit of everything,
but it is starting to get cluttered and is a little hard to read. It
demonstrates that you can _simultaneously_ stream a large amount of data between
a large number of different processing steps, one of them being in your Deno
process.

## Version #2: Streaming with a Little Help from Bash

[countwords2.ts](./countwords2.ts)

**Example**

```sh
./countwords2.ts < ./warandpeace.txt.gz
```

This version is more practical, easier to read, and quite a bit faster than the
first (see code comments). Rather than shelling out individual commands, it
shells out `bash` scripts that run several processes together.

## Version #3: Non-Streaming

[countwords3.ts](./countwords3.ts)

**Example**

```sh
./countwords3.ts < ./warandpeace.txt.gz
```

This version is written without streaming. This is more of a fun
proof-of-concept than practical solution. Each step runs and completes before
the next begins. This takes a lot longer to run than the other versions, and it
uses more memory, but hey - it runs.

## Bonus: A Text-to-Speech Reader

[read.ts](./read.ts)

**Example**

```sh
zcat ./warandpeace.txt.gz | ./read.ts
```

I've never read _War and Peace_, but now my computer has! It may make your ears
bleed, but this script will read out the entire series of four volumes - over a
few days - reliably. It is a nice reminder that not everything that seems like a
good idea is actually a good idea. Enjoy!
