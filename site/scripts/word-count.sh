#!/bin/bash
set -e

zcat ./warandpeace.txt.gz \
  | tr '[:upper:]' '[:lower:]' \
  | grep -oE "(\\w|'|’|-)+" \
  | wc -l 

zcat ./warandpeace.txt.gz \
  | tr '[:upper:]' '[:lower:]' \
  | grep -oE "(\\w|'|’|-)+" \
  | sort \
  | uniq \
  | wc -l