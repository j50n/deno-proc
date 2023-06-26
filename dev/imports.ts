async function blah() {
  const uri = "data:application/typescript," + encodeURIComponent(
    `
    export default () => {
        console.log("Hi");
        return 2;
    }

    export function crud(): boolean{
        console.log("hello")
        return true;
    }
    console.log(3);
    `.split(/\n/g).map((it) => it.trim()).join("\n"),
  );

  console.log(uri);

  return await import(uri);
}

const BLAH = await blah();

console.log(BLAH.crud());

console.dir(BLAH);

BLAH.default();
