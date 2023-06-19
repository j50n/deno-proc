# Concurrent Processes

`proc` supports concurrent operations with controlled (limited) concurrency.
This is a way to run child processes in parallel without swamping your server.

If you have to work with S3 buckets, you know it is time consuming to determine
how much storage space you are using/paying for, and where you are using the
most storage. `proc` makes it possible to run `ls --summarize` with parallelism
matching the number of CPU cores available (or whatever concurrency you
specify). The specific methods that support concurrent operations are
[.concurrentMap()](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=Enumerable&p=prototype.concurrentMap)
and
[.concurrentUnorderedMap()](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=Enumerable&p=prototype.concurrentUnorderedMap).

To list the `s3` buckets in your AWS account from terminal:

```sh
aws s3 ls
```

The result looks something like this:

```
2013-07-11 17:08:50 mybucket
2013-07-24 14:55:44 mybucket2
```

Get all the bucket names in the account:

```typescript
const buckets = await run("aws", "s3", "ls")
  .map((b) => b.split(/\s+/g, 3))
  .map((b) => b[b.length - 1])
  .collect();
```

This is the shell command to get the total storage size in bytes from terminal:

```shell
aws s3 ls s3://mybucket --recursive --summarize
```

This will list all objects in the bucket, and we can ignore most of this. At the
end of the operation, we are looking for a line that looks like this:

```
Total Size: 2.9 MiB
```

This is potentially a long-running operation (some buckets have a lot of
objects), so we want to run this for many buckets at once, in parallel, and
report the results as soon as they are available.

```typescript
enumerate(buckets).concurrentUnorderedMap(
  async (bucket) => {
    const answer: string = await run(
        "nice", "-19",
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

Use `nice` because _this will eat your server otherwise._ The method
[.concurrentUnorderedMap()](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=Enumerable&p=prototype.concurrentUnorderedMap)
will, by default, run one process for each CPU available concurrently until all
work is done.

The result will look something like this:

```
mybucket  Total Size: 2.9 MiB
mybucket2 Total Size: 30.2 MiB
```
