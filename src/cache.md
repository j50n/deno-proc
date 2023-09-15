# `cache.ts`

Implements cacheing using Deno's built-in `kv` database. The key is either a
string or an array of strings. The function to get the data is only called if
the cache data is missing or stale. The timeout is 24 hours by default, and is
defined by the call.

This is a great way to cache slow AWS service calls:

**Example**

```typescript
for (
  const vpc of await cache(
    ["list-vpcs", account.Account, "us-east-1"],
    async () => {
      return await proc.enumerate(
        listVpcs(account.Profile, "us-east-1"),
      )
        .collect();
    },
    { timeout: 1 * WEEK },
  )
) {
  console.dir(vpc);
}
```

The cache can be cleared by:

```shell
rm -rf ~/.cache/deno/location_data/
```
