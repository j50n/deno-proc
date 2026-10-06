import { assert, assertEquals, assertRejects } from "@std/assert";
import { enumerate, read, run } from "../mod.ts";

/** A temp directory for `fn`, removed afterward. */
async function inDir(fn: (dir: string) => Promise<void>) {
  const dir = await Deno.makeTempDir();
  try {
    await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

const names = async (dir: string) =>
  (await Array.fromAsync(Deno.readDir(dir))).map((e) => e.name).sort();

async function* failingAfter(...items: string[]) {
  yield* items;
  throw new Error("source failed");
}

Deno.test("writeTo(path, { atomic }) replaces the file, leaving nothing beside it.", async () => {
  await inDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/out.txt`, "old\n");
    await enumerate(["new"]).writeTo(`${dir}/out.txt`, { atomic: true });
    assertEquals(await Deno.readTextFile(`${dir}/out.txt`), "new\n");
    assertEquals(await names(dir), ["out.txt"]);
  });
});

Deno.test("After a failure, the old file is as it was, with nothing beside it.", async () => {
  await inDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/out.txt`, "yesterday\n");
    await assertRejects(
      () =>
        enumerate(failingAfter("partial")).writeTo(`${dir}/out.txt`, {
          atomic: true,
        }),
      Error,
      "source failed",
    );
    assertEquals(await Deno.readTextFile(`${dir}/out.txt`), "yesterday\n");
    assertEquals(await names(dir), ["out.txt"]);

    // A file that didn't exist isn't created.
    await assertRejects(() =>
      enumerate(failingAfter("partial")).writeTo(`${dir}/new.txt`, {
        atomic: true,
      })
    );
    assertEquals(await names(dir), ["out.txt"]);
  });
});

Deno.test("With atomic, a pipeline can read the file it replaces.", async () => {
  await inDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/f.txt`, "a\nb\n");
    await read(`${dir}/f.txt`).lines.map((line) => line.toUpperCase())
      .writeTo(`${dir}/f.txt`, { atomic: true });
    assertEquals(await Deno.readTextFile(`${dir}/f.txt`), "A\nB\n");
  });
});

Deno.test("With atomic, a symlink stays a symlink and the file keeps its mode.", async () => {
  await inDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/real.txt`, "old\n");
    // Group- and other-writable, which a umask would take away from a new file.
    await Deno.chmod(`${dir}/real.txt`, 0o666);
    // With ln rather than Deno.symlink, which needs unscoped permissions.
    await new Deno.Command("ln", {
      args: ["-s", `${dir}/real.txt`, `${dir}/link.txt`],
    }).output();
    await enumerate(["new"]).writeTo(`${dir}/link.txt`, { atomic: true });
    assert((await Deno.lstat(`${dir}/link.txt`)).isSymlink);
    assertEquals(await Deno.readTextFile(`${dir}/real.txt`), "new\n");
    assertEquals((await Deno.stat(`${dir}/real.txt`)).mode! & 0o777, 0o666);
  });
});

Deno.test("With atomic, a link to a file not there yet stays a link.", async () => {
  await inDir(async (dir) => {
    await new Deno.Command("ln", {
      args: ["-s", "later.txt", `${dir}/link.txt`],
    }).output();
    await enumerate(["new"]).writeTo(`${dir}/link.txt`, { atomic: true });
    assert((await Deno.lstat(`${dir}/link.txt`)).isSymlink);
    assertEquals(await Deno.readTextFile(`${dir}/later.txt`), "new\n");
    assertEquals(await names(dir), ["later.txt", "link.txt"]);
  });
});

Deno.test("If atomic can't start the new file, the source is closed.", async () => {
  await inDir(async (dir) => {
    const yes = run("yes");
    await assertRejects(
      () => yes.lines.writeTo(`${dir}/missing/out.txt`, { atomic: true }),
      Deno.errors.NotFound,
    );
    // yes exits once its output is closed; left unread, it would never exit.
    assertEquals((await yes.status).success, false);
  });
});
