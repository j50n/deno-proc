/**
 * Write `path` by way of a new file beside it, renamed over it once `write`
 * succeeds. After an error the old file is as it was, and nothing is left
 * beside it; and the new file may be written from the old one, since the old
 * one is still there to read until the rename. A symlink is followed, so the
 * link stays and its target is replaced, and the new file takes the old one's
 * mode. Anything but a regular file, such as `/dev/null`, is written in place.
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
  const target = await Deno.realPath(path).catch((error) => {
    if (error instanceof Deno.errors.NotFound) return path;
    throw error;
  });
  const old = await Deno.stat(target).catch(() => undefined);
  if (old !== undefined && !old.isFile) return await write(path);

  const slash = Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\"));
  const temp = `${target.slice(0, slash + 1)}.${target.slice(slash + 1)}.${
    crypto.randomUUID().slice(0, 8)
  }.tmp`;
  try {
    (await Deno.open(temp, {
      write: true,
      createNew: true,
      mode: old?.mode ?? 0o666,
    })).close();
    await write(temp);
    await Deno.rename(temp, target);
  } catch (error) {
    await Deno.remove(temp).catch(() => {});
    throw error;
  }
}
