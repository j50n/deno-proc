import { assert, assertEquals, assertStringIncludes } from "@std/assert";

/*
 * cache() keeps its values in Deno KV's default database, under DENO_DIR. Each
 * test runs a program in its own Deno with a DENO_DIR of its own, so it starts
 * empty and leaves the real one alone. The downloaded modules are shared from
 * the real DENO_DIR, so nothing is fetched again.
 */

const MOD = new URL("../mod.ts", import.meta.url).href;
const CONFIG = new URL("../deno.json", import.meta.url).pathname;

const { modulesCache } = JSON.parse(
  new TextDecoder().decode(
    (await new Deno.Command("deno", { args: ["info", "--json"] }).output())
      .stdout,
  ),
);

async function program(
  body: string,
  flags: string[] = ["--unstable-kv"],
): Promise<{ code: number; stdout: string; stderr: string; ms: number }> {
  const dir = await Deno.makeTempDir();
  try {
    const file = `${dir}/main.ts`;
    await Deno.writeTextFile(
      file,
      `import { cache } from "${MOD}";\n${body}`,
    );
    await Deno.mkdir(`${dir}/deno`);
    // With ln rather than Deno.symlink, which needs unscoped permissions.
    await new Deno.Command("ln", {
      args: ["-s", modulesCache, `${dir}/deno/remote`],
    })
      .output();
    const start = Date.now();
    const { code, stdout, stderr } = await new Deno.Command("deno", {
      args: ["run", "-A", "--config", CONFIG, ...flags, file],
      env: { DENO_DIR: `${dir}/deno`, NO_COLOR: "1" },
    }).output();
    const decoder = new TextDecoder();
    return {
      code,
      stdout: decoder.decode(stdout),
      stderr: decoder.decode(stderr),
      ms: Date.now() - start,
    };
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("cache calls value once while the stored value is fresh.", async () => {
  const run = await program(`
    let calls = 0;
    const value = () => (calls++, 42);
    console.log(await cache("k", value), await cache("k", value), calls);
  `);
  assertEquals(run.stdout, "42 42 1\n", run.stderr);
});

Deno.test("A value Deno KV can't hold is returned, uncached, without an error.", async () => {
  const run = await program(`
    let calls = 0;
    const big = () => (calls++, "x".repeat(100_000));
    const a = await cache("big", big), b = await cache("big", big);
    console.log(a.length, b.length, calls);
  `);
  assertEquals(run.code, 0, run.stderr);
  assertEquals(run.stdout, "100000 100000 2\n");
});

Deno.test("Without Deno KV, cache says how to enable it, without retrying.", async () => {
  const run = await program(
    `try { await cache("k", () => 1); } catch (e) { console.log(e.name, e.message); }`,
    [],
  );
  assertStringIncludes(run.stdout, "TypeError cache needs Deno KV");
  assertStringIncludes(run.stdout, "--unstable-kv");
  assert(run.ms < 2000, `no retries (${run.ms} ms)`);
});
