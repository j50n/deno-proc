# Introduction

## Efficient `du` for S3 Buckets

To list the `s3` buckets in your AWS account from terminal:

```sh
aws s3 ls
```

The result looks something like this:

```
2013-07-11 17:08:50 mybucket
2013-07-24 14:55:44 mybucket2
```

Grab those bucket names with `proc`:

```typescript
const buckets = await run("aws", "s3", "ls")
  .map((b) => b.split(/\s+/g, 3))
  .map((b) => b[b.length - 1])
  .collect()
```

To get the total storage size in bytes from terminal:

```sh
aws s3 ls s3://mybucket --recursive --summarize
```

This will list all objects in the bucket, but we can ignore that noise. At the end of the operation, we are looking for a line that looks like this:

```
Total Size: 2.9 MiB
```

This is potentially a long-running operation (some buckets have a lot of objects), so we want to run it concurrently. With `proc`:

```typescript
enumerate(buckets).concurrentUnorderedMap(
  async (bucket) => {
    const answer: string = await run(
        // "nice",
        "aws", "s3", "ls", 
        `s3://${bucket}`, 
        "--recursive", "--summarize")
      .filter(line => line.includes("Total Size:"))
      .map(line => line.trim())
      .first;

    return {bucket, answer};
  }.forEach(({bucket, answer}) => console.log(`${bucket}\t${answer}`))
)
```

Use `nice` if you want to lower the priority of the `aws` processes. The method `.concurrentUnorderedMap()` will, by default, run one process for each CPU available concurrently until all work is done. 

The result will look something like this:

```
mybucket  Total Size: 2.9 MiB
mybucket2 Total Size: 30.2 MiB
```
