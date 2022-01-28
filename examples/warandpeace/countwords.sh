#!/bin/bash

cat - | gunzip | grep -o -E "(\\w|')+" | grep -v -P '^\d' | tr '[:upper:]' '[:lower:]' | sort | uniq  | wc -l