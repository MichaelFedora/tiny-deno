export async function sizeOf(p: string): Promise<number> {
  const stat = await Deno.stat(p);

  if(stat.isFile)
    return stat.size;

  if(!stat.isDirectory)
    return 0;

  let total = 0;
  for await (const entry of Deno.readDir(p))
    total += await sizeOf(await Deno.realPath(p + '/' + entry.name));

  return total
}
