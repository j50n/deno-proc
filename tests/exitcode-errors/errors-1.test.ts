import { ExitCodeError, lines, run } from "../../mod.ts";
import { assertEquals, assertRejects } from "../deps/asserts.ts";

Deno.test({
  name: "Non-zero exit code, direct consumption.",

  /* See README. */
  sanitizeResources: false,

  async fn() {
    const lns: string[] = [];

    await assertRejects(
      async () => {
        for await (
          const line of lines(
            run(
              "deno",
              "run",
              import.meta.resolve("./print-lines-and-fail.ts"),
            ),
          )
        ) {
          lns.push(line);
        }
      },
      ExitCodeError,
      "Process exited with non-zero exit code: 42",
      "Process returns lines of data and then exits with an error code. We process the lines then throw an error. Data is consumed directly.",
    );

    assertEquals(
      lns,
      ["0", "1", "2", "3"],
      "Data returned by the process is fully consumed.",
    );
  },
});

// Deno.test({
//   name: "Non-zero exit code, streamed through a process.",

//   /* See README. */
//   sanitizeResources: false,

//   async fn() {
//     const lns: string[] = [];

//     // await assertRejects(
//     //   async () => {
//     //     for await (
//     //       const line of lines(
//     //         run(
//     //           "deno",
//     //           "run",
//     //           import.meta.resolve("./print-lines-and-fail.ts"),
//     //         ).run("cat"),
//     //       )
//     //     ) {
//     //       lns.push(line);
//     //     }
//     //   },
//     //   ExitCodeError,
//     //   "Process exited with non-zero exit code: 42",
//     //   "Returns lines of data and then exits with an error code. We process the lines then throw an error. Data is passed through a second process.",
//     // );

//     try {
//       for await (
//         const line of lines(
//           run(
//             "deno",
//             "run",
//             import.meta.resolve("./print-lines-and-fail.ts"),
//           ).run("cat"),
//         )
//       ) {
//         lns.push(line);
//       }
//     } catch (e) {
//       console.dir(e);
//     }

//     assertEquals(
//       lns,
//       ["0", "1", "2", "3"],
//       "Data returned by the process is fully consumed.",
//     );
//   },
// });
