# Count Unique Words in _War and Peace_

Tolstoy`s _War and Peace_ is sprawling and immense, and it uses a lot of words.
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

This is what we are trying to do in Deno.

## Version #1

[countwords.ts](./countwords.ts)

**Example**

```sh
./countwords.ts < ./warandpeace.txt.gz
```

This version makes a great example because it does a little bit of everything,
but it is starting to get cluttered and is a little hard to read.

## Version #2

[countwords2.ts](./countwords2.ts)

**Example**

```sh
./countwords2.ts < ./warandpeace.txt.gz
```

This version is more practical, easier to read, and quite a bit faster than the
first. Rather than shelling out individual commands, it shells out `bash`
scripts to do those things.
