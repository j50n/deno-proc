# Run and the Spread Operator

This compiles:

```typescript
run("ls", "-la");
```

The next example results in this compile error: 
> _A spread argument must either have a tuple type or be passed to a rest parameter._

```typescript
run(...["ls", "-la"]); //Broken!
```

What gives?

Typescript needs a specific tuple type here, but assumes an array type instead.
_This is a Typescript thing,_ and I am sure they will get around to fixing it
one day.

Here is the longer version. The _rest_ parameter passed to `run` is a tuple of
type `Cmd`. The type signature is `[string|URL, ...string[]]`. Typescript
assumes that `["ls", "-la"]` is of type `string[]` and must be told otherwise.
It is not able to figure out that `string[]` of guaranteed non-zero length is
compatible with the tuple type `Cmd`.

Until Typescript addresses this issue, the idiomatic fix is to simply specify
the tuple type:

```typescript
run(...["ls", "-la"] as Cmd);
```

This is a practical exmple of building up a command in piecemeal fashion. It
seems a little cleaner to specify the type where you create the tuple:

```typescript
const cmd: Cmd = ["ls"];
cmd.push("-la");

run(...cmd);
```
