# Shutting down cleanly

```typescript
{{#include ../../examples/processes/shutdown-main.ts}}
```

```text
{{#include ../../examples/processes/shutdown-main.out}}
```

[`main()`](https://jsr.io/@j50n/proc/doc/~/main) runs your program, and however
it ends, it signals every child process proc started that is still running,
waits for them to exit, and only then exits. Wrap any program that runs
long-lived children in it, and always one that runs in a container.

The service here is a stand-in shell script: it holds a lock file while it runs
and removes it when it gets SIGTERM. Left alone, it finishes by itself, and the
program behaves as it would without `main`.

## Why it's needed

When Deno gets SIGTERM or SIGINT and nothing handles it, it exits at once, and
its children are never told. On a normal host they carry on alone, orphaned. In
a container, Deno is usually the main process, so its exit ends the container,
and the runtime kills every child still running before its cleanup code can run.
A child holding a lock, a temp directory, or a cloud resource never gets the
chance to release it.

An uncaught error is worse, on any host: Deno kills its children itself as it
exits, and their SIGTERM handlers never run.

This program starts the same service twice, once under `main` and once without,
and sends SIGTERM to each as soon as the service is ready:

```text
{{#include ../../examples/processes/shutdown-sigterm.out}}
```

Under `main`, the service got SIGTERM, removed its lock, and the program exited
with 143, as a program killed by SIGTERM reports itself. Without `main`, Deno
died at once; the service never heard anything, and was still running with its
lock held when Deno was gone. (The program that ran the two then stopped it.)

## What `main` does

`main` needs no permissions of its own: listening for signals and signalling the
children it started are both allowed with the `--allow-run` that starting them
needed.

| How the program ends                          | `main` sends the children                              | Exit code         |
| --------------------------------------------- | ------------------------------------------------------ | ----------------- |
| It returns a number, or nothing               | SIGTERM                                                | that number, or 0 |
| It throws, or an error goes uncaught anywhere | SIGTERM                                                | 1                 |
| SIGTERM arrives                               | SIGTERM                                                | 143               |
| SIGINT (Ctrl-C) or SIGHUP (hangup) arrives    | SIGTERM after 1 s, if any are still running; see below | 130 or 129        |

- **On return**, any child still running (one you started and never awaited)
  gets SIGTERM, and `main` waits for it as it would on a signal.
- **On an error**, `main` prints it to stderr before it signals the children.
  That includes an unhandled promise rejection or an error thrown in a timer.
- **On SIGTERM**, `main` passes it on and waits. A SIGTERM comes to Deno alone,
  from `docker stop`, Kubernetes, systemd, or `kill`, so the children hear of it
  only through `main`.
- **On SIGINT or SIGHUP**, `main` doesn't pass it on. These usually come from
  the terminal (Ctrl-C, or the terminal closing), which sends them to the whole
  foreground process group, children included. Forwarding would make it their
  second, and many programs take a second Ctrl-C to mean "quit now, skip the
  cleanup". So `main` gives the children a second to act on the one they got,
  then sends SIGTERM to any still running and waits. That also covers a SIGINT
  sent to Deno alone, by Docker's `STOPSIGNAL SIGINT`, systemd's
  `KillSignal=SIGINT`, an IDE's stop button, or `kill -INT <pid>`: the children
  got nothing, so after the second they get SIGTERM.
- **A second signal** exits at once, without waiting, so a person pressing
  Ctrl-C twice always gets out; children still running get SIGTERM on the way
  out.
- **The first ending wins.** If the program fails and the container's SIGTERM
  arrives while the children are still cleaning up, `main` keeps waiting for
  them and still exits 1. One exception: a Ctrl-C usually reaches a child first,
  and a child dying of it fails the program before the signal reaches `main`.
  When a child ends that way, `main` gives the signal half a second to arrive,
  so the exit is still 130 and the error isn't printed.
- **Children started during the wait**, by a program that carries on, get
  SIGTERM as Deno exits but aren't waited for.

Call `main` once, around the whole program: however it ends, it ends the
process.

On Windows, only SIGINT is handled. Deno doesn't honor `nohup`: under it, a
hangup still reaches Deno, and `main` handles it as above.

## How long it waits

`main` waits up to `timeoutMs`, 30 seconds by default. Children still running
then are left running, not killed, and Deno exits; in a container they die with
it. In a container, the real deadline is the runtime's: it sends SIGTERM, waits
a grace period, then sends SIGKILL to everything.

| Runtime    | Default grace period                    | Set by                                                                       |
| ---------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| Docker     | 10 s (Linux), 30 s (Windows containers) | `docker stop -t`, `docker run --stop-timeout`, Compose's `stop_grace_period` |
| Kubernetes | 30 s                                    | the pod's `terminationGracePeriodSeconds`                                    |
| Amazon ECS | 30 s (at most 120 s on Fargate)         | the container's `stopTimeout`                                                |

These come from the
[`docker stop`](https://docs.docker.com/reference/cli/docker/container/stop/)
reference, the Kubernetes
[Pod API](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/pod-v1/),
and the ECS
[task definition parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html).
In Kubernetes, a `preStop` hook's time counts against the same grace period.

Set `timeoutMs` a little under the grace period, leaving a second or two for
Deno itself to exit:

```typescript
{{#include ../../examples/processes/shutdown-timeout.ts}}
```

Too high, and the SIGKILL arrives first: the children are cut off anyway, and
your program never gets to exit with its own code. Too low, and `main` gives up
while the children could still have finished. Under Docker's default 10 seconds,
the default of 30 is too high; set about `8_000`, or give the container a longer
stop timeout.

## Several children at once

A supervisor runs several long-lived children and waits on all of them:

```typescript
{{#include ../../examples/processes/shutdown-supervisor.ts}}
```

`Promise.all` rejects as soon as one worker fails, so `main` prints that error,
sends SIGTERM to the others, waits for them, and exits 1. On SIGTERM or Ctrl-C,
every worker is stopped as described above. Each worker's stderr goes to yours
untagged; to tag it as well, read it with `fnStderr`.

## Stopping the children without exiting

```typescript
{{#include ../../examples/processes/shutdown-terminate-all.ts}}
```

```text
{{#include ../../examples/processes/shutdown-terminate-all.out}}
```

[`terminateAll()`](https://jsr.io/@j50n/proc/doc/~/terminateAll) is the part of
`main` that signals and waits, on its own: it sends SIGTERM (or the `signal` you
pass) to every running child proc started, all at once, and resolves when they
have exited or `timeoutMs` (default 30 s) has passed. Your program carries on.
It signals every child, not just one; to stop a single command, stop reading it
(see [Stopping early](./pipelines.md#stopping-early)) or
`Deno.kill(p.pid, "SIGTERM")`.

A child that dies of the signal, rather than catching it and exiting cleanly,
makes its consumer throw `SignalError`; the service above traps SIGTERM and
exits 0, so nothing is thrown.

## Wrapper scripts must `exec`

proc signals only the processes it started: children of `run()`, `.run()`, and
`new Process`, not ones started with `Deno.Command` directly, and not their
children in turn. If a child is a shell script that starts the real program, the
signal reaches the shell, and the program under it never hears about the
shutdown. Make the script replace itself with the program:

```sh
#!/bin/sh
export APP_ENV=production
exec java -jar app.jar "$@"
```

Without `exec`, SIGTERM ends the shell, and `java` carries on, orphaned and
unaware. proc sees its child exit and stops waiting, so the cleanup never
happens. Some launchers are such wrappers themselves, so check yours. If a
script can't `exec`, it has to trap the signal and pass it on
(`trap 'kill -TERM "$pid"' TERM`, then `wait`).

The same applies to Deno itself in a container. Use the exec form,
`CMD ["deno", "run", "--allow-run", "main.ts"]`. The shell form of `CMD` or
`ENTRYPOINT` (`CMD deno run main.ts`) runs Deno under `/bin/sh -c`, which, as
the [Dockerfile reference](https://docs.docker.com/reference/dockerfile/) warns,
does not pass signals on, so `main` never sees the SIGTERM.

## What `main` can't do

Nothing runs if Deno is killed outright: by SIGKILL, the out-of-memory killer,
or a failed node. A call to `Deno.exit()` elsewhere in your code also exits at
once; proc sends SIGTERM to the children on the way out, but can't wait for
them. Anything that must be released needs a backstop of its own on the
resource's side, such as a lease or an idle timeout.
