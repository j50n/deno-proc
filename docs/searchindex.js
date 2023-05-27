Object.assign(window.search, {
  "doc_urls": [
    "introduction.html#introduction",
    "introduction.html#the-denocommand-way",
    "introduction.html#the-easy-way-of-proc",
    "spread.html#using-the-spread-operator-in-run",
  ],
  "index": {
    "documentStore": {
      "docInfo": {
        "0": { "body": 169, "breadcrumbs": 2, "title": 1 },
        "1": { "body": 94, "breadcrumbs": 3, "title": 2 },
        "2": { "body": 61, "breadcrumbs": 4, "title": 3 },
        "3": { "body": 90, "breadcrumbs": 8, "title": 4 },
      },
      "docs": {
        "0": {
          "body":
            'Deno is a great choice to replace your bash scripts when they become too complex. Type checking and security-by-default make it safer to use when you have to test in production. It removes the need for a package-manager, so you can run scripts from source without an installation step. If only we had better support for managing child processes. At the start of 2023, we got that support. The Deno team has deprecated Deno.run in favor of Deno.Command. The new API is a major step forward. Resource cleanup and error checking are automatic now. The resulting code is cleaner. The performance is stellar. I think, though, that there is still some room for improvement. Introducing proc. This is is a lightweight rethinking of the Deno.Command API for use doing shell-script-like things. It makes the simple things dead-simple and really cleans up the more complex ones. The goal of proc is to make programming with processes as close to the experience of shell scripting as possible. While the resulting code isn\'t as terse as the equivalent shell script, it is pretty close to minimal for Typescript syntax. It should be possible to pipe the output of one process directly to another without boilerplate. Command syntax should be simpler. Processing the output as lines of text or as an array should be obvious. These are the kinds of things that proc give you. Note that proc is not reinventing or replacing Deno.Command at all. It is an extension. It uses the same interfaces, the same methods, streams, etc., so you can do things the same way you would - with the same performance - as Deno.Command. You can use as much or as little of proc as you wish, taking full control or doing it the "easy way." Here are some working examples to give you an idea of some of the differences between proc and out-of-the-box Deno.Command.',
          "breadcrumbs": "Introduction » Introduction",
          "id": "0",
          "title": "Introduction",
        },
        "1": {
          "body":
            'Here are some different approaches to listing files using ls using Deno.Command. The equivalent in bash would look like this: ls -la Example 1 (for Command) To do this using Deno.Command, I can do this (output bytes captured all at once, decoded to text): const output = await new Deno.Command("ls", { args: ["-la"] }).output();\nconsole.log(new TextDecoder().decode(output.stdout)); Example 2 (for Command) Or this (output is streamed as text lines): for await ( const line of new Deno.Command("ls", { args: ["-la"], stdout: "piped" }) .spawn() .stdout .pipeThrough(new TextDecoderStream()) .pipeThrough(new TextLineStream())\n) { console.log(line);\n} This is really good compared to the old Deno.run which would leak resources if you didn\'t close the process and (multiple) readers explicitly. Error handling in child processes could also be tricky. In the new Deno.Command, all that is handled in a sensible way, automatically. This is already a giant leap forward for child process support in Deno. There is still a lot of boilerplate. We can do better.',
          "breadcrumbs": "Introduction » The Deno.Command Way",
          "id": "1",
          "title": "The Deno.Command Way",
        },
        "2": {
          "body":
            'Here are some approaches to running ls using proc. These are equivalent to the code in the previous section - but simpler. Example 1 (for proc) This is equivalent to the first example. stdout of the process is fully captured, converted to text, and returned when the process exits. console.log(await run("ls", "-la").asString()); Example 2 (for proc) Or how about this? This is equivalent to the second example. This is streaming stdout as text lines: for await (const line of lines(run("ls", "-la"))) { console.log(line);\n} If you really want the simplest version, there is also this (though you have no access to stdout): await execute("ls", "-la"); Ah! Just take a moment now and breathe in the minimalism.',
          "breadcrumbs": "Introduction » The (Easy) Way of proc",
          "id": "2",
          "title": "The (Easy) Way of proc",
        },
        "3": {
          "body":
            'This is fine: run("ls", "-la"); This results in an error: A spread argument must either have a tuple type or be passed to a rest parameter. run(...["ls", "-la"]); What gives? Typescript needs a specific tuple type here, but assumes an array type instead. This is a Typescript thing, and I am sure they will get around to fixing it one day. Here is the longer version. The rest parameter passed to run is a tuple of type Cmd. The type signature is [string|URL, ...string[]]. Typescript assumes that ["ls", "-la"] is of type string[]. It is not able to figure out that string[] of guaranteed non-zero length is compatible with the tuple type Cmd. Until Typescript addresses this issue, the idiomatic fix is to simply specify the tuple type: run(...["ls", "-la"] as Cmd); This is a practical exmple of building up a command in piecemeal fashion: const cmd: Cmd = ["ls"];\ncmd.push("-la");\nrun(...cmd);',
          "breadcrumbs":
            "Using the Spread Operator in Run » Using the Spread Operator in Run",
          "id": "3",
          "title": "Using the Spread Operator in Run",
        },
      },
      "length": 4,
      "save": true,
    },
    "fields": ["title", "body", "breadcrumbs"],
    "index": {
      "body": {
        "root": {
          "1": { "df": 2, "docs": { "1": { "tf": 1.0 }, "2": { "tf": 1.0 } } },
          "2": {
            "0": {
              "2": {
                "3": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
              "df": 0,
              "docs": {},
            },
            "df": 2,
            "docs": { "1": { "tf": 1.0 }, "2": { "tf": 1.0 } },
          },
          "a": {
            "c": {
              "c": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "s": {
                    "df": 0,
                    "docs": {},
                    "s": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                  },
                },
              },
              "df": 0,
              "docs": {},
            },
            "d": {
              "d": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "s": {
                      "df": 0,
                      "docs": {},
                      "s": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    },
                  },
                },
              },
              "df": 0,
              "docs": {},
            },
            "df": 0,
            "docs": {},
            "h": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
            "l": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "a": {
                    "d": {
                      "df": 0,
                      "docs": {},
                      "i": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "n": {
              "df": 0,
              "docs": {},
              "o": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "h": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
            },
            "p": {
              "df": 0,
              "docs": {},
              "i": { "df": 1, "docs": { "0": { "tf": 1.4142135623730951 } } },
              "p": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "a": {
                      "c": {
                        "df": 0,
                        "docs": {},
                        "h": {
                          "df": 2,
                          "docs": { "1": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                        },
                      },
                      "df": 0,
                      "docs": {},
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "r": {
              "df": 0,
              "docs": {},
              "g": {
                "df": 1,
                "docs": { "1": { "tf": 1.4142135623730951 } },
                "u": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "df": 0,
                      "docs": {},
                      "n": {
                        "df": 0,
                        "docs": {},
                        "t": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      },
                    },
                  },
                },
              },
              "o": {
                "df": 0,
                "docs": {},
                "u": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "d": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
              "r": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "y": {
                    "df": 2,
                    "docs": { "0": { "tf": 1.0 }, "3": { "tf": 1.0 } },
                  },
                },
                "df": 0,
                "docs": {},
              },
            },
            "s": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "u": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "df": 1,
                    "docs": { "3": { "tf": 1.4142135623730951 } },
                  },
                },
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "t": {
                        "df": 2,
                        "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "w": {
              "a": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 2,
                    "docs": {
                      "1": { "tf": 1.4142135623730951 },
                      "2": { "tf": 1.4142135623730951 },
                    },
                  },
                },
              },
              "df": 0,
              "docs": {},
            },
          },
          "b": {
            "a": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 2,
                  "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                },
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "c": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "m": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 2,
                      "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                    },
                  },
                },
                "w": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "df": 0,
                      "docs": {},
                      "n": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "i": {
                "df": 0,
                "docs": {},
                "l": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 0,
                      "docs": {},
                      "p": {
                        "df": 0,
                        "docs": {},
                        "l": {
                          "df": 2,
                          "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                        },
                      },
                    },
                  },
                },
              },
              "x": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
            },
            "r": {
              "df": 0,
              "docs": {},
              "e": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 0,
                    "docs": {},
                    "h": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                  },
                },
                "df": 0,
                "docs": {},
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "i": {
                "df": 0,
                "docs": {},
                "l": {
                  "d": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "y": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              },
            },
          },
          "c": {
            "a": {
              "df": 0,
              "docs": {},
              "p": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 2,
                      "docs": { "1": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                    },
                  },
                },
              },
            },
            "df": 0,
            "docs": {},
            "h": {
              "df": 0,
              "docs": {},
              "e": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "k": {
                    "df": 1,
                    "docs": { "0": { "tf": 1.4142135623730951 } },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "i": {
                "df": 0,
                "docs": {},
                "l": {
                  "d": {
                    "df": 2,
                    "docs": {
                      "0": { "tf": 1.0 },
                      "1": { "tf": 1.4142135623730951 },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "o": {
                "df": 0,
                "docs": {},
                "i": {
                  "c": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "l": {
              "df": 0,
              "docs": {},
              "e": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "df": 1,
                    "docs": { "0": { "tf": 1.0 } },
                    "e": {
                      "df": 0,
                      "docs": {},
                      "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                    "u": {
                      "df": 0,
                      "docs": {},
                      "p": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "o": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 2,
                    "docs": {
                      "0": { "tf": 1.4142135623730951 },
                      "1": { "tf": 1.0 },
                    },
                  },
                },
              },
            },
            "m": {
              "d": {
                ".": {
                  "df": 0,
                  "docs": {},
                  "p": {
                    "df": 0,
                    "docs": {},
                    "u": {
                      "df": 0,
                      "docs": {},
                      "s": {
                        "df": 0,
                        "docs": {},
                        "h": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      },
                    },
                  },
                },
                "df": 1,
                "docs": { "3": { "tf": 2.23606797749979 } },
              },
              "df": 0,
              "docs": {},
            },
            "o": {
              "d": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 2,
                  "docs": {
                    "0": { "tf": 1.4142135623730951 },
                    "2": { "tf": 1.0 },
                  },
                },
              },
              "df": 0,
              "docs": {},
              "m": {
                "df": 0,
                "docs": {},
                "m": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "n": {
                      "d": {
                        "df": 3,
                        "docs": {
                          "0": { "tf": 1.0 },
                          "1": { "tf": 1.4142135623730951 },
                          "3": { "tf": 1.0 },
                        },
                      },
                      "df": 0,
                      "docs": {},
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
                "p": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "r": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                    "t": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  },
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "df": 0,
                      "docs": {},
                      "x": {
                        "df": 1,
                        "docs": { "0": { "tf": 1.4142135623730951 } },
                      },
                    },
                  },
                },
              },
              "n": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "l": {
                      "df": 0,
                      "docs": {},
                      "e": {
                        ".": {
                          "df": 0,
                          "docs": {},
                          "l": {
                            "df": 0,
                            "docs": {},
                            "o": {
                              "df": 0,
                              "docs": {},
                              "g": {
                                "(": {
                                  "a": {
                                    "df": 0,
                                    "docs": {},
                                    "w": {
                                      "a": {
                                        "df": 0,
                                        "docs": {},
                                        "i": {
                                          "df": 0,
                                          "docs": {},
                                          "t": {
                                            "df": 1,
                                            "docs": { "2": { "tf": 1.0 } },
                                          },
                                        },
                                      },
                                      "df": 0,
                                      "docs": {},
                                    },
                                  },
                                  "df": 0,
                                  "docs": {},
                                  "l": {
                                    "df": 0,
                                    "docs": {},
                                    "i": {
                                      "df": 0,
                                      "docs": {},
                                      "n": {
                                        "df": 2,
                                        "docs": {
                                          "1": { "tf": 1.0 },
                                          "2": { "tf": 1.0 },
                                        },
                                      },
                                    },
                                  },
                                  "n": {
                                    "df": 0,
                                    "docs": {},
                                    "e": {
                                      "df": 0,
                                      "docs": {},
                                      "w": {
                                        "df": 1,
                                        "docs": { "1": { "tf": 1.0 } },
                                      },
                                    },
                                  },
                                },
                                "df": 0,
                                "docs": {},
                              },
                            },
                          },
                        },
                        "df": 0,
                        "docs": {},
                      },
                    },
                  },
                  "t": {
                    "df": 3,
                    "docs": {
                      "1": { "tf": 1.4142135623730951 },
                      "2": { "tf": 1.0 },
                      "3": { "tf": 1.0 },
                    },
                  },
                },
                "t": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "df": 0,
                    "docs": {},
                    "o": {
                      "df": 0,
                      "docs": {},
                      "l": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                  },
                },
                "v": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 0,
                      "docs": {},
                      "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                    },
                  },
                },
              },
            },
          },
          "d": {
            "a": {
              "df": 0,
              "docs": {},
              "y": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
            },
            "df": 0,
            "docs": {},
            "e": {
              "a": {
                "d": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
              "c": {
                "df": 0,
                "docs": {},
                "o": {
                  "d": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                  "df": 0,
                  "docs": {},
                },
              },
              "df": 0,
              "docs": {},
              "f": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "l": {
                      "df": 0,
                      "docs": {},
                      "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "n": {
                "df": 0,
                "docs": {},
                "o": {
                  ".": {
                    "c": {
                      "df": 0,
                      "docs": {},
                      "o": {
                        "df": 0,
                        "docs": {},
                        "m": {
                          "df": 0,
                          "docs": {},
                          "m": {
                            "a": {
                              "df": 0,
                              "docs": {},
                              "n": {
                                "d": {
                                  "(": {
                                    '"': {
                                      "df": 0,
                                      "docs": {},
                                      "l": {
                                        "df": 1,
                                        "docs": {
                                          "1": { "tf": 1.4142135623730951 },
                                        },
                                      },
                                    },
                                    "df": 0,
                                    "docs": {},
                                  },
                                  "df": 2,
                                  "docs": {
                                    "0": { "tf": 2.23606797749979 },
                                    "1": { "tf": 2.0 },
                                  },
                                },
                                "df": 0,
                                "docs": {},
                              },
                            },
                            "df": 0,
                            "docs": {},
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 0,
                      "docs": {},
                      "u": {
                        "df": 0,
                        "docs": {},
                        "n": {
                          "df": 2,
                          "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                        },
                      },
                    },
                  },
                  "df": 2,
                  "docs": {
                    "0": { "tf": 1.4142135623730951 },
                    "1": { "tf": 1.0 },
                  },
                },
              },
              "p": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "c": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "i": {
              "d": {
                "df": 0,
                "docs": {},
                "n": {
                  "'": {
                    "df": 0,
                    "docs": {},
                    "t": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "df": 0,
              "docs": {},
              "f": {
                "df": 0,
                "docs": {},
                "f": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 2,
                      "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                    },
                  },
                },
              },
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "c": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 0,
                      "docs": {},
                      "l": {
                        "df": 0,
                        "docs": {},
                        "i": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                      },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "o": { "df": 1, "docs": { "0": { "tf": 1.4142135623730951 } } },
          },
          "df": 0,
          "docs": {},
          "e": {
            "a": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 2,
                  "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                },
              },
            },
            "df": 0,
            "docs": {},
            "q": {
              "df": 0,
              "docs": {},
              "u": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "v": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "l": {
                        "df": 3,
                        "docs": {
                          "0": { "tf": 1.0 },
                          "1": { "tf": 1.0 },
                          "2": { "tf": 1.7320508075688772 },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "r": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "df": 3,
                    "docs": {
                      "0": { "tf": 1.0 },
                      "1": { "tf": 1.0 },
                      "3": { "tf": 1.0 },
                    },
                  },
                },
              },
            },
            "t": {
              "c": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              "df": 0,
              "docs": {},
            },
            "x": {
              "a": {
                "df": 0,
                "docs": {},
                "m": {
                  "df": 0,
                  "docs": {},
                  "p": {
                    "df": 0,
                    "docs": {},
                    "l": {
                      "df": 3,
                      "docs": {
                        "0": { "tf": 1.0 },
                        "1": { "tf": 1.4142135623730951 },
                        "2": { "tf": 2.0 },
                      },
                    },
                  },
                },
              },
              "df": 0,
              "docs": {},
              "e": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 0,
                      "docs": {},
                      "e": {
                        "(": {
                          '"': {
                            "df": 0,
                            "docs": {},
                            "l": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                          },
                          "df": 0,
                          "docs": {},
                        },
                        "df": 0,
                        "docs": {},
                      },
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "i": {
                "df": 0,
                "docs": {},
                "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
              },
              "m": {
                "df": 0,
                "docs": {},
                "p": {
                  "df": 0,
                  "docs": {},
                  "l": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                },
              },
              "p": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "df": 0,
                    "docs": {},
                    "i": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                },
                "l": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "c": {
                      "df": 0,
                      "docs": {},
                      "i": {
                        "df": 0,
                        "docs": {},
                        "t": {
                          "df": 0,
                          "docs": {},
                          "l": {
                            "df": 0,
                            "docs": {},
                            "i": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
              "t": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "df": 0,
                    "docs": {},
                    "s": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                },
              },
            },
          },
          "f": {
            "a": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "o": {
                      "df": 0,
                      "docs": {},
                      "n": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    },
                  },
                },
              },
              "v": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
            },
            "df": 0,
            "docs": {},
            "i": {
              "df": 0,
              "docs": {},
              "g": {
                "df": 0,
                "docs": {},
                "u": {
                  "df": 0,
                  "docs": {},
                  "r": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                },
              },
              "l": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              },
              "n": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              },
              "r": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                },
              },
              "x": { "df": 1, "docs": { "3": { "tf": 1.4142135623730951 } } },
            },
            "o": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "w": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "d": {
                        "df": 2,
                        "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                      },
                      "df": 0,
                      "docs": {},
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "l": {
                "df": 0,
                "docs": {},
                "l": {
                  "df": 1,
                  "docs": { "0": { "tf": 1.0 } },
                  "i": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                },
              },
            },
          },
          "g": {
            "df": 0,
            "docs": {},
            "i": {
              "a": {
                "df": 0,
                "docs": {},
                "n": {
                  "df": 0,
                  "docs": {},
                  "t": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                },
              },
              "df": 0,
              "docs": {},
              "v": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 2,
                  "docs": {
                    "0": { "tf": 1.4142135623730951 },
                    "3": { "tf": 1.0 },
                  },
                },
              },
            },
            "o": {
              "a": {
                "df": 0,
                "docs": {},
                "l": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "df": 0,
              "docs": {},
              "o": {
                "d": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
            },
            "r": {
              "df": 0,
              "docs": {},
              "e": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
                "df": 0,
                "docs": {},
              },
            },
            "u": {
              "a": {
                "df": 0,
                "docs": {},
                "r": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "n": {
                      "df": 0,
                      "docs": {},
                      "t": {
                        "df": 0,
                        "docs": {},
                        "e": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "df": 0,
              "docs": {},
            },
          },
          "h": {
            "a": {
              "df": 0,
              "docs": {},
              "n": {
                "d": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 1,
                    "docs": { "1": { "tf": 1.4142135623730951 } },
                  },
                },
                "df": 0,
                "docs": {},
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 4,
                  "docs": {
                    "0": { "tf": 1.0 },
                    "1": { "tf": 1.0 },
                    "2": { "tf": 1.0 },
                    "3": { "tf": 1.4142135623730951 },
                  },
                },
              },
            },
          },
          "i": {
            "d": {
              "df": 0,
              "docs": {},
              "e": {
                "a": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
              "i": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "t": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "df": 0,
            "docs": {},
            "m": {
              "df": 0,
              "docs": {},
              "p": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "v": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                },
              },
            },
            "n": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "t": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "l": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                  "df": 0,
                  "docs": {},
                  "e": {
                    "a": {
                      "d": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      "df": 0,
                      "docs": {},
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
              "t": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "df": 0,
                    "docs": {},
                    "f": {
                      "a": {
                        "c": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                        "df": 0,
                        "docs": {},
                      },
                      "df": 0,
                      "docs": {},
                    },
                  },
                },
                "r": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "d": {
                      "df": 0,
                      "docs": {},
                      "u": {
                        "c": {
                          "df": 1,
                          "docs": { "0": { "tf": 1.0 } },
                          "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                        },
                        "df": 0,
                        "docs": {},
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "s": {
              "df": 0,
              "docs": {},
              "n": {
                "'": {
                  "df": 0,
                  "docs": {},
                  "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
                "df": 0,
                "docs": {},
              },
              "s": {
                "df": 0,
                "docs": {},
                "u": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              },
            },
          },
          "k": {
            "df": 0,
            "docs": {},
            "i": {
              "df": 0,
              "docs": {},
              "n": {
                "d": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
            },
          },
          "l": {
            "a": {
              '"': {
                ")": {
                  ".": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "s": {
                        "df": 0,
                        "docs": {},
                        "s": {
                          "df": 0,
                          "docs": {},
                          "t": {
                            "df": 0,
                            "docs": {},
                            "r": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
                "df": 0,
                "docs": {},
              },
              "df": 3,
              "docs": {
                "1": { "tf": 1.7320508075688772 },
                "2": { "tf": 1.4142135623730951 },
                "3": { "tf": 2.23606797749979 },
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "a": {
                "df": 0,
                "docs": {},
                "k": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                "p": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              },
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "g": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 0,
                    "docs": {},
                    "h": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  },
                },
              },
            },
            "i": {
              "df": 0,
              "docs": {},
              "g": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 0,
                    "docs": {},
                    "w": {
                      "df": 0,
                      "docs": {},
                      "e": {
                        "df": 0,
                        "docs": {},
                        "i": {
                          "df": 0,
                          "docs": {},
                          "g": {
                            "df": 0,
                            "docs": {},
                            "h": {
                              "df": 0,
                              "docs": {},
                              "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              "n": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 3,
                  "docs": {
                    "0": { "tf": 1.0 },
                    "1": { "tf": 1.4142135623730951 },
                    "2": { "tf": 1.4142135623730951 },
                  },
                  "s": {
                    "(": {
                      "df": 0,
                      "docs": {},
                      "r": {
                        "df": 0,
                        "docs": {},
                        "u": {
                          "df": 0,
                          "docs": {},
                          "n": {
                            "(": {
                              '"': {
                                "df": 0,
                                "docs": {},
                                "l": {
                                  "df": 1,
                                  "docs": { "2": { "tf": 1.0 } },
                                },
                              },
                              "df": 0,
                              "docs": {},
                            },
                            "df": 0,
                            "docs": {},
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
              "s": {
                "df": 0,
                "docs": {},
                "t": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              },
              "t": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "l": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "g": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  },
                },
              },
              "o": {
                "df": 0,
                "docs": {},
                "k": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              },
              "t": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
            },
            "s": {
              "df": 3,
              "docs": {
                "1": { "tf": 1.4142135623730951 },
                "2": { "tf": 1.0 },
                "3": { "tf": 1.4142135623730951 },
              },
            },
          },
          "m": {
            "a": {
              "df": 0,
              "docs": {},
              "j": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "k": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "0": { "tf": 1.7320508075688772 } } },
              },
              "n": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "g": {
                    "df": 1,
                    "docs": { "0": { "tf": 1.4142135623730951 } },
                  },
                },
                "df": 0,
                "docs": {},
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "d": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "i": {
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "df": 2,
                    "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "m": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "df": 0,
                    "docs": {},
                    "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                  },
                },
              },
              "r": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
            },
            "u": {
              "c": {
                "df": 0,
                "docs": {},
                "h": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "df": 0,
              "docs": {},
              "l": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "p": {
                      "df": 0,
                      "docs": {},
                      "l": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                    },
                  },
                },
              },
            },
          },
          "n": {
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "e": {
                "d": {
                  "df": 2,
                  "docs": { "0": { "tf": 1.0 }, "3": { "tf": 1.0 } },
                },
                "df": 0,
                "docs": {},
              },
              "w": {
                "df": 2,
                "docs": {
                  "0": { "tf": 1.0 },
                  "1": { "tf": 1.7320508075688772 },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "n": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              "t": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "w": {
                "df": 2,
                "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
              },
            },
          },
          "o": {
            "b": {
              "df": 0,
              "docs": {},
              "v": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "u": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                },
              },
            },
            "df": 0,
            "docs": {},
            "l": {
              "d": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              "df": 0,
              "docs": {},
            },
            "n": {
              "c": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              "df": 2,
              "docs": { "0": { "tf": 1.4142135623730951 }, "3": { "tf": 1.0 } },
            },
            "p": {
              "df": 0,
              "docs": {},
              "e": {
                "df": 0,
                "docs": {},
                "r": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 2,
                "docs": { "0": { "tf": 1.0 }, "3": { "tf": 1.0 } },
                "p": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 2,
                      "docs": {
                        "0": { "tf": 1.4142135623730951 },
                        "1": { "tf": 2.0 },
                      },
                    },
                  },
                },
              },
            },
          },
          "p": {
            "a": {
              "c": {
                "df": 0,
                "docs": {},
                "k": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "g": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "df": 0,
              "docs": {},
              "r": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "df": 0,
                      "docs": {},
                      "t": {
                        "df": 1,
                        "docs": { "3": { "tf": 1.4142135623730951 } },
                      },
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "s": {
                "df": 0,
                "docs": {},
                "s": { "df": 1, "docs": { "3": { "tf": 1.4142135623730951 } } },
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "f": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 0,
                      "docs": {},
                      "m": {
                        "df": 1,
                        "docs": { "0": { "tf": 1.4142135623730951 } },
                      },
                    },
                  },
                },
              },
            },
            "i": {
              "df": 0,
              "docs": {},
              "e": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "m": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "p": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 2,
                  "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                  "t": {
                    "df": 0,
                    "docs": {},
                    "h": {
                      "df": 0,
                      "docs": {},
                      "r": {
                        "df": 0,
                        "docs": {},
                        "o": {
                          "df": 0,
                          "docs": {},
                          "u": {
                            "df": 0,
                            "docs": {},
                            "g": {
                              "df": 0,
                              "docs": {},
                              "h": {
                                "(": {
                                  "df": 0,
                                  "docs": {},
                                  "n": {
                                    "df": 0,
                                    "docs": {},
                                    "e": {
                                      "df": 0,
                                      "docs": {},
                                      "w": {
                                        "df": 1,
                                        "docs": {
                                          "1": { "tf": 1.4142135623730951 },
                                        },
                                      },
                                    },
                                  },
                                },
                                "df": 0,
                                "docs": {},
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "b": {
                      "df": 0,
                      "docs": {},
                      "l": {
                        "df": 1,
                        "docs": { "0": { "tf": 1.4142135623730951 } },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "r": {
              "a": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 0,
                    "docs": {},
                    "i": {
                      "c": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      "df": 0,
                      "docs": {},
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "df": 0,
              "docs": {},
              "e": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 0,
                    "docs": {},
                    "i": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                },
                "v": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "o": {
                      "df": 0,
                      "docs": {},
                      "u": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                    },
                  },
                },
              },
              "o": {
                "c": {
                  "df": 2,
                  "docs": {
                    "0": { "tf": 2.449489742783178 },
                    "2": { "tf": 2.0 },
                  },
                  "e": {
                    "df": 0,
                    "docs": {},
                    "s": {
                      "df": 0,
                      "docs": {},
                      "s": {
                        "df": 3,
                        "docs": {
                          "0": { "tf": 2.0 },
                          "1": { "tf": 1.7320508075688772 },
                          "2": { "tf": 1.4142135623730951 },
                        },
                      },
                    },
                  },
                },
                "d": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "c": {
                      "df": 0,
                      "docs": {},
                      "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
                "df": 0,
                "docs": {},
                "g": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "m": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
          },
          "r": {
            "df": 0,
            "docs": {},
            "e": {
              "a": {
                "d": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                  },
                },
                "df": 0,
                "docs": {},
                "l": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 0,
                    "docs": {},
                    "i": {
                      "df": 3,
                      "docs": {
                        "0": { "tf": 1.0 },
                        "1": { "tf": 1.0 },
                        "2": { "tf": 1.0 },
                      },
                    },
                  },
                },
              },
              "df": 0,
              "docs": {},
              "i": {
                "df": 0,
                "docs": {},
                "n": {
                  "df": 0,
                  "docs": {},
                  "v": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "df": 0,
                      "docs": {},
                      "n": {
                        "df": 0,
                        "docs": {},
                        "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                      },
                    },
                  },
                },
              },
              "m": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "v": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "p": {
                "df": 0,
                "docs": {},
                "l": {
                  "a": {
                    "c": {
                      "df": 1,
                      "docs": { "0": { "tf": 1.4142135623730951 } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "s": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "c": {
                        "df": 2,
                        "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                      },
                      "df": 0,
                      "docs": {},
                    },
                  },
                },
                "t": { "df": 1, "docs": { "3": { "tf": 1.4142135623730951 } } },
                "u": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 2,
                      "docs": {
                        "0": { "tf": 1.4142135623730951 },
                        "3": { "tf": 1.0 },
                      },
                    },
                  },
                },
              },
              "t": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "n": {
                      "df": 0,
                      "docs": {},
                      "k": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                  },
                },
                "u": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "df": 0,
                    "docs": {},
                    "n": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "o": {
                "df": 0,
                "docs": {},
                "m": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "n": {
                "(": {
                  '"': {
                    "df": 0,
                    "docs": {},
                    "l": {
                      "df": 2,
                      "docs": { "2": { "tf": 1.0 }, "3": { "tf": 1.0 } },
                    },
                  },
                  ".": {
                    ".": {
                      ".": {
                        "[": {
                          '"': {
                            "df": 0,
                            "docs": {},
                            "l": {
                              "df": 1,
                              "docs": { "3": { "tf": 1.4142135623730951 } },
                            },
                          },
                          "df": 0,
                          "docs": {},
                        },
                        "c": {
                          "df": 0,
                          "docs": {},
                          "m": {
                            "d": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                            "df": 0,
                            "docs": {},
                          },
                        },
                        "df": 0,
                        "docs": {},
                      },
                      "df": 0,
                      "docs": {},
                    },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
                "df": 3,
                "docs": {
                  "0": { "tf": 1.0 },
                  "2": { "tf": 1.0 },
                  "3": { "tf": 1.4142135623730951 },
                },
              },
            },
          },
          "s": {
            "a": {
              "df": 0,
              "docs": {},
              "f": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "m": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "0": { "tf": 2.0 } } },
              },
            },
            "c": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "p": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 1,
                      "docs": { "0": { "tf": 2.23606797749979 } },
                    },
                  },
                },
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "c": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "d": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                    "df": 0,
                    "docs": {},
                  },
                },
                "t": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "o": {
                      "df": 0,
                      "docs": {},
                      "n": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                    },
                  },
                },
                "u": {
                  "df": 0,
                  "docs": {},
                  "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "b": {
                      "df": 0,
                      "docs": {},
                      "l": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "h": {
              "df": 0,
              "docs": {},
              "e": {
                "df": 0,
                "docs": {},
                "l": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 1,
                    "docs": { "0": { "tf": 1.7320508075688772 } },
                  },
                },
              },
            },
            "i": {
              "df": 0,
              "docs": {},
              "g": {
                "df": 0,
                "docs": {},
                "n": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 0,
                      "docs": {},
                      "u": {
                        "df": 0,
                        "docs": {},
                        "r": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "m": {
                "df": 0,
                "docs": {},
                "p": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 1,
                    "docs": { "0": { "tf": 1.4142135623730951 } },
                    "e": {
                      "df": 0,
                      "docs": {},
                      "r": {
                        "df": 2,
                        "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                      },
                      "s": {
                        "df": 0,
                        "docs": {},
                        "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                      },
                    },
                    "i": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "u": {
                "df": 0,
                "docs": {},
                "r": {
                  "c": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "p": {
              "a": {
                "df": 0,
                "docs": {},
                "w": {
                  "df": 0,
                  "docs": {},
                  "n": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                },
              },
              "df": 0,
              "docs": {},
              "e": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "f": {
                      "df": 1,
                      "docs": { "3": { "tf": 1.0 } },
                      "i": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "a": {
                    "d": {
                      "df": 1,
                      "docs": { "3": { "tf": 1.4142135623730951 } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "t": {
              "a": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "d": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 2,
                      "docs": {
                        "1": { "tf": 1.4142135623730951 },
                        "2": { "tf": 1.7320508075688772 },
                      },
                    },
                  },
                },
              },
              "df": 0,
              "docs": {},
              "e": {
                "df": 0,
                "docs": {},
                "l": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
                "p": { "df": 1, "docs": { "0": { "tf": 1.4142135623730951 } } },
              },
              "i": {
                "df": 0,
                "docs": {},
                "l": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 2,
                    "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                  },
                },
              },
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "m": {
                      "df": 3,
                      "docs": {
                        "0": { "tf": 1.0 },
                        "1": { "tf": 1.0 },
                        "2": { "tf": 1.0 },
                      },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
                "i": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "df": 0,
                    "docs": {},
                    "g": {
                      "df": 1,
                      "docs": { "3": { "tf": 1.7320508075688772 } },
                      "|": {
                        "df": 0,
                        "docs": {},
                        "u": {
                          "df": 0,
                          "docs": {},
                          "r": {
                            "df": 0,
                            "docs": {},
                            "l": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "p": {
                "df": 0,
                "docs": {},
                "p": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 0,
                      "docs": {},
                      "t": {
                        "df": 2,
                        "docs": {
                          "0": { "tf": 1.4142135623730951 },
                          "1": { "tf": 1.0 },
                        },
                      },
                    },
                  },
                },
              },
              "r": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              },
            },
            "y": {
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "t": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "x": {
                      "df": 1,
                      "docs": { "0": { "tf": 1.4142135623730951 } },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
          },
          "t": {
            "a": {
              "df": 0,
              "docs": {},
              "k": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 2,
                  "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                },
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "a": {
                "df": 0,
                "docs": {},
                "m": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "s": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "s": {
                "df": 0,
                "docs": {},
                "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "x": {
                "df": 0,
                "docs": {},
                "t": {
                  "d": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "c": {
                        "df": 0,
                        "docs": {},
                        "o": {
                          "d": {
                            "df": 0,
                            "docs": {},
                            "e": {
                              "df": 0,
                              "docs": {},
                              "r": {
                                "(": {
                                  ")": {
                                    ".": {
                                      "d": {
                                        "df": 0,
                                        "docs": {},
                                        "e": {
                                          "c": {
                                            "df": 0,
                                            "docs": {},
                                            "o": {
                                              "d": {
                                                "df": 0,
                                                "docs": {},
                                                "e": {
                                                  "(": {
                                                    "df": 0,
                                                    "docs": {},
                                                    "o": {
                                                      "df": 0,
                                                      "docs": {},
                                                      "u": {
                                                        "df": 0,
                                                        "docs": {},
                                                        "t": {
                                                          "df": 0,
                                                          "docs": {},
                                                          "p": {
                                                            "df": 0,
                                                            "docs": {},
                                                            "u": {
                                                              "df": 0,
                                                              "docs": {},
                                                              "t": {
                                                                ".": {
                                                                  "df": 0,
                                                                  "docs": {},
                                                                  "s": {
                                                                    "df": 0,
                                                                    "docs": {},
                                                                    "t": {
                                                                      "d": {
                                                                        "df": 0,
                                                                        "docs":
                                                                          {},
                                                                        "o": {
                                                                          "df":
                                                                            0,
                                                                          "docs":
                                                                            {},
                                                                          "u": {
                                                                            "df":
                                                                              0,
                                                                            "docs":
                                                                              {},
                                                                            "t":
                                                                              {
                                                                                "df":
                                                                                  1,
                                                                                "docs":
                                                                                  {
                                                                                    "1":
                                                                                      {
                                                                                        "tf":
                                                                                          1.0,
                                                                                      },
                                                                                  },
                                                                              },
                                                                          },
                                                                        },
                                                                      },
                                                                      "df": 0,
                                                                      "docs":
                                                                        {},
                                                                    },
                                                                  },
                                                                },
                                                                "df": 0,
                                                                "docs": {},
                                                              },
                                                            },
                                                          },
                                                        },
                                                      },
                                                    },
                                                  },
                                                  "df": 0,
                                                  "docs": {},
                                                },
                                              },
                                              "df": 0,
                                              "docs": {},
                                            },
                                          },
                                          "df": 0,
                                          "docs": {},
                                        },
                                      },
                                      "df": 0,
                                      "docs": {},
                                    },
                                    "df": 0,
                                    "docs": {},
                                  },
                                  "df": 0,
                                  "docs": {},
                                },
                                "df": 0,
                                "docs": {},
                                "s": {
                                  "df": 0,
                                  "docs": {},
                                  "t": {
                                    "df": 0,
                                    "docs": {},
                                    "r": {
                                      "df": 0,
                                      "docs": {},
                                      "e": {
                                        "a": {
                                          "df": 0,
                                          "docs": {},
                                          "m": {
                                            "df": 1,
                                            "docs": { "1": { "tf": 1.0 } },
                                          },
                                        },
                                        "df": 0,
                                        "docs": {},
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          "df": 0,
                          "docs": {},
                        },
                      },
                      "df": 0,
                      "docs": {},
                    },
                  },
                  "df": 3,
                  "docs": {
                    "0": { "tf": 1.0 },
                    "1": { "tf": 1.4142135623730951 },
                    "2": { "tf": 1.4142135623730951 },
                  },
                  "l": {
                    "df": 0,
                    "docs": {},
                    "i": {
                      "df": 0,
                      "docs": {},
                      "n": {
                        "df": 0,
                        "docs": {},
                        "e": {
                          "df": 0,
                          "docs": {},
                          "s": {
                            "df": 0,
                            "docs": {},
                            "t": {
                              "df": 0,
                              "docs": {},
                              "r": {
                                "df": 0,
                                "docs": {},
                                "e": {
                                  "a": {
                                    "df": 0,
                                    "docs": {},
                                    "m": {
                                      "df": 1,
                                      "docs": { "1": { "tf": 1.0 } },
                                    },
                                  },
                                  "df": 0,
                                  "docs": {},
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "h": {
              "df": 0,
              "docs": {},
              "i": {
                "df": 0,
                "docs": {},
                "n": {
                  "df": 0,
                  "docs": {},
                  "g": {
                    "df": 2,
                    "docs": { "0": { "tf": 2.0 }, "3": { "tf": 1.0 } },
                  },
                  "k": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "o": {
                "df": 0,
                "docs": {},
                "u": {
                  "df": 0,
                  "docs": {},
                  "g": {
                    "df": 0,
                    "docs": {},
                    "h": {
                      "df": 2,
                      "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                    },
                  },
                },
              },
            },
            "r": {
              "df": 0,
              "docs": {},
              "i": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "k": {
                    "df": 0,
                    "docs": {},
                    "i": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                  },
                },
                "df": 0,
                "docs": {},
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "p": {
                "df": 0,
                "docs": {},
                "l": { "df": 1, "docs": { "3": { "tf": 2.23606797749979 } } },
              },
            },
            "y": {
              "df": 0,
              "docs": {},
              "p": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 2,
                  "docs": {
                    "0": { "tf": 1.0 },
                    "3": { "tf": 2.8284271247461903 },
                  },
                  "s": {
                    "c": {
                      "df": 0,
                      "docs": {},
                      "r": {
                        "df": 0,
                        "docs": {},
                        "i": {
                          "df": 0,
                          "docs": {},
                          "p": {
                            "df": 0,
                            "docs": {},
                            "t": {
                              "df": 2,
                              "docs": {
                                "0": { "tf": 1.0 },
                                "3": { "tf": 2.0 },
                              },
                            },
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
          },
          "u": {
            "df": 0,
            "docs": {},
            "n": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "l": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                },
              },
            },
            "p": {
              "df": 2,
              "docs": { "0": { "tf": 1.0 }, "3": { "tf": 1.0 } },
            },
            "s": {
              "df": 4,
              "docs": {
                "0": { "tf": 2.0 },
                "1": { "tf": 1.7320508075688772 },
                "2": { "tf": 1.0 },
                "3": { "tf": 1.0 },
              },
            },
          },
          "v": {
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "o": {
                      "df": 0,
                      "docs": {},
                      "n": {
                        "df": 2,
                        "docs": { "2": { "tf": 1.0 }, "3": { "tf": 1.0 } },
                      },
                    },
                  },
                },
              },
            },
          },
          "w": {
            "a": {
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
              },
              "y": {
                "df": 3,
                "docs": {
                  "0": { "tf": 1.4142135623730951 },
                  "1": { "tf": 1.4142135623730951 },
                  "2": { "tf": 1.0 },
                },
              },
            },
            "df": 0,
            "docs": {},
            "i": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "h": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "t": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "u": {
                      "df": 0,
                      "docs": {},
                      "t": {
                        "df": 1,
                        "docs": { "0": { "tf": 1.4142135623730951 } },
                      },
                    },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "k": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
            },
          },
          "z": {
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "o": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              },
            },
          },
        },
      },
      "breadcrumbs": {
        "root": {
          "1": { "df": 2, "docs": { "1": { "tf": 1.0 }, "2": { "tf": 1.0 } } },
          "2": {
            "0": {
              "2": {
                "3": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
              "df": 0,
              "docs": {},
            },
            "df": 2,
            "docs": { "1": { "tf": 1.0 }, "2": { "tf": 1.0 } },
          },
          "a": {
            "c": {
              "c": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "s": {
                    "df": 0,
                    "docs": {},
                    "s": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                  },
                },
              },
              "df": 0,
              "docs": {},
            },
            "d": {
              "d": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "s": {
                      "df": 0,
                      "docs": {},
                      "s": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    },
                  },
                },
              },
              "df": 0,
              "docs": {},
            },
            "df": 0,
            "docs": {},
            "h": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
            "l": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "a": {
                    "d": {
                      "df": 0,
                      "docs": {},
                      "i": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "n": {
              "df": 0,
              "docs": {},
              "o": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "h": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
            },
            "p": {
              "df": 0,
              "docs": {},
              "i": { "df": 1, "docs": { "0": { "tf": 1.4142135623730951 } } },
              "p": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "a": {
                      "c": {
                        "df": 0,
                        "docs": {},
                        "h": {
                          "df": 2,
                          "docs": { "1": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                        },
                      },
                      "df": 0,
                      "docs": {},
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "r": {
              "df": 0,
              "docs": {},
              "g": {
                "df": 1,
                "docs": { "1": { "tf": 1.4142135623730951 } },
                "u": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "df": 0,
                      "docs": {},
                      "n": {
                        "df": 0,
                        "docs": {},
                        "t": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      },
                    },
                  },
                },
              },
              "o": {
                "df": 0,
                "docs": {},
                "u": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "d": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
              "r": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "y": {
                    "df": 2,
                    "docs": { "0": { "tf": 1.0 }, "3": { "tf": 1.0 } },
                  },
                },
                "df": 0,
                "docs": {},
              },
            },
            "s": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "u": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "df": 1,
                    "docs": { "3": { "tf": 1.4142135623730951 } },
                  },
                },
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "t": {
                        "df": 2,
                        "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "w": {
              "a": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 2,
                    "docs": {
                      "1": { "tf": 1.4142135623730951 },
                      "2": { "tf": 1.4142135623730951 },
                    },
                  },
                },
              },
              "df": 0,
              "docs": {},
            },
          },
          "b": {
            "a": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 2,
                  "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                },
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "c": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "m": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 2,
                      "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                    },
                  },
                },
                "w": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "df": 0,
                      "docs": {},
                      "n": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "i": {
                "df": 0,
                "docs": {},
                "l": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 0,
                      "docs": {},
                      "p": {
                        "df": 0,
                        "docs": {},
                        "l": {
                          "df": 2,
                          "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                        },
                      },
                    },
                  },
                },
              },
              "x": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
            },
            "r": {
              "df": 0,
              "docs": {},
              "e": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 0,
                    "docs": {},
                    "h": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                  },
                },
                "df": 0,
                "docs": {},
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "i": {
                "df": 0,
                "docs": {},
                "l": {
                  "d": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "y": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              },
            },
          },
          "c": {
            "a": {
              "df": 0,
              "docs": {},
              "p": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 2,
                      "docs": { "1": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                    },
                  },
                },
              },
            },
            "df": 0,
            "docs": {},
            "h": {
              "df": 0,
              "docs": {},
              "e": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "k": {
                    "df": 1,
                    "docs": { "0": { "tf": 1.4142135623730951 } },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "i": {
                "df": 0,
                "docs": {},
                "l": {
                  "d": {
                    "df": 2,
                    "docs": {
                      "0": { "tf": 1.0 },
                      "1": { "tf": 1.4142135623730951 },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "o": {
                "df": 0,
                "docs": {},
                "i": {
                  "c": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "l": {
              "df": 0,
              "docs": {},
              "e": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "df": 1,
                    "docs": { "0": { "tf": 1.0 } },
                    "e": {
                      "df": 0,
                      "docs": {},
                      "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                    "u": {
                      "df": 0,
                      "docs": {},
                      "p": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "o": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 2,
                    "docs": {
                      "0": { "tf": 1.4142135623730951 },
                      "1": { "tf": 1.0 },
                    },
                  },
                },
              },
            },
            "m": {
              "d": {
                ".": {
                  "df": 0,
                  "docs": {},
                  "p": {
                    "df": 0,
                    "docs": {},
                    "u": {
                      "df": 0,
                      "docs": {},
                      "s": {
                        "df": 0,
                        "docs": {},
                        "h": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      },
                    },
                  },
                },
                "df": 1,
                "docs": { "3": { "tf": 2.23606797749979 } },
              },
              "df": 0,
              "docs": {},
            },
            "o": {
              "d": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 2,
                  "docs": {
                    "0": { "tf": 1.4142135623730951 },
                    "2": { "tf": 1.0 },
                  },
                },
              },
              "df": 0,
              "docs": {},
              "m": {
                "df": 0,
                "docs": {},
                "m": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "n": {
                      "d": {
                        "df": 3,
                        "docs": {
                          "0": { "tf": 1.0 },
                          "1": { "tf": 1.4142135623730951 },
                          "3": { "tf": 1.0 },
                        },
                      },
                      "df": 0,
                      "docs": {},
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
                "p": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "r": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                    "t": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  },
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "df": 0,
                      "docs": {},
                      "x": {
                        "df": 1,
                        "docs": { "0": { "tf": 1.4142135623730951 } },
                      },
                    },
                  },
                },
              },
              "n": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "l": {
                      "df": 0,
                      "docs": {},
                      "e": {
                        ".": {
                          "df": 0,
                          "docs": {},
                          "l": {
                            "df": 0,
                            "docs": {},
                            "o": {
                              "df": 0,
                              "docs": {},
                              "g": {
                                "(": {
                                  "a": {
                                    "df": 0,
                                    "docs": {},
                                    "w": {
                                      "a": {
                                        "df": 0,
                                        "docs": {},
                                        "i": {
                                          "df": 0,
                                          "docs": {},
                                          "t": {
                                            "df": 1,
                                            "docs": { "2": { "tf": 1.0 } },
                                          },
                                        },
                                      },
                                      "df": 0,
                                      "docs": {},
                                    },
                                  },
                                  "df": 0,
                                  "docs": {},
                                  "l": {
                                    "df": 0,
                                    "docs": {},
                                    "i": {
                                      "df": 0,
                                      "docs": {},
                                      "n": {
                                        "df": 2,
                                        "docs": {
                                          "1": { "tf": 1.0 },
                                          "2": { "tf": 1.0 },
                                        },
                                      },
                                    },
                                  },
                                  "n": {
                                    "df": 0,
                                    "docs": {},
                                    "e": {
                                      "df": 0,
                                      "docs": {},
                                      "w": {
                                        "df": 1,
                                        "docs": { "1": { "tf": 1.0 } },
                                      },
                                    },
                                  },
                                },
                                "df": 0,
                                "docs": {},
                              },
                            },
                          },
                        },
                        "df": 0,
                        "docs": {},
                      },
                    },
                  },
                  "t": {
                    "df": 3,
                    "docs": {
                      "1": { "tf": 1.4142135623730951 },
                      "2": { "tf": 1.0 },
                      "3": { "tf": 1.0 },
                    },
                  },
                },
                "t": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "df": 0,
                    "docs": {},
                    "o": {
                      "df": 0,
                      "docs": {},
                      "l": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                  },
                },
                "v": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 0,
                      "docs": {},
                      "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                    },
                  },
                },
              },
            },
          },
          "d": {
            "a": {
              "df": 0,
              "docs": {},
              "y": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
            },
            "df": 0,
            "docs": {},
            "e": {
              "a": {
                "d": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
              "c": {
                "df": 0,
                "docs": {},
                "o": {
                  "d": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                  "df": 0,
                  "docs": {},
                },
              },
              "df": 0,
              "docs": {},
              "f": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "l": {
                      "df": 0,
                      "docs": {},
                      "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "n": {
                "df": 0,
                "docs": {},
                "o": {
                  ".": {
                    "c": {
                      "df": 0,
                      "docs": {},
                      "o": {
                        "df": 0,
                        "docs": {},
                        "m": {
                          "df": 0,
                          "docs": {},
                          "m": {
                            "a": {
                              "df": 0,
                              "docs": {},
                              "n": {
                                "d": {
                                  "(": {
                                    '"': {
                                      "df": 0,
                                      "docs": {},
                                      "l": {
                                        "df": 1,
                                        "docs": {
                                          "1": { "tf": 1.4142135623730951 },
                                        },
                                      },
                                    },
                                    "df": 0,
                                    "docs": {},
                                  },
                                  "df": 2,
                                  "docs": {
                                    "0": { "tf": 2.23606797749979 },
                                    "1": { "tf": 2.23606797749979 },
                                  },
                                },
                                "df": 0,
                                "docs": {},
                              },
                            },
                            "df": 0,
                            "docs": {},
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 0,
                      "docs": {},
                      "u": {
                        "df": 0,
                        "docs": {},
                        "n": {
                          "df": 2,
                          "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                        },
                      },
                    },
                  },
                  "df": 2,
                  "docs": {
                    "0": { "tf": 1.4142135623730951 },
                    "1": { "tf": 1.0 },
                  },
                },
              },
              "p": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "c": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "i": {
              "d": {
                "df": 0,
                "docs": {},
                "n": {
                  "'": {
                    "df": 0,
                    "docs": {},
                    "t": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "df": 0,
              "docs": {},
              "f": {
                "df": 0,
                "docs": {},
                "f": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 2,
                      "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                    },
                  },
                },
              },
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "c": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 0,
                      "docs": {},
                      "l": {
                        "df": 0,
                        "docs": {},
                        "i": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                      },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "o": { "df": 1, "docs": { "0": { "tf": 1.4142135623730951 } } },
          },
          "df": 0,
          "docs": {},
          "e": {
            "a": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 2,
                  "docs": {
                    "0": { "tf": 1.0 },
                    "2": { "tf": 1.4142135623730951 },
                  },
                },
              },
            },
            "df": 0,
            "docs": {},
            "q": {
              "df": 0,
              "docs": {},
              "u": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "v": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "l": {
                        "df": 3,
                        "docs": {
                          "0": { "tf": 1.0 },
                          "1": { "tf": 1.0 },
                          "2": { "tf": 1.7320508075688772 },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "r": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "df": 3,
                    "docs": {
                      "0": { "tf": 1.0 },
                      "1": { "tf": 1.0 },
                      "3": { "tf": 1.0 },
                    },
                  },
                },
              },
            },
            "t": {
              "c": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              "df": 0,
              "docs": {},
            },
            "x": {
              "a": {
                "df": 0,
                "docs": {},
                "m": {
                  "df": 0,
                  "docs": {},
                  "p": {
                    "df": 0,
                    "docs": {},
                    "l": {
                      "df": 3,
                      "docs": {
                        "0": { "tf": 1.0 },
                        "1": { "tf": 1.4142135623730951 },
                        "2": { "tf": 2.0 },
                      },
                    },
                  },
                },
              },
              "df": 0,
              "docs": {},
              "e": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 0,
                      "docs": {},
                      "e": {
                        "(": {
                          '"': {
                            "df": 0,
                            "docs": {},
                            "l": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                          },
                          "df": 0,
                          "docs": {},
                        },
                        "df": 0,
                        "docs": {},
                      },
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "i": {
                "df": 0,
                "docs": {},
                "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
              },
              "m": {
                "df": 0,
                "docs": {},
                "p": {
                  "df": 0,
                  "docs": {},
                  "l": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                },
              },
              "p": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "df": 0,
                    "docs": {},
                    "i": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                },
                "l": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "c": {
                      "df": 0,
                      "docs": {},
                      "i": {
                        "df": 0,
                        "docs": {},
                        "t": {
                          "df": 0,
                          "docs": {},
                          "l": {
                            "df": 0,
                            "docs": {},
                            "i": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
              "t": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "df": 0,
                    "docs": {},
                    "s": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                },
              },
            },
          },
          "f": {
            "a": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "o": {
                      "df": 0,
                      "docs": {},
                      "n": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    },
                  },
                },
              },
              "v": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
            },
            "df": 0,
            "docs": {},
            "i": {
              "df": 0,
              "docs": {},
              "g": {
                "df": 0,
                "docs": {},
                "u": {
                  "df": 0,
                  "docs": {},
                  "r": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                },
              },
              "l": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              },
              "n": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              },
              "r": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                },
              },
              "x": { "df": 1, "docs": { "3": { "tf": 1.4142135623730951 } } },
            },
            "o": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "w": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "d": {
                        "df": 2,
                        "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                      },
                      "df": 0,
                      "docs": {},
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "l": {
                "df": 0,
                "docs": {},
                "l": {
                  "df": 1,
                  "docs": { "0": { "tf": 1.0 } },
                  "i": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                },
              },
            },
          },
          "g": {
            "df": 0,
            "docs": {},
            "i": {
              "a": {
                "df": 0,
                "docs": {},
                "n": {
                  "df": 0,
                  "docs": {},
                  "t": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                },
              },
              "df": 0,
              "docs": {},
              "v": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 2,
                  "docs": {
                    "0": { "tf": 1.4142135623730951 },
                    "3": { "tf": 1.0 },
                  },
                },
              },
            },
            "o": {
              "a": {
                "df": 0,
                "docs": {},
                "l": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "df": 0,
              "docs": {},
              "o": {
                "d": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
            },
            "r": {
              "df": 0,
              "docs": {},
              "e": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
                "df": 0,
                "docs": {},
              },
            },
            "u": {
              "a": {
                "df": 0,
                "docs": {},
                "r": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "n": {
                      "df": 0,
                      "docs": {},
                      "t": {
                        "df": 0,
                        "docs": {},
                        "e": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "df": 0,
              "docs": {},
            },
          },
          "h": {
            "a": {
              "df": 0,
              "docs": {},
              "n": {
                "d": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 1,
                    "docs": { "1": { "tf": 1.4142135623730951 } },
                  },
                },
                "df": 0,
                "docs": {},
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 4,
                  "docs": {
                    "0": { "tf": 1.0 },
                    "1": { "tf": 1.0 },
                    "2": { "tf": 1.0 },
                    "3": { "tf": 1.4142135623730951 },
                  },
                },
              },
            },
          },
          "i": {
            "d": {
              "df": 0,
              "docs": {},
              "e": {
                "a": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
              "i": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "t": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "df": 0,
            "docs": {},
            "m": {
              "df": 0,
              "docs": {},
              "p": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "v": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                },
              },
            },
            "n": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "t": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "l": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                  "df": 0,
                  "docs": {},
                  "e": {
                    "a": {
                      "d": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      "df": 0,
                      "docs": {},
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
              "t": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "df": 0,
                    "docs": {},
                    "f": {
                      "a": {
                        "c": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                        "df": 0,
                        "docs": {},
                      },
                      "df": 0,
                      "docs": {},
                    },
                  },
                },
                "r": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "d": {
                      "df": 0,
                      "docs": {},
                      "u": {
                        "c": {
                          "df": 1,
                          "docs": { "0": { "tf": 1.0 } },
                          "t": {
                            "df": 3,
                            "docs": {
                              "0": { "tf": 1.7320508075688772 },
                              "1": { "tf": 1.0 },
                              "2": { "tf": 1.0 },
                            },
                          },
                        },
                        "df": 0,
                        "docs": {},
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "s": {
              "df": 0,
              "docs": {},
              "n": {
                "'": {
                  "df": 0,
                  "docs": {},
                  "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
                "df": 0,
                "docs": {},
              },
              "s": {
                "df": 0,
                "docs": {},
                "u": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              },
            },
          },
          "k": {
            "df": 0,
            "docs": {},
            "i": {
              "df": 0,
              "docs": {},
              "n": {
                "d": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
            },
          },
          "l": {
            "a": {
              '"': {
                ")": {
                  ".": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "s": {
                        "df": 0,
                        "docs": {},
                        "s": {
                          "df": 0,
                          "docs": {},
                          "t": {
                            "df": 0,
                            "docs": {},
                            "r": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
                "df": 0,
                "docs": {},
              },
              "df": 3,
              "docs": {
                "1": { "tf": 1.7320508075688772 },
                "2": { "tf": 1.4142135623730951 },
                "3": { "tf": 2.23606797749979 },
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "a": {
                "df": 0,
                "docs": {},
                "k": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                "p": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              },
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "g": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 0,
                    "docs": {},
                    "h": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  },
                },
              },
            },
            "i": {
              "df": 0,
              "docs": {},
              "g": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 0,
                    "docs": {},
                    "w": {
                      "df": 0,
                      "docs": {},
                      "e": {
                        "df": 0,
                        "docs": {},
                        "i": {
                          "df": 0,
                          "docs": {},
                          "g": {
                            "df": 0,
                            "docs": {},
                            "h": {
                              "df": 0,
                              "docs": {},
                              "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              "n": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 3,
                  "docs": {
                    "0": { "tf": 1.0 },
                    "1": { "tf": 1.4142135623730951 },
                    "2": { "tf": 1.4142135623730951 },
                  },
                  "s": {
                    "(": {
                      "df": 0,
                      "docs": {},
                      "r": {
                        "df": 0,
                        "docs": {},
                        "u": {
                          "df": 0,
                          "docs": {},
                          "n": {
                            "(": {
                              '"': {
                                "df": 0,
                                "docs": {},
                                "l": {
                                  "df": 1,
                                  "docs": { "2": { "tf": 1.0 } },
                                },
                              },
                              "df": 0,
                              "docs": {},
                            },
                            "df": 0,
                            "docs": {},
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
              "s": {
                "df": 0,
                "docs": {},
                "t": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              },
              "t": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "l": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "g": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  },
                },
              },
              "o": {
                "df": 0,
                "docs": {},
                "k": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              },
              "t": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
            },
            "s": {
              "df": 3,
              "docs": {
                "1": { "tf": 1.4142135623730951 },
                "2": { "tf": 1.0 },
                "3": { "tf": 1.4142135623730951 },
              },
            },
          },
          "m": {
            "a": {
              "df": 0,
              "docs": {},
              "j": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "k": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "0": { "tf": 1.7320508075688772 } } },
              },
              "n": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "g": {
                    "df": 1,
                    "docs": { "0": { "tf": 1.4142135623730951 } },
                  },
                },
                "df": 0,
                "docs": {},
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "d": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "i": {
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "df": 2,
                    "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "m": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "df": 0,
                    "docs": {},
                    "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                  },
                },
              },
              "r": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
            },
            "u": {
              "c": {
                "df": 0,
                "docs": {},
                "h": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "df": 0,
              "docs": {},
              "l": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "p": {
                      "df": 0,
                      "docs": {},
                      "l": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                    },
                  },
                },
              },
            },
          },
          "n": {
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "e": {
                "d": {
                  "df": 2,
                  "docs": { "0": { "tf": 1.0 }, "3": { "tf": 1.0 } },
                },
                "df": 0,
                "docs": {},
              },
              "w": {
                "df": 2,
                "docs": {
                  "0": { "tf": 1.0 },
                  "1": { "tf": 1.7320508075688772 },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "n": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              "t": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "w": {
                "df": 2,
                "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
              },
            },
          },
          "o": {
            "b": {
              "df": 0,
              "docs": {},
              "v": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "u": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                },
              },
            },
            "df": 0,
            "docs": {},
            "l": {
              "d": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              "df": 0,
              "docs": {},
            },
            "n": {
              "c": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
              "df": 2,
              "docs": { "0": { "tf": 1.4142135623730951 }, "3": { "tf": 1.0 } },
            },
            "p": {
              "df": 0,
              "docs": {},
              "e": {
                "df": 0,
                "docs": {},
                "r": { "df": 1, "docs": { "3": { "tf": 1.7320508075688772 } } },
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 2,
                "docs": { "0": { "tf": 1.0 }, "3": { "tf": 1.0 } },
                "p": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 2,
                      "docs": {
                        "0": { "tf": 1.4142135623730951 },
                        "1": { "tf": 2.0 },
                      },
                    },
                  },
                },
              },
            },
          },
          "p": {
            "a": {
              "c": {
                "df": 0,
                "docs": {},
                "k": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "g": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "df": 0,
              "docs": {},
              "r": {
                "a": {
                  "df": 0,
                  "docs": {},
                  "m": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "df": 0,
                      "docs": {},
                      "t": {
                        "df": 1,
                        "docs": { "3": { "tf": 1.4142135623730951 } },
                      },
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "s": {
                "df": 0,
                "docs": {},
                "s": { "df": 1, "docs": { "3": { "tf": 1.4142135623730951 } } },
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "f": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 0,
                      "docs": {},
                      "m": {
                        "df": 1,
                        "docs": { "0": { "tf": 1.4142135623730951 } },
                      },
                    },
                  },
                },
              },
            },
            "i": {
              "df": 0,
              "docs": {},
              "e": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "m": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "p": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 2,
                  "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                  "t": {
                    "df": 0,
                    "docs": {},
                    "h": {
                      "df": 0,
                      "docs": {},
                      "r": {
                        "df": 0,
                        "docs": {},
                        "o": {
                          "df": 0,
                          "docs": {},
                          "u": {
                            "df": 0,
                            "docs": {},
                            "g": {
                              "df": 0,
                              "docs": {},
                              "h": {
                                "(": {
                                  "df": 0,
                                  "docs": {},
                                  "n": {
                                    "df": 0,
                                    "docs": {},
                                    "e": {
                                      "df": 0,
                                      "docs": {},
                                      "w": {
                                        "df": 1,
                                        "docs": {
                                          "1": { "tf": 1.4142135623730951 },
                                        },
                                      },
                                    },
                                  },
                                },
                                "df": 0,
                                "docs": {},
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "b": {
                      "df": 0,
                      "docs": {},
                      "l": {
                        "df": 1,
                        "docs": { "0": { "tf": 1.4142135623730951 } },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "r": {
              "a": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 0,
                    "docs": {},
                    "i": {
                      "c": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      "df": 0,
                      "docs": {},
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "df": 0,
              "docs": {},
              "e": {
                "df": 0,
                "docs": {},
                "t": {
                  "df": 0,
                  "docs": {},
                  "t": {
                    "df": 0,
                    "docs": {},
                    "i": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  },
                },
                "v": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "o": {
                      "df": 0,
                      "docs": {},
                      "u": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                    },
                  },
                },
              },
              "o": {
                "c": {
                  "df": 2,
                  "docs": {
                    "0": { "tf": 2.449489742783178 },
                    "2": { "tf": 2.23606797749979 },
                  },
                  "e": {
                    "df": 0,
                    "docs": {},
                    "s": {
                      "df": 0,
                      "docs": {},
                      "s": {
                        "df": 3,
                        "docs": {
                          "0": { "tf": 2.0 },
                          "1": { "tf": 1.7320508075688772 },
                          "2": { "tf": 1.4142135623730951 },
                        },
                      },
                    },
                  },
                },
                "d": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "c": {
                      "df": 0,
                      "docs": {},
                      "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
                "df": 0,
                "docs": {},
                "g": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "m": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
          },
          "r": {
            "df": 0,
            "docs": {},
            "e": {
              "a": {
                "d": {
                  "df": 0,
                  "docs": {},
                  "e": {
                    "df": 0,
                    "docs": {},
                    "r": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                  },
                },
                "df": 0,
                "docs": {},
                "l": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 0,
                    "docs": {},
                    "i": {
                      "df": 3,
                      "docs": {
                        "0": { "tf": 1.0 },
                        "1": { "tf": 1.0 },
                        "2": { "tf": 1.0 },
                      },
                    },
                  },
                },
              },
              "df": 0,
              "docs": {},
              "i": {
                "df": 0,
                "docs": {},
                "n": {
                  "df": 0,
                  "docs": {},
                  "v": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "df": 0,
                      "docs": {},
                      "n": {
                        "df": 0,
                        "docs": {},
                        "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                      },
                    },
                  },
                },
              },
              "m": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "v": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "p": {
                "df": 0,
                "docs": {},
                "l": {
                  "a": {
                    "c": {
                      "df": 1,
                      "docs": { "0": { "tf": 1.4142135623730951 } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "s": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "c": {
                        "df": 2,
                        "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                      },
                      "df": 0,
                      "docs": {},
                    },
                  },
                },
                "t": { "df": 1, "docs": { "3": { "tf": 1.4142135623730951 } } },
                "u": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 2,
                      "docs": {
                        "0": { "tf": 1.4142135623730951 },
                        "3": { "tf": 1.0 },
                      },
                    },
                  },
                },
              },
              "t": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "n": {
                      "df": 0,
                      "docs": {},
                      "k": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                  },
                },
                "u": {
                  "df": 0,
                  "docs": {},
                  "r": {
                    "df": 0,
                    "docs": {},
                    "n": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "o": {
                "df": 0,
                "docs": {},
                "m": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "n": {
                "(": {
                  '"': {
                    "df": 0,
                    "docs": {},
                    "l": {
                      "df": 2,
                      "docs": { "2": { "tf": 1.0 }, "3": { "tf": 1.0 } },
                    },
                  },
                  ".": {
                    ".": {
                      ".": {
                        "[": {
                          '"': {
                            "df": 0,
                            "docs": {},
                            "l": {
                              "df": 1,
                              "docs": { "3": { "tf": 1.4142135623730951 } },
                            },
                          },
                          "df": 0,
                          "docs": {},
                        },
                        "c": {
                          "df": 0,
                          "docs": {},
                          "m": {
                            "d": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                            "df": 0,
                            "docs": {},
                          },
                        },
                        "df": 0,
                        "docs": {},
                      },
                      "df": 0,
                      "docs": {},
                    },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
                "df": 3,
                "docs": {
                  "0": { "tf": 1.0 },
                  "2": { "tf": 1.0 },
                  "3": { "tf": 2.0 },
                },
              },
            },
          },
          "s": {
            "a": {
              "df": 0,
              "docs": {},
              "f": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 0,
                  "docs": {},
                  "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "m": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "0": { "tf": 2.0 } } },
              },
            },
            "c": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "p": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 1,
                      "docs": { "0": { "tf": 2.23606797749979 } },
                    },
                  },
                },
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "c": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "d": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                    "df": 0,
                    "docs": {},
                  },
                },
                "t": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "o": {
                      "df": 0,
                      "docs": {},
                      "n": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                    },
                  },
                },
                "u": {
                  "df": 0,
                  "docs": {},
                  "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "b": {
                      "df": 0,
                      "docs": {},
                      "l": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
            "h": {
              "df": 0,
              "docs": {},
              "e": {
                "df": 0,
                "docs": {},
                "l": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 1,
                    "docs": { "0": { "tf": 1.7320508075688772 } },
                  },
                },
              },
            },
            "i": {
              "df": 0,
              "docs": {},
              "g": {
                "df": 0,
                "docs": {},
                "n": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 0,
                      "docs": {},
                      "u": {
                        "df": 0,
                        "docs": {},
                        "r": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                      },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
              "m": {
                "df": 0,
                "docs": {},
                "p": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 1,
                    "docs": { "0": { "tf": 1.4142135623730951 } },
                    "e": {
                      "df": 0,
                      "docs": {},
                      "r": {
                        "df": 2,
                        "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                      },
                      "s": {
                        "df": 0,
                        "docs": {},
                        "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                      },
                    },
                    "i": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "u": {
                "df": 0,
                "docs": {},
                "r": {
                  "c": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "p": {
              "a": {
                "df": 0,
                "docs": {},
                "w": {
                  "df": 0,
                  "docs": {},
                  "n": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                },
              },
              "df": 0,
              "docs": {},
              "e": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "f": {
                      "df": 1,
                      "docs": { "3": { "tf": 1.0 } },
                      "i": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    },
                  },
                },
                "df": 0,
                "docs": {},
              },
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "a": {
                    "d": { "df": 1, "docs": { "3": { "tf": 2.0 } } },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
            "t": {
              "a": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "d": {
                "df": 0,
                "docs": {},
                "o": {
                  "df": 0,
                  "docs": {},
                  "u": {
                    "df": 0,
                    "docs": {},
                    "t": {
                      "df": 2,
                      "docs": {
                        "1": { "tf": 1.4142135623730951 },
                        "2": { "tf": 1.7320508075688772 },
                      },
                    },
                  },
                },
              },
              "df": 0,
              "docs": {},
              "e": {
                "df": 0,
                "docs": {},
                "l": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "a": {
                      "df": 0,
                      "docs": {},
                      "r": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
                "p": { "df": 1, "docs": { "0": { "tf": 1.4142135623730951 } } },
              },
              "i": {
                "df": 0,
                "docs": {},
                "l": {
                  "df": 0,
                  "docs": {},
                  "l": {
                    "df": 2,
                    "docs": { "0": { "tf": 1.0 }, "1": { "tf": 1.0 } },
                  },
                },
              },
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "m": {
                      "df": 3,
                      "docs": {
                        "0": { "tf": 1.0 },
                        "1": { "tf": 1.0 },
                        "2": { "tf": 1.0 },
                      },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
                "i": {
                  "df": 0,
                  "docs": {},
                  "n": {
                    "df": 0,
                    "docs": {},
                    "g": {
                      "df": 1,
                      "docs": { "3": { "tf": 1.7320508075688772 } },
                      "|": {
                        "df": 0,
                        "docs": {},
                        "u": {
                          "df": 0,
                          "docs": {},
                          "r": {
                            "df": 0,
                            "docs": {},
                            "l": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "p": {
                "df": 0,
                "docs": {},
                "p": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "r": {
                      "df": 0,
                      "docs": {},
                      "t": {
                        "df": 2,
                        "docs": {
                          "0": { "tf": 1.4142135623730951 },
                          "1": { "tf": 1.0 },
                        },
                      },
                    },
                  },
                },
              },
              "r": {
                "df": 0,
                "docs": {},
                "e": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              },
            },
            "y": {
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "t": {
                  "a": {
                    "df": 0,
                    "docs": {},
                    "x": {
                      "df": 1,
                      "docs": { "0": { "tf": 1.4142135623730951 } },
                    },
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
          },
          "t": {
            "a": {
              "df": 0,
              "docs": {},
              "k": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 2,
                  "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                },
              },
            },
            "df": 0,
            "docs": {},
            "e": {
              "a": {
                "df": 0,
                "docs": {},
                "m": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "s": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "s": {
                "df": 0,
                "docs": {},
                "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "x": {
                "df": 0,
                "docs": {},
                "t": {
                  "d": {
                    "df": 0,
                    "docs": {},
                    "e": {
                      "c": {
                        "df": 0,
                        "docs": {},
                        "o": {
                          "d": {
                            "df": 0,
                            "docs": {},
                            "e": {
                              "df": 0,
                              "docs": {},
                              "r": {
                                "(": {
                                  ")": {
                                    ".": {
                                      "d": {
                                        "df": 0,
                                        "docs": {},
                                        "e": {
                                          "c": {
                                            "df": 0,
                                            "docs": {},
                                            "o": {
                                              "d": {
                                                "df": 0,
                                                "docs": {},
                                                "e": {
                                                  "(": {
                                                    "df": 0,
                                                    "docs": {},
                                                    "o": {
                                                      "df": 0,
                                                      "docs": {},
                                                      "u": {
                                                        "df": 0,
                                                        "docs": {},
                                                        "t": {
                                                          "df": 0,
                                                          "docs": {},
                                                          "p": {
                                                            "df": 0,
                                                            "docs": {},
                                                            "u": {
                                                              "df": 0,
                                                              "docs": {},
                                                              "t": {
                                                                ".": {
                                                                  "df": 0,
                                                                  "docs": {},
                                                                  "s": {
                                                                    "df": 0,
                                                                    "docs": {},
                                                                    "t": {
                                                                      "d": {
                                                                        "df": 0,
                                                                        "docs":
                                                                          {},
                                                                        "o": {
                                                                          "df":
                                                                            0,
                                                                          "docs":
                                                                            {},
                                                                          "u": {
                                                                            "df":
                                                                              0,
                                                                            "docs":
                                                                              {},
                                                                            "t":
                                                                              {
                                                                                "df":
                                                                                  1,
                                                                                "docs":
                                                                                  {
                                                                                    "1":
                                                                                      {
                                                                                        "tf":
                                                                                          1.0,
                                                                                      },
                                                                                  },
                                                                              },
                                                                          },
                                                                        },
                                                                      },
                                                                      "df": 0,
                                                                      "docs":
                                                                        {},
                                                                    },
                                                                  },
                                                                },
                                                                "df": 0,
                                                                "docs": {},
                                                              },
                                                            },
                                                          },
                                                        },
                                                      },
                                                    },
                                                  },
                                                  "df": 0,
                                                  "docs": {},
                                                },
                                              },
                                              "df": 0,
                                              "docs": {},
                                            },
                                          },
                                          "df": 0,
                                          "docs": {},
                                        },
                                      },
                                      "df": 0,
                                      "docs": {},
                                    },
                                    "df": 0,
                                    "docs": {},
                                  },
                                  "df": 0,
                                  "docs": {},
                                },
                                "df": 0,
                                "docs": {},
                                "s": {
                                  "df": 0,
                                  "docs": {},
                                  "t": {
                                    "df": 0,
                                    "docs": {},
                                    "r": {
                                      "df": 0,
                                      "docs": {},
                                      "e": {
                                        "a": {
                                          "df": 0,
                                          "docs": {},
                                          "m": {
                                            "df": 1,
                                            "docs": { "1": { "tf": 1.0 } },
                                          },
                                        },
                                        "df": 0,
                                        "docs": {},
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          "df": 0,
                          "docs": {},
                        },
                      },
                      "df": 0,
                      "docs": {},
                    },
                  },
                  "df": 3,
                  "docs": {
                    "0": { "tf": 1.0 },
                    "1": { "tf": 1.4142135623730951 },
                    "2": { "tf": 1.4142135623730951 },
                  },
                  "l": {
                    "df": 0,
                    "docs": {},
                    "i": {
                      "df": 0,
                      "docs": {},
                      "n": {
                        "df": 0,
                        "docs": {},
                        "e": {
                          "df": 0,
                          "docs": {},
                          "s": {
                            "df": 0,
                            "docs": {},
                            "t": {
                              "df": 0,
                              "docs": {},
                              "r": {
                                "df": 0,
                                "docs": {},
                                "e": {
                                  "a": {
                                    "df": 0,
                                    "docs": {},
                                    "m": {
                                      "df": 1,
                                      "docs": { "1": { "tf": 1.0 } },
                                    },
                                  },
                                  "df": 0,
                                  "docs": {},
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "h": {
              "df": 0,
              "docs": {},
              "i": {
                "df": 0,
                "docs": {},
                "n": {
                  "df": 0,
                  "docs": {},
                  "g": {
                    "df": 2,
                    "docs": { "0": { "tf": 2.0 }, "3": { "tf": 1.0 } },
                  },
                  "k": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                },
              },
              "o": {
                "df": 0,
                "docs": {},
                "u": {
                  "df": 0,
                  "docs": {},
                  "g": {
                    "df": 0,
                    "docs": {},
                    "h": {
                      "df": 2,
                      "docs": { "0": { "tf": 1.0 }, "2": { "tf": 1.0 } },
                    },
                  },
                },
              },
            },
            "r": {
              "df": 0,
              "docs": {},
              "i": {
                "c": {
                  "df": 0,
                  "docs": {},
                  "k": {
                    "df": 0,
                    "docs": {},
                    "i": { "df": 1, "docs": { "1": { "tf": 1.0 } } },
                  },
                },
                "df": 0,
                "docs": {},
              },
            },
            "u": {
              "df": 0,
              "docs": {},
              "p": {
                "df": 0,
                "docs": {},
                "l": { "df": 1, "docs": { "3": { "tf": 2.23606797749979 } } },
              },
            },
            "y": {
              "df": 0,
              "docs": {},
              "p": {
                "df": 0,
                "docs": {},
                "e": {
                  "df": 2,
                  "docs": {
                    "0": { "tf": 1.0 },
                    "3": { "tf": 2.8284271247461903 },
                  },
                  "s": {
                    "c": {
                      "df": 0,
                      "docs": {},
                      "r": {
                        "df": 0,
                        "docs": {},
                        "i": {
                          "df": 0,
                          "docs": {},
                          "p": {
                            "df": 0,
                            "docs": {},
                            "t": {
                              "df": 2,
                              "docs": {
                                "0": { "tf": 1.0 },
                                "3": { "tf": 2.0 },
                              },
                            },
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
          },
          "u": {
            "df": 0,
            "docs": {},
            "n": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "i": {
                  "df": 0,
                  "docs": {},
                  "l": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                },
              },
            },
            "p": {
              "df": 2,
              "docs": { "0": { "tf": 1.0 }, "3": { "tf": 1.0 } },
            },
            "s": {
              "df": 4,
              "docs": {
                "0": { "tf": 2.0 },
                "1": { "tf": 1.7320508075688772 },
                "2": { "tf": 1.0 },
                "3": { "tf": 1.7320508075688772 },
              },
            },
          },
          "v": {
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "s": {
                  "df": 0,
                  "docs": {},
                  "i": {
                    "df": 0,
                    "docs": {},
                    "o": {
                      "df": 0,
                      "docs": {},
                      "n": {
                        "df": 2,
                        "docs": { "2": { "tf": 1.0 }, "3": { "tf": 1.0 } },
                      },
                    },
                  },
                },
              },
            },
          },
          "w": {
            "a": {
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "t": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
              },
              "y": {
                "df": 3,
                "docs": {
                  "0": { "tf": 1.4142135623730951 },
                  "1": { "tf": 1.7320508075688772 },
                  "2": { "tf": 1.4142135623730951 },
                },
              },
            },
            "df": 0,
            "docs": {},
            "i": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "h": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
              "t": {
                "df": 0,
                "docs": {},
                "h": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "df": 0,
                    "docs": {},
                    "u": {
                      "df": 0,
                      "docs": {},
                      "t": {
                        "df": 1,
                        "docs": { "0": { "tf": 1.4142135623730951 } },
                      },
                    },
                  },
                },
              },
            },
            "o": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "k": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
              },
            },
          },
          "z": {
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "o": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              },
            },
          },
        },
      },
      "title": {
        "root": {
          "d": {
            "df": 0,
            "docs": {},
            "e": {
              "df": 0,
              "docs": {},
              "n": {
                "df": 0,
                "docs": {},
                "o": {
                  ".": {
                    "c": {
                      "df": 0,
                      "docs": {},
                      "o": {
                        "df": 0,
                        "docs": {},
                        "m": {
                          "df": 0,
                          "docs": {},
                          "m": {
                            "a": {
                              "df": 0,
                              "docs": {},
                              "n": {
                                "d": {
                                  "df": 1,
                                  "docs": { "1": { "tf": 1.0 } },
                                },
                                "df": 0,
                                "docs": {},
                              },
                            },
                            "df": 0,
                            "docs": {},
                          },
                        },
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
          },
          "df": 0,
          "docs": {},
          "e": {
            "a": {
              "df": 0,
              "docs": {},
              "s": {
                "df": 0,
                "docs": {},
                "i": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
              },
            },
            "df": 0,
            "docs": {},
          },
          "i": {
            "df": 0,
            "docs": {},
            "n": {
              "df": 0,
              "docs": {},
              "t": {
                "df": 0,
                "docs": {},
                "r": {
                  "df": 0,
                  "docs": {},
                  "o": {
                    "d": {
                      "df": 0,
                      "docs": {},
                      "u": {
                        "c": {
                          "df": 0,
                          "docs": {},
                          "t": { "df": 1, "docs": { "0": { "tf": 1.0 } } },
                        },
                        "df": 0,
                        "docs": {},
                      },
                    },
                    "df": 0,
                    "docs": {},
                  },
                },
              },
            },
          },
          "o": {
            "df": 0,
            "docs": {},
            "p": {
              "df": 0,
              "docs": {},
              "e": {
                "df": 0,
                "docs": {},
                "r": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
              },
            },
          },
          "p": {
            "df": 0,
            "docs": {},
            "r": {
              "df": 0,
              "docs": {},
              "o": {
                "c": { "df": 1, "docs": { "2": { "tf": 1.0 } } },
                "df": 0,
                "docs": {},
              },
            },
          },
          "r": {
            "df": 0,
            "docs": {},
            "u": {
              "df": 0,
              "docs": {},
              "n": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
            },
          },
          "s": {
            "df": 0,
            "docs": {},
            "p": {
              "df": 0,
              "docs": {},
              "r": {
                "df": 0,
                "docs": {},
                "e": {
                  "a": {
                    "d": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
                    "df": 0,
                    "docs": {},
                  },
                  "df": 0,
                  "docs": {},
                },
              },
            },
          },
          "u": {
            "df": 0,
            "docs": {},
            "s": { "df": 1, "docs": { "3": { "tf": 1.0 } } },
          },
          "w": {
            "a": {
              "df": 0,
              "docs": {},
              "y": {
                "df": 2,
                "docs": { "1": { "tf": 1.0 }, "2": { "tf": 1.0 } },
              },
            },
            "df": 0,
            "docs": {},
          },
        },
      },
    },
    "lang": "English",
    "pipeline": ["trimmer", "stopWordFilter", "stemmer"],
    "ref": "id",
    "version": "0.9.5",
  },
  "results_options": { "limit_results": 30, "teaser_word_count": 30 },
  "search_options": {
    "bool": "OR",
    "expand": true,
    "fields": {
      "body": { "boost": 1 },
      "breadcrumbs": { "boost": 1 },
      "title": { "boost": 2 },
    },
  },
});
