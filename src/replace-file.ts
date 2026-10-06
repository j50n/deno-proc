/**
 * Write `path` by way of a new file beside it, renamed over it once `write`
 * succeeds. After an error the old file is as it was, and nothing is left
 * beside it; and the new file may be written from the old one, since the old
 * one is still there to read until the rename. A symlink is followed, so the
 * link stays and its target is replaced, and the new file takes the old one's
 * mode. The new file's data is flushed to disk before the rename, so a crash
 * can't leave the name pointing at a file that was never written out.
 *
 * Anything but a regular file is written in place: a device such as
 * `/dev/null`, and anything reached through `/dev` or `/proc`, since
 * `/dev/stdout` leads to whatever file stdout was sent to, perhaps a log
 * opened for appending, which must not be replaced.
 *
 * It needs to read `path` (to follow a link and keep the mode) and to write
 * its directory.
 *
 * @internal
 */
export async function replaceFile(
  path: string,
  write: (path: string) => Promise<void>,
): Promise<void> {
  if (await throughDevice(path)) return await write(path);
  const target = await Deno.realPath(path).catch((error) => {
    if (error instanceof Deno.errors.NotFound) return linkedTo(path);
    throw error;
  });
  const old = await Deno.stat(target).catch(() => undefined);
  if (old !== undefined && !old.isFile) return await write(path);

  // Short enough that a name of up to 255 bytes still makes a legal one.
  const name = target.slice(dirOf(target).length).slice(0, 200);
  const temp = `${dirOf(target)}.${name}.${
    crypto.randomUUID().slice(0, 8)
  }.tmp`;
  unfinished.add(temp);
  try {
    // Private while it is written; the mode is set once it is complete, so
    // a read-only file can be replaced too.
    (await Deno.open(temp, {
      write: true,
      createNew: true,
      mode: old === undefined ? 0o666 : 0o600,
    })).close();
    await write(temp);
    const file = await Deno.open(temp, { write: true });
    try {
      await file.syncData();
    } finally {
      file.close(); // Before the rename, which Windows refuses on an open file.
    }
    // Set after the open, which the umask applies to.
    if (old?.mode != null && Deno.build.os !== "windows") {
      await Deno.chmod(temp, old.mode & 0o7777);
    }
    await Deno.rename(temp, target);
  } catch (error) {
    await Deno.remove(temp).catch(() => {});
    throw error;
  } finally {
    unfinished.delete(temp);
  }
}

/** New files not yet renamed into place, removed if the process exits first. */
const unfinished = new Set<string>();

globalThis.addEventListener("unload", () => {
  for (const temp of unfinished) {
    try {
      Deno.removeSync(temp);
    } catch {
      // Already gone.
    }
  }
});

/** Whether `path`, or a link on the way from it, is in `/dev` or `/proc`. */
async function throughDevice(path: string): Promise<boolean> {
  if (Deno.build.os === "windows") return false;
  let current = path.startsWith("/") ? path : `${Deno.cwd()}/${path}`;
  for (let hops = 0; hops < 40; hops++) {
    if (/^\/(dev|proc)\//.test(current)) return true;
    const info = await Deno.lstat(current).catch(() => undefined);
    if (!info?.isSymlink) return false;
    const link = await Deno.readLink(current);
    current = link.startsWith("/") ? link : dirOf(current) + link;
  }
  return false;
}

/** The directory part of `path`, with its trailing separator, or "". */
function dirOf(path: string): string {
  return path.slice(
    0,
    Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1,
  );
}

/**
 * Where `path` leads when it, or a link it leads to, names a file that doesn't
 * exist yet: the file to create, so that a link stays a link.
 */
async function linkedTo(path: string): Promise<string> {
  for (let hops = 0; hops < 40; hops++) {
    const info = await Deno.lstat(path).catch(() => undefined);
    if (!info?.isSymlink) return path;
    const link = await Deno.readLink(path);
    path = /^([/\\]|[A-Za-z]:)/.test(link) ? link : dirOf(path) + link;
  }
  return path;
}
