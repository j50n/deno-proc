const line = "Anna Pávlovna said, “Don’t tease!”".toLowerCase();

console.log(line.match(/[a-z]+/g)?.join(" ")); // what tr -cs A-Za-z sees
console.log(line.match(/\p{L}+(?:’\p{L}+)*/gu)?.join(" ")); // any script
