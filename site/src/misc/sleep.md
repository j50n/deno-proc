# [sleep](https://deno.land/x/proc@{{gitv}}/mod.ts?s=sleep)

`sleep` returns a `Promise` that resolves after a specified number of
milliseconds.

```typescript
console.log("Program starts");
await sleep(2000); // Pauses the execution for 2000 milliseconds
console.log("Program resumes after 2 seconds");
```
