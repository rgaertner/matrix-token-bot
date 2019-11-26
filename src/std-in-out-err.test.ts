test("connect stream to rx", () => {
  const stdioe = new StdInOutErr({
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr
  });
});
