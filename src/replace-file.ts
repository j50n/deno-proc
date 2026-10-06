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
    if (error instanceof Deno.errors.NotFound) return linkedTo(path);
    throw error;
  });
  const old = await Deno.stat(target).catch(() => undefined);
  if (old !== undefined && !old.isFile) return await write(path);

  const temp = `${dirOf(target)}.${target.slice(dirOf(target).length)}.${
    crypto.randomUUID().slice(0, 8)
  }.tmp`;
  try {
    (await Deno.open(temp, {
      write: true,
      createNew: true,
      mode: old?.mode ?? 0o666,
    })).close();
    // The umask applied to the mode above; the old file's mode is kept whole.
    if (old?.mode != null && Deno.build.os !== "windows") {
      await Deno.chmod(temp, old.mode & 0o7777);
    }
    await write(temp);
    await Deno.rename(temp, target);
  } catch (error) {
    await Deno.remove(temp).catch(() => {});
    throw error;
  }
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
