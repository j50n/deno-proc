# Using the Spread Operator in Run


This is fine:

```typescript
run("ls", "-la");
```

This results in an error: _A spread argument must either have a tuple type or be passed to a rest parameter._

```typescript 
run(...["ls", "-la"]);
```

What gives? 

Typescript needs a specific tuple type here, but assumes an array type instead. _This is a Typescript thing, and I am sure they will get around to fixing it one day._

Here is the longer version. The _rest_ parameter passed to `run` is a tuple of type `Cmd`. The type signature is `[string|URL, ...string[]]`. Typescript assumes that `["ls", "-la"]` is of type `string[]`. It is not able to figure out that `string[]` of guaranteed non-zero length is compatible with the tuple type `Cmd`. 

Until Typescript addresses this issue, the idiomatic fix is to simply specify the tuple type:

```typescript
run(...["ls", "-la"] as Cmd);
```

This is a practical exmple of building up a command in piecemeal fashion:

```typescript
const cmd: Cmd = ["ls"];
cmd.push("-la");
run(...cmd);
```