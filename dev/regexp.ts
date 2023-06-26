const s = "<s>\ndfsljj\nlsjdfks\nx</s> slkjskdf <s> sdfl\nkjkl ";

//console.dir(/^((?<text>.*)?(?:<s>(?<script>.*)<\/s>)?)*$/ms.exec(s))

let pos = 0;
for (;;) {
  const start = s.indexOf("<s>", pos);

  if (start === -1) {
    console.log(`END-----'${s.substring(pos)}'`);
    break;
  }

  console.log(`'${s.substring(pos, start)}'`);

  const end = s.indexOf("</s>", start);

  if (end === -1) {
    throw new SyntaxError("missing closing script tag at ...");
  }

  console.log(`<SCRIPT>${s.substring(start + "<s>".length, end)}</SCRIPT>`);

  pos = end + "</s>".length;
}
