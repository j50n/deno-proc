# `count-words.test`

Our target `bash` script is:

```shell
#!/bin/bash
set -e
cat - | gunzip | grep -o -E "(\\w|')+" | grep -v -P '^\d' | tr '[:upper:]' '[:lower:]' | sort | uniq  | wc -l
```

Let's see what we can do with this in Deno.