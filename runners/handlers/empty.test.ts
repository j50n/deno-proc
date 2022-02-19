import * as proc from "../../mod.ts";

Deno.test(
  {
    name: "[README] I can say something.",
    async fn() {
      async function say(text: string): Promise<void> {
        const pg = proc.group();
        try {
          await proc.run00({
            cmd: [
              "spd-say",
              "-w",
              "-t",
              "female3",
              text,
            ],
          });
        } finally {
          pg.close();
        }
      }

      await say("moo moo farms are the best cow farms ever.");
    },
  },
);
