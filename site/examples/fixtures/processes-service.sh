#!/bin/sh
# A stand-in for a long-running service. It holds a lock file (holding its
# PID) while it runs, and on SIGTERM it removes the lock before it exits.
# Left alone, it finishes by itself after about two seconds.
echo $$ > service.lock
trap 'rm -f service.lock; exit 0' TERM
echo "service: ready"
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  sleep 0.1
done
rm -f service.lock
echo "service: finished"
